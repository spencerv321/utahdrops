/**
 * Analytics deep dive (report.yml → `deepdive`): one pass over everything the
 * site records — visitors, searches, watches, alerts, the DABS market data and
 * the jobs that collect it. Aggregates only: no emails, no user ids, no IPs.
 * Each section runs on its own, so one slow or failing query doesn't stop the rest.
 */
type Sql = typeof import("../lib/db").sql;

export async function deepdive(sql: Sql) {
  const since = "2026-09-24";
  const tz = "America/Denver";
  const q = async (title: string, run: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const rows = await run();
      console.log(`\n## ${title} (${Date.now() - t0} ms)\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
    } catch (err) {
      console.log(`\n## ${title}\nERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  await sql`set statement_timeout = '60s'`;

  // ---------- What we collect ----------
  await q("tables: rows and size", () => sql`
    select c.relname as table, c.reltuples::bigint as approx_rows,
           pg_size_pretty(pg_total_relation_size(c.oid)) as size, pg_total_relation_size(c.oid) as bytes
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by bytes desc`);
  await q("first and last row per collected table", () => sql`
    select 'page_events' as t, min(created_at)::text as first, max(created_at)::text as last, count(*)::int as n from page_events
    union all select 'discover_events', min(created_at)::text, max(created_at)::text, count(*)::int from discover_events
    union all select 'taste_events', min(created_at)::text, max(created_at)::text, count(*)::int from taste_events
    union all select 'store_checks', min(created_at)::text, max(created_at)::text, count(*)::int from store_checks
    union all select 'inventory_events', min(created_at)::text, max(created_at)::text, count(*)::int from inventory_events
    union all select 'inventory_snapshots', min(scraped_at)::text, max(scraped_at)::text, count(*)::int from inventory_snapshots
    union all select 'alert_deliveries', min(sent_at)::text, max(sent_at)::text, count(*)::int from alert_deliveries
    union all select 'rating_feedback', min(created_at)::text, max(created_at)::text, count(*)::int from rating_feedback
    union all select 'email_signups', min(created_at)::text, max(created_at)::text, count(*)::int from email_signups
    union all select 'watchlist', min(created_at)::text, max(created_at)::text, count(*)::int from watchlist
    union all select 'scrape_runs', min(started_at)::text, max(started_at)::text, count(*)::int from scrape_runs`);

  // ---------- Audience ----------
  await q("traffic by week (Mountain)", () => sql`
    select date_trunc('week', created_at at time zone ${tz})::date::text as week,
           count(*)::int as views, count(distinct visitor_id)::int as visitors, count(distinct session_id)::int as sessions,
           count(distinct visitor_id) filter (where user_id is not null)::int as signed_in_visitors
    from page_events where created_at >= ${since} group by 1 order by 1`);
  await q("traffic by day (Mountain)", () => sql`
    select (created_at at time zone ${tz})::date::text as day, count(*)::int as views,
           count(distinct visitor_id)::int as visitors, count(distinct session_id)::int as sessions
    from page_events where created_at >= ${since} group by 1 order by 1`);
  await q("visitor loyalty: distinct days seen per visitor", () => sql`
    with v as (select visitor_id, count(distinct (created_at at time zone ${tz})::date) as days, count(*) as views,
                      bool_or(user_id is not null) as signed_in
               from page_events where created_at >= ${since} group by 1)
    select case when days = 1 then '1 day' when days = 2 then '2 days' when days <= 4 then '3-4 days'
                when days <= 9 then '5-9 days' else '10+ days' end as bucket,
           count(*)::int as visitors, sum(views)::int as views, count(*) filter (where signed_in)::int as signed_in
    from v group by 1 order by min(days)`);
  await q("new vs returning sessions by week", () => sql`
    with f as (select visitor_id, min(created_at) as first_at from page_events where created_at >= ${since} group by 1),
         s as (select session_id, visitor_id, min(created_at) as at from page_events where created_at >= ${since} group by 1, 2)
    select date_trunc('week', s.at at time zone ${tz})::date::text as week,
           count(*) filter (where s.at <= f.first_at + interval '30 minutes')::int as new_sessions,
           count(*) filter (where s.at > f.first_at + interval '30 minutes')::int as returning_sessions
    from s join f using (visitor_id) group by 1 order by 1`);
  await q("hour of day (Mountain): views, sessions", () => sql`
    select extract(hour from created_at at time zone ${tz})::int as hour, count(*)::int as views, count(distinct session_id)::int as sessions
    from page_events where created_at >= ${since} group by 1 order by 1`);
  await q("day of week (Mountain, 0=Sun)", () => sql`
    select extract(dow from created_at at time zone ${tz})::int as dow, count(*)::int as views, count(distinct session_id)::int as sessions
    from page_events where created_at >= ${since} group by 1 order by 1`);
  await q("geography: region (sessions)", () => sql`
    select coalesce(country, '?') as country, coalesce(region, '?') as region, count(distinct session_id)::int as sessions,
           count(distinct visitor_id)::int as visitors
    from page_events where created_at >= ${since} group by 1, 2 order by 3 desc limit 20`);
  await q("geography: Utah cities (sessions)", () => sql`
    select coalesce(city, '?') as city, count(distinct session_id)::int as sessions, count(distinct visitor_id)::int as visitors
    from page_events where created_at >= ${since} and (region in ('UT', 'Utah') or region ilike 'utah')
    group by 1 order by 2 desc limit 25`);
  await q("device / os / browser (sessions)", () => sql`
    select device, os, browser, count(distinct session_id)::int as sessions
    from page_events where created_at >= ${since} group by 1, 2, 3 order by 4 desc limit 20`);
  await q("landing source x engagement", () => sql`
    with s as (select session_id, max(source) filter (where is_landing) as source, count(*) as views,
                      count(*) filter (where csc is not null) as products,
                      count(*) filter (where path = '/search' and search_query is not null) as searches,
                      extract(epoch from max(created_at) - min(created_at)) as secs
               from page_events where created_at >= ${since} group by 1)
    select coalesce(source, 'unknown') as source, count(*)::int as sessions,
           round(avg(views), 2)::float as views_per_session,
           round(100.0 * count(*) filter (where views = 1) / count(*), 1)::float as bounce_pct,
           round(100.0 * count(*) filter (where products > 0) / count(*), 1)::float as saw_product_pct,
           round(100.0 * count(*) filter (where searches > 0) / count(*), 1)::float as searched_pct,
           percentile_cont(0.5) within group (order by secs)::int as median_secs
    from s group by 1 order by 2 desc`);
  await q("referrer hosts (landing views)", () => sql`
    select coalesce(referrer_host, '(none)') as host, count(*)::int as sessions
    from page_events where created_at >= ${since} and is_landing group by 1 order by 2 desc limit 25`);
  await q("utm campaigns", () => sql`
    select utm_source, utm_medium, utm_campaign, count(distinct session_id)::int as sessions
    from page_events where created_at >= ${since} and (utm_source is not null or utm_campaign is not null)
    group by 1, 2, 3 order by 4 desc limit 20`);
  await q("landing pages (by page type)", () => sql`
    select case when path = '/' then '/' when path like '/product/%' then '/product/*' when path like '/search%' then '/search'
                when path like '/store%' then '/store*' else path end as page,
           count(*)::int as landings
    from page_events where created_at >= ${since} and is_landing group by 1 order by 2 desc limit 20`);
  await q("all pages by type (views, sessions)", () => sql`
    select case when path like '/product/%' then '/product/*' when path like '/store/%' then '/store/*'
                when path like '/drops%' then '/drops*' else path end as page,
           count(*)::int as views, count(distinct session_id)::int as sessions
    from page_events where created_at >= ${since} group by 1 order by 2 desc limit 30`);
  await q("session depth distribution", () => sql`
    with s as (select session_id, count(*) as views from page_events where created_at >= ${since} group by 1)
    select case when views = 1 then '1' when views = 2 then '2' when views <= 4 then '3-4' when views <= 9 then '5-9' else '10+' end as views,
           count(*)::int as sessions from s group by 1 order by min(views)`);
  await q("product views: stock state and rarity of what people look at", () => sql`
    select case when p.csc is null then 'unknown code' when p.in_stock then 'in stock' else 'out of stock' end as stock,
           coalesce(r.tier, 'unrated') as tier, count(*)::int as views, count(distinct e.visitor_id)::int as visitors,
           count(distinct e.csc)::int as products
    from page_events e left join products p on p.csc = e.csc left join product_rarity r on r.csc = e.csc and r.published
    where e.created_at >= ${since} and e.csc is not null group by 1, 2 order by 3 desc`);
  await q("top 25 viewed products (visitors)", () => sql`
    select e.csc, p.name, p.category, p.status, p.in_stock, p.current_price::float as price, r.tier,
           count(distinct e.visitor_id)::int as visitors, count(*)::int as views,
           (select count(*)::int from watchlist w where w.csc = e.csc) as watchers
    from page_events e left join products p on p.csc = e.csc left join product_rarity r on r.csc = e.csc and r.published
    where e.created_at >= ${since} and e.csc is not null group by 1, 2, 3, 4, 5, 6, 7 order by 8 desc limit 25`);
  await q("product-page category mix vs DABS sales mix", () => sql`
    with v as (select p.category, count(distinct e.visitor_id || e.csc) as interest
               from page_events e join products p on p.csc = e.csc where e.created_at >= ${since} group by 1),
         s as (select p.category, sum(m.dollars) as dollars
               from monthly_sales m join products p on p.csc = m.item_code
               where m.period_month = (select max(period_month) from sales_reports) group by 1)
    select coalesce(v.category, s.category) as category, coalesce(v.interest, 0)::int as visitor_product_pairs,
           round(100.0 * coalesce(v.interest, 0) / nullif(sum(v.interest) over (), 0), 1)::float as interest_pct,
           round(100.0 * coalesce(s.dollars, 0) / nullif(sum(s.dollars) over (), 0), 1)::float as sales_pct
    from v full join s on s.category = v.category order by 2 desc nulls last limit 25`);
  await q("searches: top 40 queries (sessions)", () => sql`
    select lower(trim(search_query)) as query, count(distinct session_id)::int as sessions
    from page_events where created_at >= ${since} and path = '/search' and search_query is not null and trim(search_query) <> ''
    group by 1 order by 2 desc limit 40`);
  await q("search lists shown: results distribution", () => sql`
    select view, case when results = 0 then '0' when results <= 3 then '1-3' when results <= 20 then '4-20' else '21+' end as results,
           count(*)::int as lists, count(distinct visitor_id)::int as visitors
    from discover_events where kind = 'shown' and surface = 'search' group by 1, 2 order by 1, min(results)`);
  await q("zero-result searches (distinct visitors)", () => sql`
    select lower(trim(query)) as query, count(distinct visitor_id)::int as visitors, count(*)::int as times
    from discover_events where kind = 'shown' and surface = 'search' and results = 0 and query is not null
    group by 1 order by 2 desc, 3 desc limit 40`);
  await q("search clicks by rank", () => sql`
    select least(rank, 11) as rank_capped, count(*)::int as clicks
    from discover_events where kind = 'click' and surface = 'search' and rank is not null group by 1 order by 1`);
  await q("discover_events by surface/view/kind", () => sql`
    select surface, view, kind, count(*)::int as events, count(distinct coalesce(visitor_id, user_id::text))::int as actors
    from discover_events group by 1, 2, 3 order by 1, 2, 3`);

  // ---------- Accounts, watches, alerts ----------
  await q("accounts", () => sql`
    select count(*)::int as users,
           count(*) filter (where created_at >= ${since})::int as since_tracking,
           count(*) filter (where last_sign_in_at is not null)::int as ever_signed_in,
           count(*) filter (where last_sign_in_at >= now() - interval '30 days')::int as signed_in_30d,
           count(*) filter (where email_confirmed_at is null)::int as unconfirmed,
           count(*) filter (where exists (select 1 from watchlist w where w.user_id = u.id))::int as with_watch,
           count(*) filter (where exists (select 1 from user_stores s where s.user_id = u.id))::int as with_home_store,
           count(*) filter (where exists (select 1 from alert_prefs a where a.user_id = u.id and a.allocated_email))::int as allocated_optin,
           count(*) filter (where exists (select 1 from alert_prefs a where a.user_id = u.id and not a.watchlist_email))::int as watch_email_off
    from auth.users u`);
  await q("accounts created by month", () => sql`
    select to_char(created_at at time zone ${tz}, 'YYYY-MM') as month, count(*)::int as users,
           count(*) filter (where last_sign_in_at is not null)::int as ever_signed_in
    from auth.users group by 1 order by 1`);
  await q("watches per user distribution", () => sql`
    with w as (select user_id, count(*) as n from watchlist group by 1)
    select case when n = 1 then '1' when n <= 3 then '2-3' when n <= 10 then '4-10' else '11+' end as watches,
           count(*)::int as users, sum(n)::int as total from w group by 1 order by min(n)`);
  await q("most-watched bottles + current state", () => sql`
    select w.csc, p.name, p.status, p.in_stock, p.store_qty, r.tier, count(*)::int as watchers,
           max(w.created_at)::date::text as latest_add,
           (select count(*)::int from inventory_events e where e.csc = w.csc and e.event_type = 'restock' and e.created_at >= now() - interval '60 days') as restocks_60d
    from watchlist w join products p on p.csc = w.csc left join product_rarity r on r.csc = w.csc and r.published
    group by 1, 2, 3, 4, 5, 6 order by 7 desc limit 25`);
  await q("watched bottles: share that restocked at least once since Sep 23", () => sql`
    with b as (select distinct csc from watchlist)
    select count(*)::int as watched_bottles,
           count(*) filter (where exists (select 1 from inventory_events e where e.csc = b.csc and e.event_type in ('restock','store_restock') and e.created_at >= '2026-09-23'))::int as any_restock,
           count(*) filter (where exists (select 1 from inventory_events e where e.csc = b.csc and e.event_type = 'restock' and e.created_at >= '2026-09-23'))::int as statewide_restock,
           count(*) filter (where (select in_stock from products p where p.csc = b.csc))::int as in_stock_now
    from b`);
  await q("home stores: most chosen", () => sql`
    select s.id, s.name, s.city, s.is_club, count(*)::int as users
    from user_stores u join stores s on s.id = u.store_id group by 1, 2, 3, 4 order by 5 desc limit 15`);
  await q("alert deliveries by month and event type", () => sql`
    select to_char(d.sent_at at time zone ${tz}, 'YYYY-MM') as month, e.event_type, count(*)::int as deliveries,
           count(distinct d.user_id)::int as users, count(distinct e.csc)::int as bottles
    from alert_deliveries d join inventory_events e on e.id = d.event_id group by 1, 2 order by 1, 2`);
  await q("alert lag: event created -> delivered (since Sep 23)", () => sql`
    select e.event_type, count(*)::int as n,
           percentile_cont(0.5) within group (order by extract(epoch from d.sent_at - e.created_at) / 60)::int as median_min,
           percentile_cont(0.9) within group (order by extract(epoch from d.sent_at - e.created_at) / 60)::int as p90_min
    from alert_deliveries d join inventory_events e on e.id = d.event_id
    where d.sent_at >= '2026-09-23' group by 1 order by 2 desc`);
  await q("email-driven sessions (utm_source=email or source Email)", () => sql`
    select (created_at at time zone ${tz})::date::text as day, count(distinct session_id)::int as sessions,
           count(*)::int as views
    from page_events where created_at >= ${since} and (utm_source = 'email' or source = 'Email') group by 1 order by 1`);
  await q("email signups by segment and month", () => sql`
    select coalesce(segment, '(none)') as segment, to_char(created_at at time zone ${tz}, 'YYYY-MM') as month, count(*)::int as n
    from email_signups group by 1, 2 order by 2, 1`);
  await q("email_signups that later made an account (by email match, counts only)", () => sql`
    select count(*)::int as signups,
           count(*) filter (where exists (select 1 from auth.users u where lower(u.email) = lower(s.email)))::int as have_account
    from email_signups s`);
  await q("rating feedback (counts by tier shown)", () => sql`
    select coalesce(tier_shown, 'unrated') as tier, count(*)::int as notes, count(distinct csc)::int as bottles
    from rating_feedback group by 1 order by 2 desc`);
  await q("rating feedback texts (most recent 15, trimmed)", () => sql`
    select created_at::date::text as day, csc, tier_shown, left(message, 160) as message
    from rating_feedback order by created_at desc limit 15`);
  await q("taste (AI picks) usage", () => sql`
    select kind, mode, count(*)::int as events, count(distinct visitor_id)::int as visitors,
           percentile_cont(0.5) within group (order by model_ms)::int as median_model_ms,
           sum(input_tokens)::int as input_tokens, sum(output_tokens)::int as output_tokens,
           count(*) filter (where model_ok = false)::int as model_failures,
           count(*) filter (where useful)::int as useful_yes, count(*) filter (where useful = false)::int as useful_no
    from taste_events group by 1, 2 order by 1, 2`);

  // ---------- Market ----------
  await q("catalog now", () => sql`
    select count(*)::int as products, count(*) filter (where in_stock)::int as in_stock,
           count(*) filter (where status = 'D')::int as delisted_d, count(distinct category)::int as categories,
           sum(store_qty) filter (where in_stock)::bigint as bottles_on_store_shelves,
           sum(warehouse_qty)::bigint as bottles_in_warehouse, sum(on_order_qty)::bigint as bottles_on_order,
           round(sum(store_qty * current_price) filter (where in_stock))::bigint as shelf_value_usd
    from products`);
  await q("catalog by status code", () => sql`
    select status, count(*)::int as products, count(*) filter (where in_stock)::int as in_stock,
           round(avg(current_price), 2)::float as avg_price
    from products group by 1 order by 2 desc`);
  await q("inventory events by week and type", () => sql`
    select date_trunc('week', created_at at time zone ${tz})::date::text as week, event_type, count(*)::int as n
    from inventory_events where created_at >= '2026-09-01' group by 1, 2 order by 1, 2`);
  await q("restock -> statewide sellout: hours by status (since Sep 23)", () => sql`
    with r as (select e.csc, e.created_at as at, p.status, p.category
               from inventory_events e join products p on p.csc = e.csc
               where e.event_type = 'restock' and e.created_at >= '2026-09-23'),
         o as (select r.*, (select min(x.created_at) from inventory_events x where x.csc = r.csc and x.event_type = 'out_of_stock' and x.created_at > r.at) as out_at
               from r)
    select status, count(*)::int as restocks, count(out_at)::int as sold_out_again,
           percentile_cont(0.5) within group (order by extract(epoch from out_at - at) / 3600)::float as median_hours,
           percentile_cont(0.25) within group (order by extract(epoch from out_at - at) / 3600)::float as p25_hours
    from o group by 1 order by 2 desc`);
  await q("fastest sellouts since Sep 23 (restock -> statewide out_of_stock)", () => sql`
    with r as (select e.csc, e.created_at as at, (e.detail->>'qty')::int as qty from inventory_events e
               where e.event_type = 'restock' and e.created_at >= '2026-09-23'),
         o as (select r.*, (select min(x.created_at) from inventory_events x where x.csc = r.csc and x.event_type = 'out_of_stock' and x.created_at > r.at) as out_at from r)
    select o.csc, p.name, p.status, o.qty, o.at::text as restocked, round(extract(epoch from out_at - o.at) / 3600, 1)::float as hours
    from o join products p on p.csc = o.csc where out_at is not null order by hours asc limit 20`);
  await q("most frequently restocked bottles since Sep 23", () => sql`
    select e.csc, p.name, p.status, count(*)::int as restocks
    from inventory_events e join products p on p.csc = e.csc
    where e.event_type = 'restock' and e.created_at >= '2026-09-23' group by 1, 2, 3 order by 4 desc limit 15`);
  await q("restocks by hour of day and weekday (Mountain, catalog detection time)", () => sql`
    select extract(dow from created_at at time zone ${tz})::int as dow, count(*)::int as restocks
    from inventory_events where event_type = 'restock' and created_at >= '2026-09-23' group by 1 order by 1`);
  await q("price changes since Sep 1: direction and size", () => sql`
    select case when (detail->>'new')::numeric > (detail->>'old')::numeric then 'up' else 'down' end as dir,
           count(*)::int as n, round(avg(abs((detail->>'new')::numeric - (detail->>'old')::numeric)), 2)::float as avg_usd,
           round(avg(100 * abs((detail->>'new')::numeric - (detail->>'old')::numeric) / nullif((detail->>'old')::numeric, 0)), 1)::float as avg_pct
    from inventory_events where event_type = 'price_change' and created_at >= '2026-09-01' group by 1`);
  await q("biggest price changes since Sep 1", () => sql`
    select e.csc, p.name, (detail->>'old')::float as old, (detail->>'new')::float as new, e.created_at::date::text as day
    from inventory_events e left join products p on p.csc = e.csc
    where event_type = 'price_change' and created_at >= '2026-09-01'
    order by abs((detail->>'new')::numeric - (detail->>'old')::numeric) desc limit 12`);
  await q("new products by month and category (top)", () => sql`
    select to_char(e.created_at at time zone ${tz}, 'YYYY-MM') as month, p.category, count(*)::int as n
    from inventory_events e join products p on p.csc = e.csc where e.event_type = 'new_product'
    group by 1, 2 having count(*) >= 3 order by 1, 3 desc`);
  await q("DABS sales by month (all lines)", () => sql`
    select period_month::text, fiscal_label, sum_dollars::float as dollars, sum_bottles as bottles, item_codes
    from sales_reports order by 1`);
  await q("DABS sales: category share, latest month vs same month a year earlier", () => sql`
    with m as (select max(period_month) as cur from sales_reports)
    select coalesce(class_name, '?') as class, round(sum(dollars) filter (where period_month = (select cur from m)))::bigint as cur_usd,
           round(sum(dollars) filter (where period_month = (select cur from m) - interval '1 year'))::bigint as prev_usd
    from monthly_sales group by 1 order by 2 desc nulls last limit 25`);
  await q("DABS sales: top 20 items latest month by dollars", () => sql`
    select item_code, item_name, class_name, size_ml, bottles, dollars::float
    from monthly_sales where period_month = (select max(period_month) from sales_reports) order by dollars desc nulls last limit 20`);
  await q("DABS sales: price band of bottles sold latest month (dollars/bottle)", () => sql`
    select case when dollars / nullif(bottles, 0) < 15 then '<$15' when dollars / nullif(bottles, 0) < 30 then '$15-30'
                when dollars / nullif(bottles, 0) < 60 then '$30-60' when dollars / nullif(bottles, 0) < 120 then '$60-120' else '$120+' end as band,
           sum(bottles)::bigint as bottles, round(sum(dollars))::bigint as dollars
    from monthly_sales where period_month = (select max(period_month) from sales_reports) and bottles > 0 group by 1 order by min(dollars / nullif(bottles, 0))`);
  await q("drawings (RHDP): odds = entries per bottle", () => sql`
    select drawing, product_name, price::float, bottles, entries, round(entries::numeric / nullif(bottles, 0), 1)::float as entries_per_bottle, section
    from rhdp_drawings where entries is not null order by entries_per_bottle desc nulls last limit 30`);
  await q("drawings summary", () => sql`
    select section, count(*)::int as items, sum(bottles)::int as bottles, sum(entries)::int as entries
    from rhdp_drawings group by 1`);
  await q("allocated drops by county and month", () => sql`
    select coalesce(county, '?') as county, count(*)::int as drops, sum(bottle_qty)::int as bottles, count(distinct store_id)::int as stores
    from allocated_drops where drop_type = 'allocated' group by 1 order by 2 desc`);
  await q("allocated drops: stores that get the most", () => sql`
    select s.id, s.name, s.city, count(*)::int as drops, sum(a.bottle_qty)::int as bottles
    from allocated_drops a join stores s on s.id = a.store_id where a.drop_type = 'allocated' group by 1, 2, 3 order by 4 desc limit 15`);
  await q("allocated drops: by weekday (drop_date)", () => sql`
    select extract(dow from drop_date)::int as dow, count(*)::int as drops from allocated_drops where drop_date is not null and drop_type = 'allocated' group by 1 order by 1`);
  await q("allocated drops by month", () => sql`
    select to_char(drop_date, 'YYYY-MM') as month, count(*)::int as drops, sum(bottle_qty)::int as bottles, count(distinct product_name)::int as products
    from allocated_drops where drop_type = 'allocated' group by 1 order by 1`);
  await q("stores: breadth of current stock (distinct in-stock products per store)", () => sql`
    select s.id, s.name, s.city, s.is_club, count(*)::int as products, sum(c.qty)::int as bottles
    from store_inventory_current c join stores s on s.id = c.store_id
    where c.qty > 0 and c.scraped_at >= now() - interval '7 days' group by 1, 2, 3, 4 order by 5 desc limit 12`);
  await q("stores: narrowest current stock", () => sql`
    select s.id, s.name, s.city, s.is_club, count(*)::int as products, sum(c.qty)::int as bottles
    from store_inventory_current c join stores s on s.id = c.store_id
    where c.qty > 0 and c.scraped_at >= now() - interval '7 days' group by 1, 2, 3, 4 order by 5 asc limit 8`);
  await q("stores: rare/scarce bottles on shelf now (published tier)", () => sql`
    select s.id, s.name, s.city, count(*)::int as rare_products, sum(c.qty)::int as bottles
    from store_inventory_current c join stores s on s.id = c.store_id join product_rarity r on r.csc = c.csc and r.published
    where c.qty > 0 and c.scraped_at >= now() - interval '3 days' and r.tier in ('scarce', 'rare', 'unicorn') and not s.is_club
    group by 1, 2, 3 order by 4 desc limit 12`);
  await q("store_restock events by store since Sep 23 (top)", () => sql`
    select (e.detail->>'store_id')::int as store_id, s.name, s.city, count(*)::int as restocks
    from inventory_events e left join stores s on s.id = (e.detail->>'store_id')::int
    where e.event_type = 'store_restock' and e.created_at >= '2026-09-23' group by 1, 2, 3 order by 4 desc limit 12`);
  await q("rarity tiers", () => sql`
    select coalesce(tier, '(facts only)') as tier, published, count(*)::int as products from product_rarity group by 1, 2 order by 3 desc`);

  // ---------- System ----------
  await q("jobs since Sep 23: runs, success, duration", () => sql`
    select job, count(*)::int as runs, count(*) filter (where ok)::int as ok, count(*) filter (where ok = false)::int as failed,
           count(*) filter (where finished_at is null)::int as unfinished,
           percentile_cont(0.5) within group (order by extract(epoch from finished_at - started_at))::int as median_secs,
           max(extract(epoch from finished_at - started_at))::int as max_secs
    from scrape_runs where started_at >= '2026-09-23' group by 1 order by 2 desc`);
  await q("failed job errors since Sep 23 (grouped)", () => sql`
    select job, left(detail->>'error', 120) as error, count(*)::int as n, max(started_at)::text as last
    from scrape_runs where started_at >= '2026-09-23' and ok = false group by 1, 2 order by 3 desc limit 15`);
  await q("store checks by day: volume, success, DABS time", () => sql`
    select (created_at at time zone ${tz})::date::text as day, count(*)::int as checks, count(*) filter (where ok)::int as ok,
           count(*) filter (where source = 'on_demand')::int as on_demand,
           percentile_cont(0.5) within group (order by ms)::int as median_ms, percentile_cont(0.95) within group (order by ms)::int as p95_ms,
           round(avg(changed_stores) filter (where ok), 2)::float as avg_changed_stores
    from store_checks group by 1 order by 1`);
  await q("store checks: how often a check finds any change", () => sql`
    select source, count(*) filter (where ok)::int as ok_checks,
           round(100.0 * count(*) filter (where ok and changed_stores > 0) / nullif(count(*) filter (where ok and prev_checked_at is not null), 0), 1)::float as pct_with_change,
           round(avg(extract(epoch from created_at - prev_checked_at) / 3600) filter (where ok), 1)::float as avg_hours_since_prev
    from store_checks group by 1`);
  await q("store checks: errors", () => sql`
    select left(coalesce(error, '?'), 80) as error, count(*)::int as n from store_checks where not ok group by 1 order by 2 desc limit 10`);
  await q("rate limits hit (keys by prefix, last 30 days)", () => sql`
    select split_part(key, ':', 1) as kind, count(*)::int as windows, sum(count)::int as requests, max(count)::int as max_in_window
    from rate_limits where window_start >= now() - interval '30 days' group by 1 order by 3 desc`);

  return sql.end();
}
