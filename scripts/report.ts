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
