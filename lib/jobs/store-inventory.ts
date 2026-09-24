import { sql } from "@/lib/db";
import { parseStatusCode } from "@/lib/dabs/client";
import { fetchProductDetail, type ProductDetail } from "@/lib/dabs/detail";
import { STORE_DATA_MAX_AGE_HOURS } from "@/lib/config";
import { withRun } from "./run";

/**
 * Per-store pass. Each SKU costs two DABS requests (session prime + detail
 * page) at ≤1 req/s, so a run covers `budget` SKUs (300 ≈ 11 min), not the
 * catalog. Each run is split explicitly:
 *
 *   1. Watched bottles: up to WATCH_SHARE of the budget goes to watchlisted
 *      products not checked in the last WATCH_RECHECK_HOURS, oldest first,
 *      so with runs every 4h each is re-checked at every run (target: within
 *      WATCH_TARGET_HOURS even when GitHub starts a run hours late).
 *   2. Everything else in stock: the rest of the budget, oldest successful
 *      check first (allocated / limited / clearance get a 1-day head start),
 *      so ordinary bottles keep rotating and can't be starved.
 *
 * A failed attempt records the attempt and backs the product off
 * (6h, 12h, 24h, 48h, then 72h) without touching its last successful check,
 * so old counts never look freshly verified and a broken page can't block
 * the queue.
 *
 * Each run also has a wall-clock budget (STORE_TIME_BUDGET_MINUTES) below the
 * workflow's 30-minute timeout: when DABS is slow the run stops early and
 * records what it did, instead of being killed (a killed run skips the
 * digest and leaves an unfinished scrape_runs row). Watched bottles go first,
 * so a short run only trims the rotation.
 *
 * Sizing (lib/jobs/store-capacity.ts, report.ts mode "freshness"): runs
 * every 4h, 400 SKUs each, ~2.3 s per SKU at the 1.1 s request pacing
 * (≈15 min), which cycles ~5.4k in-stock bottles in ~2.5 days
 * (ROTATION_TARGET_HOURS) with watched bottles re-checked every run.
 */
const MAX_CONSECUTIVE_FAILURES = 5;
export const WATCH_SHARE = 0.4;
export const WATCH_RECHECK_HOURS = 3;
export const WATCH_TARGET_HOURS = 12;
/** Ordinary in-stock bottles: re-checked well inside the 7-day "unknown" cutoff. */
export const ROTATION_TARGET_HOURS = 72;
const TIME_BUDGET_MS = Number(process.env.STORE_TIME_BUDGET_MINUTES ?? 25) * 60_000;

export async function selectStoreTargets(budget: number): Promise<{ watched: string[]; rotation: string[] }> {
  const watchSlots = Math.floor(budget * WATCH_SHARE);
  const watched = (
    await sql<{ csc: string }[]>`
      select p.csc
      from products p
      where p.csc in (select distinct csc from watchlist)
        and coalesce(p.store_retry_at, '-infinity') <= now()
        and coalesce(p.store_checked_at, '-infinity') < now() - make_interval(hours => ${WATCH_RECHECK_HOURS})
      order by p.store_checked_at asc nulls first
      limit ${watchSlots}`
  ).map((r) => r.csc);

  const rotation = (
    await sql<{ csc: string }[]>`
      select p.csc
      from products p
      left join (select distinct csc from watchlist) w using (csc)
      where (p.in_stock or w.csc is not null)
        and coalesce(p.store_retry_at, '-infinity') <= now()
        and not (p.csc = any(${watched}::text[]))
      order by
        coalesce(p.store_checked_at, 'epoch'::timestamptz)
          - case
              when w.csc is not null then interval '3 days'
              when p.status in ('A', 'L', 'D') then interval '1 day'
              else interval '0'
            end asc
      limit ${Math.max(0, budget - watched.length)}`
  ).map((r) => r.csc);

  return { watched, rotation };
}

/** A failed detail fetch: note the attempt and back off; the last good check stays as it was. */
export async function recordStoreFailure(csc: string) {
  await sql`
    update products set
      last_store_scrape = now(),
      store_check_failures = store_check_failures + 1,
      store_retry_at = now() + least(interval '3 hours' * power(2, store_check_failures + 1), interval '72 hours')
    where csc = ${csc}`;
}

export async function runStoreInventoryJob(budget = Number(process.env.STORE_SCRAPE_BUDGET ?? 200)) {
  return withRun("store_inventory", async () => {
    const { watched, rotation } = await selectStoreTargets(budget);
    const targets = [...watched, ...rotation];
    if (targets.length === 0) return { scraped: 0, note: "no targets" };

    let scraped = 0;
    let storeRows = 0;
    let consecutiveFailures = 0;
    let attempted = 0;
    const errors: string[] = [];
    const started = Date.now();

    for (const csc of targets) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      attempted++;
      let detail: ProductDetail;
      try {
        detail = await fetchProductDetail(csc);
      } catch (err) {
        errors.push(`${csc}: ${err instanceof Error ? err.message : String(err)}`);
        await recordStoreFailure(csc);
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

    return {
      scraped,
      attempted,
      // Stopped at the time budget before reaching every target (DABS slow).
      stopped_early: attempted < targets.length,
      seconds: Math.round((Date.now() - started) / 1000),
      watched_targets: watched.length,
      rotation_targets: rotation.length,
      store_rows: storeRows,
      failed: errors.length,
      errors: errors.slice(0, 20),
    };
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
    // Per-store restocks: a store we'd seen at zero now has stock. (A store's
    // first-ever observation isn't a restock — we don't know what came before.)
    // These feed "back at my store" alerts for users with that home store.
    await sql`
      with incoming as (
        select * from jsonb_to_recordset(${sql.json(current as never)})
          as x(csc text, store_id int, qty int)
      )
      insert into inventory_events (csc, event_type, detail)
      select i.csc, 'store_restock', jsonb_build_object(
               'name', ${detail.name}::text,
               'store_id', i.store_id,
               'store_name', s.name,
               'city', s.city,
               'qty', i.qty,
               'prev_checked_at', c.scraped_at)
      from incoming i
      join store_inventory_current c on c.csc = i.csc and c.store_id = i.store_id
      join stores s on s.id = i.store_id
      where c.qty = 0 and i.qty > 0
        -- Only against a recent "none there": after an outage or a long gap in
        -- rotation, the zero is too old to call this a restock.
        and c.scraped_at > now() - make_interval(hours => ${STORE_DATA_MAX_AGE_HOURS})`;

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
      last_store_scrape = now(),
      store_checked_at = now(),
      store_check_failures = 0,
      store_retry_at = null
    where csc = ${detail.sku}`;
}
