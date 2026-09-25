import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

/**
 * Read-only production diagnostics (run from report.yml): job history, event
 * volume by type, and samples of recent events with the snapshot history
 * behind them. Prints no emails or user data.
 */
const show0 = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0)}`);

/**
 * Are watched bottles as fresh as we say? Store-check capacity, watched-bottle
 * freshness against the target, overdue and failing checks, and how far the
 * ordinary rotation reaches. Counts and product codes only; no user data.
 */
async function freshness(sql: typeof import("../lib/db").sql) {
  const { WATCH_SHARE, WATCH_TARGET_HOURS, WATCH_RECHECK_HOURS, ROTATION_TARGET_HOURS } = await import("../lib/jobs/store-inventory");
  const { storeCapacity } = await import("../lib/jobs/store-capacity");
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  // Every store run in the last 7 days: did it finish, how long, how much, and the gap since the previous one.
  const runs = await sql<{
    started_at: Date; ok: boolean | null; killed: boolean; minutes: number | null; gap_hours: number | null;
    attempted: number | null; scraped: number | null; failed: number | null; watched: number | null; stopped_early: boolean | null;
  }[]>`
    select started_at, ok,
           finished_at is null and started_at < now() - interval '45 minutes' as killed,
           round(extract(epoch from finished_at - started_at) / 60, 1)::float8 as minutes,
           round(extract(epoch from started_at - lag(started_at) over (order by started_at)) / 3600, 1)::float8 as gap_hours,
           coalesce((detail->>'attempted')::int, (detail->>'scraped')::int + (detail->>'failed')::int) as attempted,
           (detail->>'scraped')::int as scraped, (detail->>'failed')::int as failed,
           (detail->>'watched_targets')::int as watched, (detail->>'stopped_early')::boolean as stopped_early
    from scrape_runs where job = 'store_inventory' and started_at > now() - interval '7 days'
    order by started_at`;
  show("store runs, last 7 days (killed = never finished, e.g. hit the job timeout)", runs);
  const done = runs.filter((r) => r.ok && r.attempted);
  const sum = (f: (r: (typeof runs)[number]) => number | null) => done.reduce((a, r) => a + (f(r) ?? 0), 0);
  const days = runs.length ? Math.max(0.25, Math.min(7, (Date.now() - runs[0].started_at.getTime()) / 86_400_000)) : 0;
  const gaps = runs.map((r) => r.gap_hours).filter((g): g is number => g != null).sort((a, b) => a - b);
  const [counts] = await sql<{ watched: number; in_stock: number }[]>`
    select (select count(distinct csc)::int from watchlist) as watched,
           (select count(*)::int from products where in_stock and delisted_at is null) as in_stock`;
  const observed = {
    days_covered: +days.toFixed(1),
    runs: runs.length,
    ok: runs.filter((r) => r.ok).length,
    failed: runs.filter((r) => r.ok === false).length,
    killed: runs.filter((r) => r.killed).length,
    stopped_early: runs.filter((r) => r.stopped_early).length,
    runs_per_day: days ? +(runs.length / days).toFixed(1) : 0,
    gap_hours_median: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null,
    gap_hours_max: gaps.length ? gaps[gaps.length - 1] : null,
    seconds_per_sku: sum((r) => r.attempted) ? +((sum((r) => r.minutes) * 60) / sum((r) => r.attempted)).toFixed(2) : null,
    failure_rate: sum((r) => r.attempted) ? +(sum((r) => r.failed) / sum((r) => r.attempted)).toFixed(3) : null,
    successful_checks_per_day: days ? Math.round(sum((r) => r.scraped) / days) : 0,
    watched_checks_per_day: days ? Math.round(sum((r) => r.watched) / days) : 0,
  };
  show("observed", [observed]);
  // The same model the schedule was sized with, fed with what was observed.
  const model = storeCapacity({
    inStock: counts.in_stock,
    watched: counts.watched,
    runsPerDay: observed.runs_per_day || 6,
    budget: done.length ? Math.max(...done.map((r) => r.attempted ?? 0)) : 400,
    secondsPerSku: observed.seconds_per_sku ?? 2.3,
    failureRate: observed.failure_rate ?? 0.01,
    watchRecheckHours: WATCH_RECHECK_HOURS,
    watchShare: WATCH_SHARE,
    timeBudgetMinutes: 25,
    delayJitterHours: Math.max(0, (observed.gap_hours_max ?? 4) - 24 / (observed.runs_per_day || 6)),
  });
  show("capacity vs targets", [{
    in_stock_products: counts.in_stock,
    distinct_watched_products: counts.watched,
    ...model,
    rotation_target_days: ROTATION_TARGET_HOURS / 24,
    rotation_ok: model.rotationDays <= ROTATION_TARGET_HOURS / 24,
    watched_target_hours: WATCH_TARGET_HOURS,
    watched_ok: model.watchedWorstHours <= WATCH_TARGET_HOURS,
  }]);
  show(`watched bottles by last successful store check (target ${WATCH_TARGET_HOURS}h)`, await sql`
    select case when p.store_checked_at is null then 'never'
                when p.store_checked_at > now() - make_interval(hours => ${WATCH_TARGET_HOURS}) then 'on target'
                when p.store_checked_at > now() - interval '24 hours' then '12-24h'
                when p.store_checked_at > now() - interval '72 hours' then '1-3 days'
                else 'over 3 days' end as age,
           count(*)::int as products
    from products p where p.csc in (select csc from watchlist) group by 1 order by 1`);
  show("overdue watched bottles (no successful check in 24h; failures > 0 = DABS's detail page errors for it, retried with backoff and right after a catalog restock)", await sql`
    select p.csc, p.name, p.in_stock, p.store_checked_at, p.last_store_scrape as last_attempt,
           p.store_check_failures as failures, p.store_retry_at as next_retry
    from products p where p.csc in (select csc from watchlist)
      and coalesce(p.store_checked_at, 'epoch') < now() - interval '24 hours'
    order by p.store_checked_at asc nulls first limit 25`);
  show("failing checks (consecutive failures > 0)", await sql`
    select count(*)::int as products,
           count(*) filter (where csc in (select csc from watchlist))::int as watched,
           count(*) filter (where store_retry_at > now())::int as backing_off
    from products where store_check_failures > 0`);
  show("baseline coverage: in-stock products by last successful store check", await sql`
    select case when store_checked_at is null then 'never'
                when store_checked_at > now() - interval '1 day' then '< 1 day'
                when store_checked_at > now() - interval '3 days' then '1-3 days (target)'
                when store_checked_at > now() - interval '7 days' then '3-7 days'
                else 'over 7 days (shown as unknown)' end as age,
           count(*)::int as products
    from products where in_stock and delisted_at is null group by 1 order by 1`);
  show("in-stock products by last successful store check, % within each age (by segment)", await sql`
    with p as (
      select p.csc, p.store_checked_at as t,
             case when p.store_qty >= 1000 then '1000+' when p.store_qty >= 200 then '200-999'
                  when p.store_qty >= 50 then '50-199' else '1-49' end as size,
             p.status in ('A', 'L') as allocated_limited,
             coalesce(o.tier, case when r.published then r.tier end) in ('scarce', 'rare', 'unicorn') as scarce_plus,
             exists (select 1 from watchlist w where w.csc = p.csc) as watched,
             exists (select 1 from wine_profiles wp where wp.csc = p.csc) as taste_pilot
      from products p
      left join product_rarity r using (csc)
      left join rarity_overrides o using (csc)
      where p.in_stock and p.delisted_at is null and coalesce(p.store_qty, 0) > 0
    ),
    seg as (
      select 'all' as segment, * from p
      union all select 'bottles ' || size, * from p
      union all select 'allocated/limited', * from p where allocated_limited
      union all select 'rated scarce+', * from p where scarce_plus
      union all select 'watched', * from p where watched
      union all select 'taste pilot', * from p where taste_pilot
    )
    select segment, count(*)::int as products,
           round(100.0 * count(*) filter (where t > now() - interval '6 hours') / count(*), 1)::float8 as pct_6h,
           round(100.0 * count(*) filter (where t > now() - interval '12 hours') / count(*), 1)::float8 as pct_12h,
           round(100.0 * count(*) filter (where t > now() - interval '24 hours') / count(*), 1)::float8 as pct_24h,
           round(100.0 * count(*) filter (where t > now() - interval '48 hours') / count(*), 1)::float8 as pct_48h,
           round(100.0 * count(*) filter (where t > now() - interval '72 hours') / count(*), 1)::float8 as pct_72h,
           round(100.0 * count(*) filter (where t is null) / count(*), 1)::float8 as pct_never
    from seg group by segment order by segment`);
  show("statewide catalog passes (last 48h)", await sql`
    select started_at, finished_at, ok, detail->'events' as events, detail->'reason' as suppressed_reason
    from scrape_runs where job = 'catalog' and started_at > now() - interval '48 hours' order by started_at desc`);
  show("alert events last 48h (sent = delivered to at least one watcher)", await sql`
    select e.event_type, count(*)::int as events,
           count(*) filter (where exists (select 1 from alert_deliveries d where d.event_id = e.id))::int as sent
    from inventory_events e where e.created_at > now() - interval '48 hours'
    group by 1 order by 2 desc`);
  return sql.end();
}

/**
 * "Worth a look" review: what each view would show statewide (up to 10, with
 * the facts that qualify each), how many are confirmed near a few areas, and
 * why in-stock scarce bottles were left out. Product data only.
 */
async function discover(sql: typeof import("../lib/db").sql) {
  const { getDiscoverCandidates, backCoverage } = await import("../lib/discover");
  const { DISCOVER, rankView, reasonFor, nearState } = await import("../lib/discover-rules");
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  show("thresholds", [DISCOVER]);
  show("back-after-a-while coverage (unbroken catalog passes since)", [await backCoverage()]);
  for (const view of ["scarce", "back", "price"] as const) {
    const t0 = Date.now();
    const items = rankView(await getDiscoverCandidates(view, null), view, { hasArea: false });
    show(`${view}: ${items.length} qualify statewide (query ${Date.now() - t0} ms); top 10`, items.slice(0, 10).map((i) => ({
      csc: i.csc, name: i.name, size_ml: i.sizeMl, price: i.price, tier: i.tier, statewide_bottles: i.storeQty,
      statewide_at: i.statewideAt, store_checked_at: i.storeCheckedAt, reason: reasonFor(view, i),
      ...(view === "back" ? { out_since: i.outSince, back_at: i.backAt } : {}),
      ...(view === "price" ? { old_price: i.oldPrice, drop_at: i.dropAt } : {}),
    })));
  }
  const areas = [
    { label: "Salt Lake City", lat: 40.7608, lng: -111.891 },
    { label: "Park City", lat: 40.6461, lng: -111.498 },
    { label: "Provo", lat: 40.2338, lng: -111.6585 },
    { label: "St. George", lat: 37.0965, lng: -113.5684 },
  ];
  const near: Record<string, unknown>[] = [];
  for (const a of areas) {
    for (const view of ["scarce", "back", "price"] as const) {
      const items = await getDiscoverCandidates(view, a);
      const states = items.map((i) => nearState(i, true).kind);
      near.push({
        area: a.label, view, qualify: items.length,
        near: states.filter((k) => k === "near").length,
        none_near_fresh_check: states.filter((k) => k === "not-near").length,
        not_checked_24h: states.filter((k) => k === "unknown").length,
      });
    }
  }
  show(`nearby (within 10 mi, successful check < ${DISCOVER.nearbyMaxAgeHours}h)`, near);
  show("in-stock scarce+ bottles left out, by reason", await sql`
    with t as (
      select p.*, case when o.csc is not null then o.tier when pr.published then pr.tier end as tier
      from products p join product_rarity pr using (csc) left join rarity_overrides o using (csc)
      where p.in_stock and coalesce(p.store_qty, 0) > 0
    )
    select case
             when exists (select 1 from rhdp_drawings d where d.item_code = t.csc) then 'released by drawing'
             when delisted_at is not null then 'delisted'
             when coalesce(status, '') in ('S', 'N') or coalesce(category, '') like 'SPECIAL ORDERS%' then 'special order / unavailable'
             when last_seen <= now() - make_interval(hours => ${DISCOVER.statewideMaxAgeHours}) then 'statewide data stale'
             when current_price is null then 'no price'
             else 'shown' end as outcome,
           count(*)::int as products, (array_agg(csc || ' ' || name order by csc))[1:5] as examples
    from t where tier in ('scarce', 'rare', 'unicorn') group by 1 order by 2 desc`);
  show("price drops seen in window but left out (latest change per product)", await sql`
    with latest as (
      select distinct on (e.csc) e.csc, e.created_at, (e.detail->>'old')::numeric as old_price, (e.detail->>'new')::numeric as new_price
      from inventory_events e where e.event_type = 'price_change' order by e.csc, e.created_at desc, e.id desc
    )
    select case
             when l.new_price >= l.old_price then 'latest change is an increase'
             when l.old_price - l.new_price < ${DISCOVER.price.minDollars} or l.old_price - l.new_price < l.old_price * ${DISCOVER.price.minPct} then 'drop below threshold'
             when l.new_price <> p.current_price then 'current price differs'
             when not p.in_stock then 'not in stock'
             else 'other (stale, special order, drawing, reused code, or unstable previous price)' end as outcome,
           count(*)::int as products
    from latest l join products p using (csc)
    where l.created_at > now() - make_interval(days => ${DISCOVER.price.withinDays})
    group by 1 order by 2 desc`);
  return sql.end();
}

async function main() {
  // These modes must work even when the session pooler (5432) is full, so go
  // through the transaction pooler (6543), which has its own client limit.
  if (["auth", "conns"].includes(process.argv[2] ?? "") && process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    if (u.hostname.endsWith(".pooler.supabase.com")) u.port = "6543";
    process.env.DATABASE_URL = u.toString();
  }
  if (process.argv[2] === "pdata") {
    process.env.VERCEL = "";
    const q = await import("../lib/queries");
    for (const csc of ["918885", "102334", "005586"]) {
      const [p, h, st, ev] = await Promise.all([q.getProduct(csc), q.getProductHistory(csc), q.getStoreAvailability(csc), q.getProductEvents(csc)]);
      console.log("=====", csc);
      console.log(JSON.stringify(p));
      console.log("history", h.length, JSON.stringify(h.slice(0, 3)), JSON.stringify(h.slice(-3)));
      console.log("stores", st.length, JSON.stringify(st.slice(0, 2)));
      console.log("events", JSON.stringify(ev));
    }
    process.exit(0);
  }
  if (process.argv[2] === "product") {
    // Same settings as Vercel: pooled port, 3 connections, 2s idle close.
    process.env.VERCEL = "1";
    const q = await import("../lib/queries");
    const csc = process.argv[3] ?? "918885";
    for (let round = 1; round <= 10; round++) {
      const t = Date.now();
      const r = await Promise.race([
        Promise.all([
          q.getProduct(csc), q.getProduct(csc), q.getProductHistory(csc), q.getStoreAvailability(csc),
          q.getProductEvents(csc), q.getFreshness(), q.getUserStoreIds(undefined),
        ]).then(() => "ok", (e: Error) => "ERR " + e.message),
        new Promise((res) => setTimeout(() => res("HUNG"), 20_000)),
      ]);
      console.log(`round ${round}: ${r} ${Date.now() - t}ms`);
      await new Promise((res) => setTimeout(res, round % 2 ? 300 : 4_000));
    }
    process.exit(0);
  }
  const { sql } = await import("../lib/db");
  if (process.argv[2] === "perf") return perf(sql);
  if (process.argv[2] === "activity") return activity(sql);
  if (process.argv[2] === "pooler") return pooler();
  if (process.argv[2]?.startsWith("storediag")) {
    // Per-store history for one product ("storediag:038176"): rows per day, current rows, rotation.
    const csc = process.argv[2].split(":")[1] ?? process.argv[3] ?? "018006";
    show0("product", await sql`select csc, name, status, in_stock, store_qty, last_store_scrape, store_checked_at, store_check_failures, store_retry_at, first_seen, last_seen, delisted_at from products where csc = ${csc}`);
    show0("history rows total", await sql`select count(*)::int as rows, min(scraped_at) as first, max(scraped_at) as last from store_inventory where csc = ${csc}`);
    show0("rotation position (targets ahead of it)", await sql`
      select count(*)::int as ahead from products p
      where (p.in_stock or exists (select 1 from watchlist w where w.csc = p.csc))
        and coalesce(p.store_checked_at, 'epoch') < (select coalesce(store_checked_at, 'epoch') from products where csc = ${csc})`);
    const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
    show("current", await sql`select count(*)::int as rows, count(*) filter (where qty > 0)::int as stocked, min(scraped_at) as oldest, max(scraped_at) as newest from store_inventory_current where csc = ${csc}`);
    show("history rows by day", await sql`
      select (scraped_at at time zone 'America/Denver')::date::text as d, count(*)::int as rows,
             count(*) filter (where qty > 0)::int as pos, count(*) filter (where qty = 0)::int as zero,
             count(distinct store_id)::int as stores, count(distinct scraped_at)::int as passes
      from store_inventory where csc = ${csc} group by 1 order by 1`);
    show("store runs (last 40)", await sql`select started_at, ok, detail - 'errors' as detail from scrape_runs where job = 'store_inventory' order by started_at desc limit 40`);
    show("store runs per day", await sql`select (started_at at time zone 'America/Denver')::date::text as d, count(*)::int as runs, count(*) filter (where ok)::int as ok from scrape_runs where job = 'store_inventory' group by 1 order by 1`);
    return sql.end();
  }
  if (process.argv[2] === "storecoverage") {
    // Which in-stock products have per-store history, by statewide stock size.
    show0("in-stock products with any store history before the outage (Aug 14), by statewide bottles", await sql`
      select case when store_qty >= 1000 then '1000+' when store_qty >= 200 then '200-999' when store_qty >= 50 then '50-199' else '1-49' end as bucket,
             count(*)::int as products,
             count(*) filter (where exists (select 1 from store_inventory s where s.csc = p.csc and s.scraped_at < '2026-08-14'))::int as with_history,
             count(*) filter (where last_store_scrape is null)::int as never_attempted
      from products p where in_stock and delisted_at is null group by 1 order by 1`);
    show0("recent store-run errors", await sql`
      select started_at, detail->'failed' as failed, detail->'errors' as errors from scrape_runs
      where job = 'store_inventory' and detail ? 'errors' order by started_at desc limit 6`);
    show0("largest in-stock products with no pre-outage history", await sql`
      select csc, name, store_qty, last_store_scrape from products p
      where in_stock and delisted_at is null
        and not exists (select 1 from store_inventory s where s.csc = p.csc and s.scraped_at < '2026-08-14')
      order by store_qty desc limit 15`);
    return sql.end();
  }
  if (process.argv[2] === "freshness") return freshness(sql);
  if (process.argv[2] === "checks") return checks(sql);
  if (process.argv[2] === "discover") return discover(sql);
  if (process.argv[2] === "searchcheck") {
    const { runSearchCheck } = await import("./search-check");
    const ok = await runSearchCheck();
    await sql.end();
    process.exit(ok ? 0 : 1);
  }
  if (process.argv[2] === "rarity") return (await import("./rarity-report")).rarityReport(sql);
  if (process.argv[2] === "taste") return (await import("./taste-report")).tasteReport(sql);
  if (process.argv[2] === "searchlog") return (await import("./taste-report")).searchLog(sql);
  if (process.argv[2] === "tasteeval") {
    const failures = await (await import("./taste-eval")).runTasteEval(true);
    await sql.end();
    process.exit(failures ? 1 : 0);
  }
  if (process.argv[2] === "conns" || process.argv[2] === "auth") {
    // Who holds database connections right now (session-pooler exhaustion).
    console.log("\n## connections by client\n" + JSON.stringify(await sql`
      select usename, application_name, client_addr::text, state, count(*)::int as n,
             min(backend_start) as oldest_start, max(now() - state_change)::text as longest_in_state,
             left(max(regexp_replace(query, '\s+', ' ', 'g')), 120) as sample_query
      from pg_stat_activity where backend_type = 'client backend'
      group by 1, 2, 3, 4 order by n desc`, null, 1));
    if (process.argv[2] === "conns") return sql.end();
  }
  if (process.argv[2] === "auth") {
    // Where sign-ups stall. Counts and timings only; no emails.
    const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 1)}`);
    show("accounts by state", await sql`
      select (last_sign_in_at is not null) as signed_in, (email_confirmed_at is not null) as confirmed,
             count(*)::int as n, min(created_at) as first, max(created_at) as last
      from auth.users group by 1, 2 order by 1, 2`);
    show("per account (anonymised)", await sql`
      select row_number() over (order by created_at)::int as n,
             created_at, confirmation_sent_at, email_confirmed_at, recovery_sent_at, last_sign_in_at,
             raw_app_meta_data->>'provider' as provider
      from auth.users order by created_at`);
    show("identities", await sql`select provider, count(*)::int from auth.identities group by 1`);
    show("footer signups not yet accounts", await sql`
      select count(*)::int from email_signups s
      where not exists (select 1 from auth.users u where lower(u.email) = s.email)`);
    return sql.end();
  }
  if (process.argv[2] === "slow") {
    const rows = await sql`
      select calls, round(max_exec_time)::int as max_ms, round(mean_exec_time::numeric, 1) as mean_ms,
             left(regexp_replace(query, '\\s+', ' ', 'g'), 400) as query
      from pg_stat_statements order by max_exec_time desc limit 12`;
    for (const r of rows) console.log(JSON.stringify(r));
    return sql.end();
  }
  const hours = Number(process.argv[2] ?? 6);
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 1)}`);

  show("recent runs", await sql`
    select job, started_at, ok, detail - 'errors' as detail from scrape_runs
    where started_at > now() - make_interval(hours => ${hours}) order by started_at desc limit 20`);
  show("events by type (window)", await sql`
    select event_type, count(*)::int from inventory_events
    where created_at > now() - make_interval(hours => ${hours}) group by 1 order by 2 desc`);
  for (const type of ["restock", "out_of_stock", "price_change", "status_change", "new_product"]) {
    const sample = await sql`
      select e.csc, e.detail, e.created_at,
             (select json_agg(json_build_object('at', s.scraped_at, 'store_qty', s.store_qty, 'price', s.price) order by s.scraped_at desc)
              from (select * from inventory_snapshots where csc = e.csc order by scraped_at desc limit 4) s) as last_snapshots
      from inventory_events e
      where e.event_type = ${type} and e.created_at > now() - make_interval(hours => ${hours})
      order by random() limit 4`;
    show(`sample ${type}`, sample);
  }
  show("restock qty distribution", await sql`
    select (detail->>'qty')::int as qty, count(*)::int from inventory_events
    where event_type = 'restock' and created_at > now() - make_interval(hours => ${hours})
    group by 1 order by 2 desc limit 10`);
  show("watchers affected", await sql`
    select e.event_type, count(distinct w.user_id)::int as users, count(*)::int as pairs
    from inventory_events e join watchlist w using (csc)
    where e.created_at > now() - make_interval(hours => ${hours}) group by 1`);
  show("page views (window)", await sql`
    select count(*)::int as views, count(distinct visitor_id)::int as visitors,
           count(*) filter (where is_landing)::int as visits, max(created_at) as latest
    from page_events where created_at > now() - make_interval(hours => ${hours})`.catch((e: Error) => e.message));
  // Catalog shape (for UI copy and units): categories, sizes, statuses, names.
  show("categories", await sql`
    select category, count(*)::int as total, count(*) filter (where in_stock)::int as in_stock,
           percentile_cont(0.5) within group (order by current_price)::numeric(10,2) as median_price,
           (array_agg(name order by store_qty desc nulls last))[1:3] as sample_names
    from products where delisted_at is null
    group by 1 order by 2 desc`);
  show("sizes (ml)", await sql`
    select size_ml, count(*)::int from products where delisted_at is null group by 1 order by 2 desc limit 15`);
  show("statuses", await sql`
    select status, count(*)::int, count(*) filter (where in_stock)::int as in_stock
    from products where delisted_at is null group by 1 order by 2 desc`);
  show("store names", await sql`select id, name, city from stores order by id limit 12`);
  show("store coverage", await sql`
    select count(distinct csc)::int as products_with_store_counts,
           (select count(*)::int from products where in_stock and delisted_at is null) as in_stock_products
    from store_inventory_current`);
  await sql.end();
}
/**
 * `report.ts perf`: why is the site slow? Times the live pages (from the
 * Actions runner), the queries behind them, and lists table sizes and the
 * slowest statements if pg_stat_statements is available. Read-only.
 */
async function perf(sql: typeof import("../lib/db").sql) {
  const q = await import("../lib/queries");
  const { SHORTCUTS } = await import("../lib/browse");
  const site = process.env.SITE ?? "https://utahdrops.com";
  const [{ csc }] = (await sql`
    select csc from products where in_stock order by store_qty desc nulls last limit 1`) as unknown as { csc: string }[];
  const db = new URL(process.env.DATABASE_URL ?? "http://x");
  console.log(`db host: ${db.hostname}:${db.port}`);

  console.log("\n## live pages (4 runs each, ms)");
  for (const path of ["/api/health", "/", "/search?q=weller", `/product/${csc}`, "/drops", "/whats-new"]) {
    const runs: string[] = [];
    let meta = "";
    for (let i = 0; i < 4; i++) {
      const t = Date.now();
      try {
        const res = await fetch(site + path, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "utahdrops-report" } });
        await res.text();
        runs.push(`${res.status}:${Date.now() - t}`);
        meta = `vercel-id=${res.headers.get("x-vercel-id")} cache=${res.headers.get("x-vercel-cache")}`;
      } catch (e) {
        runs.push(`ERR(${(e as Error).name}):${Date.now() - t}`);
      }
    }
    console.log(`${path.padEnd(22)} ${runs.join("  ")}  ${meta}`);
  }

  const time = async (label: string, fn: () => Promise<unknown>) => {
    const ms: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      try { await fn(); ms.push(Date.now() - t); } catch (e) { console.log(`${label}: ERROR ${(e as Error).message}`); return; }
    }
    console.log(`${label.padEnd(28)} ${ms.join(" / ")} ms`);
  };
  console.log("\n## queries from the runner (3 runs each)");
  await time("select 1", () => sql`select 1`);
  await time("getFreshness", () => q.getFreshness());
  await time("getHomeFeed(10)", () => q.getHomeFeed(10));
  await time("getShortcutCounts", () => q.getShortcutCounts(SHORTCUTS));
  await time("getDropListSize", () => q.getDropListSize("2026-10-17"));
  await time("searchProducts(weller)", () => q.searchProducts({ q: "weller" }));
  await time("searchProducts(default)", () => q.searchProducts({}));
  await time("getCategories", () => q.getCategories());
  await time("getProduct", () => q.getProduct(csc));
  await time("getProductHistory", () => q.getProductHistory(csc));
  await time("getStoreAvailability", () => q.getStoreAvailability(csc));
  await time("getProductEvents", () => q.getProductEvents(csc));
  await time("getEvents()", () => q.getEvents());
  await time("getDrops", () => q.getDrops());

  console.log("\n## table sizes");
  console.log(JSON.stringify(await sql`
    select relname as table, n_live_tup::int as rows, pg_size_pretty(pg_total_relation_size(relid)) as size
    from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 12`, null, 1));
  try {
    console.log("\n## slowest statements (pg_stat_statements)");
    console.log(JSON.stringify(await sql`
      select calls::int, round(mean_exec_time::numeric, 1) as mean_ms, round(total_exec_time::numeric) as total_ms,
             left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
      from pg_stat_statements order by total_exec_time desc limit 12`, null, 1));
  } catch (e) {
    console.log(`not available: ${(e as Error).message}`);
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

/** What the database is doing right now: running/waiting queries, blockers, timeouts. */
async function activity(sql: typeof import("../lib/db").sql) {
  console.log("## timeouts");
  console.log(await sql`
    select r.rolname, r.rolconfig from pg_roles r
    where r.rolname in ('postgres', 'authenticator', 'anon', 'authenticated', 'service_role')`);
  console.log(await sql`show statement_timeout`);
  const site = process.env.SITE ?? "https://utahdrops.com";
  for (let round = 0; round < 6; round++) {
    // Load a few pages (not awaited) so there is live traffic to look at.
    for (const p of ["/", "/search?q=weller", "/drops", "/whats-new"])
      fetch(site + p, { signal: AbortSignal.timeout(20_000) }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4_000));
    console.log(`\n## round ${round + 1}: pg_stat_activity (non-idle)`);
    const rows = await sql`
      select pid, usename, application_name, state, wait_event_type, wait_event,
             round(extract(epoch from now() - query_start)::numeric, 1) as secs,
             round(extract(epoch from now() - xact_start)::numeric, 1) as xact_secs,
             pg_blocking_pids(pid) as blocked_by, left(regexp_replace(query, '\\s+', ' ', 'g'), 160) as query
      from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
        and state is distinct from 'idle'
      order by query_start nulls last`;
    for (const r of rows) console.log(JSON.stringify(r));
    const [c] = await sql`
      select count(*)::int as total, count(*) filter (where state = 'idle')::int as idle,
             count(*) filter (where state = 'idle in transaction')::int as idle_in_tx
      from pg_stat_activity where datname = current_database()`;
    console.log("connections:", JSON.stringify(c));
  }
  await sql.end();
}

