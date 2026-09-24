import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

/**
 * Read-only production diagnostics (run from report.yml): job history, event
 * volume by type, and samples of recent events with the snapshot history
 * behind them. Prints no emails or user data.
 */
async function main() {
  const { sql } = await import("../lib/db");
  if (process.argv[2] === "perf") return perf(sql);
  if (process.argv[2] === "activity") return activity(sql);
  if (process.argv[2] === "pooler") return pooler();
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
