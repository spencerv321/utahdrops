import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

/**
 * Read-only production diagnostics (run from report.yml): job history, event
 * volume by type, and samples of recent events with the snapshot history
 * behind them. Prints no emails or user data.
 */
async function main() {
  const { sql } = await import("../lib/db");
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
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
