import { sql } from "@/lib/db";
import { parseStatusCode } from "@/lib/dabs/client";
import { fetchProductDetail, type ProductDetail } from "@/lib/dabs/detail";
import { withRun } from "./run";

/**
 * Per-store pass. Each SKU costs two requests (session prime + detail page),
 * so a full-catalog pass isn't possible every run. Prioritize per the PRD:
 *   (a) watchlisted SKUs
 *   (b) allocated / limited / discontinued (A, L, D) in-stock items
 *   (c) everything else in stock, rotated by last_store_scrape
 * Budget is SKUs per run (default 200 ≈ 7½ min at 1.1 s/request).
 */
export async function runStoreInventoryJob(budget = Number(process.env.STORE_SCRAPE_BUDGET ?? 200)) {
  return withRun("store_inventory", async () => {
    const targets = await sql<{ csc: string }[]>`
      select csc from (
        select p.csc,
               case
                 when w.csc is not null then 0
                 when p.status in ('A', 'L', 'D') then 1
                 else 2
               end as priority,
               p.last_store_scrape
        from products p
        left join (select distinct csc from watchlist) w using (csc)
        where p.in_stock or p.status in ('A', 'L', 'D') or w.csc is not null
      ) t
      order by priority, last_store_scrape asc nulls first
      limit ${budget}`;

    if (targets.length === 0) return { scraped: 0, note: "no targets" };

    let scraped = 0;
    let storeRows = 0;
    const errors: string[] = [];

    for (const { csc } of targets) {
      let detail: ProductDetail;
      try {
        detail = await fetchProductDetail(csc);
      } catch (err) {
        errors.push(`${csc}: ${err instanceof Error ? err.message : String(err)}`);
        if (errors.length >= 5) {
          throw new Error(`store pass aborting after repeated failures: ${errors.join("; ")}`);
        }
        continue;
      }
      await persistDetail(detail);
      scraped++;
      storeRows += detail.stores.length;
    }

    return { scraped, store_rows: storeRows, errors };
  });
}

export async function persistDetail(detail: ProductDetail) {
  // Stores ride along on every detail page — keeps the store table fresh for free.
  const storeUpserts = detail.stores
    .filter((s) => s.storeId > 0)
    .map((s) => ({
      id: s.storeId,
      name: s.storeName,
      address: s.address,
      city: s.city,
      phone: s.phone,
      lat: s.lat,
      lng: s.lng,
      is_club: /CLUB/i.test(s.storeName),
    }));
  if (storeUpserts.length > 0) {
    await sql`
      insert into stores ${sql(storeUpserts, "id", "name", "address", "city", "phone", "lat", "lng", "is_club")}
      on conflict (id) do update set
        name = excluded.name,
        address = excluded.address,
        city = excluded.city,
        phone = excluded.phone,
        lat = coalesce(excluded.lat, stores.lat),
        lng = coalesce(excluded.lng, stores.lng),
        is_club = excluded.is_club,
        last_seen = now()`;
  }

  const current = detail.stores.map((s) => ({
    csc: detail.sku,
    store_id: s.storeId,
    qty: s.qty,
    scraped_at: new Date(),
  }));

  if (current.length > 0) {
    // History rows only where qty actually changed (delta encoding)
    await sql`
      with incoming as (
        select * from jsonb_to_recordset(${sql.json(current as never)})
          as x(csc text, store_id int, qty int)
      )
      insert into store_inventory (csc, store_id, qty, scraped_at)
      select i.csc, i.store_id, i.qty, now()
      from incoming i
      left join store_inventory_current c
        on c.csc = i.csc and c.store_id = i.store_id
      where c.csc is null or c.qty is distinct from i.qty`;

    await sql`
      insert into store_inventory_current ${sql(current, "csc", "store_id", "qty", "scraped_at")}
      on conflict (csc, store_id) do update set
        qty = excluded.qty, scraped_at = excluded.scraped_at`;
  }

  // The detail page also carries product facts the list API lacks
  await sql`
    update products set
      description = coalesce(${detail.description}, description),
      status = coalesce(${parseStatusCode(detail.statusRaw)}, status),
      warehouse_qty = coalesce(${detail.warehouseQty}, warehouse_qty),
      on_order_qty = coalesce(${detail.onOrderQty}, on_order_qty),
      last_store_scrape = now()
    where csc = ${detail.sku}`;
}