/** Query through the transaction pooler (port 6543) exactly like Vercel does, timing each query. */
async function pooler() {
  const postgres = (await import("postgres")).default;
  const { resolveDatabaseUrl } = await import("../lib/db");
  const url = resolveDatabaseUrl(process.env.DATABASE_URL!, true);
  console.log("port:", new URL(url).port);
  const db = postgres(url, { max: 3, idle_timeout: 2, max_lifetime: 300, connect_timeout: 10, prepare: false });
  const q = await import("../lib/queries");
  void q;
  const timed = async (label: string, run: () => Promise<unknown>) => {
    const t = Date.now();
    const r = await Promise.race([
      run().then(() => "ok", (e: Error) => "ERR " + e.message),
      new Promise((res) => setTimeout(() => res("HUNG"), 15_000)),
    ]);
    return `${label}:${r}:${Date.now() - t}`;
  };
  for (let round = 1; round <= 8; round++) {
    const out = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => timed(String(i), () => db`select count(*) from products where in_stock and csc > ${String(i)}`))
    );
    console.log(`round ${round}`, out.join("  "));
    // Alternate short and long idle gaps (connections close after 2s idle).
    await new Promise((r) => setTimeout(r, round % 2 ? 500 : 5_000));
  }
  await db.end({ timeout: 2 });
  process.exit(0);
}

