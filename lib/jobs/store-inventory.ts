import { sql } from "@/lib/db";
import { parseStatusCode } from "@/lib/dabs/client";
import { fetchProductDetail, type ProductDetail } from "@/lib/dabs/detail";
import { withRun } from "./run";

/**
 * Per-store pass. Each SKU costs two requests (session prime + detail page),
 * so a full-catalog pass isn't possible every run. Pick the stalest targets,
 * with a head start for the ones people care about:
 *   watchlisted SKUs count as 3 days staler, in-stock allocated / limited /
 *   discontinued (A, L, D) as 1 day staler, never-scraped SKUs go first.
 * A pure priority ordering starved everything else whenever the priority
 * buckets exceeded the budget; staleness-with-boost can't starve anything.
 * Budget is SKUs per run (default 200 ≈ 7½ min at 1.1 s/request).
 */
const MAX_CONSECUTIVE_FAILURES = 5;

export async function runStoreInventoryJob(budget = Number(process.env.STORE_SCRAPE_BUDGET ?? 200)) {
  return withRun("store_inventory", async () => {
    const targets = await sql<{ csc: string }[]>`
      select p.csc
      from products p
      left join (select distinct csc from watchlist) w using (csc)
      where p.in_stock or w.csc is not null
      order by
        coalesce(p.last_store_scrape, 'epoch'::timestamptz)
          - case
              when w.csc is not null then interval '3 days'
              when p.status in ('A', 'L', 'D') then interval '1 day'
              else interval '0'
            end asc
      limit ${budget}`;

    if (targets.length === 0) return { scraped: 0, note: "no targets" };

    let scraped = 0;
    let storeRows = 0;
    let consecutiveFailures = 0;
    const errors: string[] = [];

    for (const { csc } of targets) {
      let detail: ProductDetail;
      try {
        detail = await fetchProductDetail(csc);
      } catch (err) {
        errors.push(`${csc}: ${err instanceof Error ? err.message : String(err)}`);
        // Rotate the SKU to the back of the queue so a permanently failing
        // product can't sit at the front and abort every future run.
        await sql`update products set last_store_scrape = now() where csc = ${csc}`;
        if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`store pass aborting after ${consecutiveFailures} consecutive failures: ${errors.slice(-MAX_CONSECUTIVE_FAILURES).join("; ")}`);
        }
        continue;
      }
      consecutiveFailures = 0;
      await persistDetail(detail);
      scraped++;
      storeRows += detail.stores.length;
    }

    return { scraped, store_rows: storeRows, failed: errors.length, errors: errors.slice(0, 20) };
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

  // Stores we previously saw stock at but that are missing from this page are
  // now at zero — otherwise a sell-out leaves phantom stock forever.
  const seenStoreIds = detail.stores.map((s) => s.storeId);
  await sql`
    with gone as (
      update store_inventory_current
      set qty = 0, scraped_at = now()
      where csc = ${detail.sku} and qty > 0
        and not (store_id = any(${seenStoreIds}::int[]))
      returning csc, store_id
    )
    insert into store_inventory (csc, store_id, qty, scraped_at)
    select csc, store_id, 0, now() from gone`;

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