/**
 * store_checks (every store check since it was added): speed and failures by
 * source, how often a re-check finds store counts changed by the age of the
 * previous check (decay: how fast "checked N hours ago" goes stale), and
 * "Check DABS now" use. Product codes and counts only.
 */
async function checks(sql: typeof import("../lib/db").sql) {
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  show("checks by source, last 7 days", await sql`
    select source, count(*)::int as checks, count(*) filter (where not ok)::int as failed,
           round(100.0 * count(*) filter (where not ok) / count(*), 1)::float8 as failed_pct,
           percentile_cont(0.5) within group (order by ms)::int as ms_p50,
           percentile_cont(0.9) within group (order by ms)::int as ms_p90,
           max(ms) as ms_max
    from store_checks where created_at > now() - interval '7 days' group by 1 order by 1`);
  show("checks per day (Mountain time)", await sql`
    select (created_at at time zone 'America/Denver')::date::text as day, source, count(*)::int as checks,
           count(*) filter (where not ok)::int as failed
    from store_checks where created_at > now() - interval '14 days' group by 1, 2 order by 1, 2`);
  show("decay: re-checks that found a store count changed, by age of the previous check", await sql`
    select case when age < interval '6 hours' then 'a <6h' when age < interval '12 hours' then 'b 6-12h'
                when age < interval '24 hours' then 'c 12-24h' when age < interval '48 hours' then 'd 24-48h'
                when age < interval '72 hours' then 'e 48-72h' else 'f 72h+' end as prev_check_age,
           case when statewide_qty >= 200 then 'bottles 200+' when statewide_qty >= 50 then 'bottles 50-199' else 'bottles 1-49' end as size,
           count(*)::int as rechecks,
           round(100.0 * count(*) filter (where changed_stores > 0) / count(*), 1)::float8 as pct_changed,
           round(avg(changed_stores), 2)::float8 as avg_stores_changed,
           round(avg(stocked), 1)::float8 as avg_stocked_stores
    from (select *, created_at - prev_checked_at as age from store_checks
          where ok and prev_checked_at is not null and created_at > now() - interval '14 days') c
    where statewide_qty > 0
    group by 1, 2 order by 2, 1`);
  show("Check DABS now: outcomes, last 7 days", await sql`
    select count(*)::int as checks, count(distinct csc)::int as bottles,
           count(*) filter (where ok and changed_stores > 0)::int as found_changes,
           count(*) filter (where not ok)::int as failed,
           (array_agg(error order by created_at desc) filter (where not ok))[1:5] as recent_errors
    from store_checks where source = 'on_demand' and created_at > now() - interval '7 days'`);
  return sql.end();
}
