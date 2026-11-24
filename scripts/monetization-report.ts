/**
 * Who uses Utah Drops, and how much: the numbers behind pricing decisions
 * (docs/pricing-2026.md). Counts and distributions only; no emails or ids.
 * "Tracked" users appear in page_events (admins are never tracked there).
 */
export async function monetizationReport(sql: typeof import("../lib/db").sql) {
  const show = (t: string, rows: unknown) => console.log(`\n## ${t}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  const tracked = sql`select distinct user_id from page_events where user_id is not null`;

  show("accounts", await sql`
    select count(*)::int as accounts,
           count(*) filter (where email ~* '\\+test[^@]*@')::int as test_accounts,
           count(*) filter (where id in (${tracked}))::int as tracked,
           count(*) filter (where last_sign_in_at > now() - interval '30 days')::int as signed_in_30d,
           count(*) filter (where created_at > now() - interval '30 days')::int as new_30d,
           count(*) filter (where exists (select 1 from watchlist w where w.user_id = u.id))::int as with_watches,
           count(*) filter (where exists (select 1 from user_stores s where s.user_id = u.id))::int as with_home_store,
           (select count(*)::int from email_signups) as footer_signups
    from auth.users u`);
  show("accounts by month created", await sql`
    select to_char(created_at at time zone 'America/Denver', 'YYYY-MM') as month, count(*)::int as accounts
    from auth.users group by 1 order by 1`);
  show("watches per user (distribution; tracked = not admin)", await sql`
    with w as (select user_id, count(*)::int as n from watchlist group by 1)
    select case when n = 1 then 'a 1' when n <= 3 then 'b 2-3' when n <= 9 then 'c 4-9' when n <= 24 then 'd 10-24' else 'e 25+' end as watches,
           count(*)::int as users, count(*) filter (where user_id in (${tracked}))::int as tracked_users, sum(n)::int as total_watches
    from w group by 1 order by 1`);
  show("watch totals", await sql`
    select sum(n)::int as watches, count(*)::int as users, (select count(distinct csc)::int from watchlist) as bottles,
           max(n)::int as max_per_user, percentile_cont(0.5) within group (order by n)::float8 as median_per_user
    from (select user_id, count(*) as n from watchlist group by 1) x`);
  show("watches added by week", await sql`
    select to_char(date_trunc('week', created_at at time zone 'America/Denver'), 'YYYY-MM-DD') as week,
           count(*)::int as watches, count(distinct user_id)::int as users
    from watchlist where created_at > now() - interval '12 weeks' group by 1 order by 1`);
  show("alert prefs", await sql`
    select count(*)::int as users_with_prefs,
           count(*) filter (where watchlist_email)::int as watchlist_email_on,
           count(*) filter (where allocated_email)::int as allocated_email_on
    from alert_prefs`);
  show("alerts delivered by week and event type", await sql`
    select to_char(date_trunc('week', d.sent_at at time zone 'America/Denver'), 'YYYY-MM-DD') as week, e.event_type,
           count(*)::int as alerts, count(distinct d.user_id)::int as users
    from alert_deliveries d join inventory_events e on e.id = d.event_id
    where d.sent_at > now() - interval '12 weeks' group by 1, 2 order by 1, 2`);
  show("alert email visits (landings with utm_source=email) by week", await sql`
    select to_char(date_trunc('week', created_at at time zone 'America/Denver'), 'YYYY-MM-DD') as week,
           coalesce(utm_medium, '?') as medium, count(*)::int as landings, count(distinct coalesce(user_id::text, visitor_id))::int as people
    from page_events where is_landing and utm_source = 'email' and created_at > now() - interval '12 weeks'
    group by 1, 2 order by 1, 2`);
  show("Check DABS now by week (store_checks on_demand; people not stored, bottles are)", await sql`
    select to_char(date_trunc('week', created_at at time zone 'America/Denver'), 'YYYY-MM-DD') as week,
           count(*)::int as checks, count(distinct csc)::int as bottles, count(*) filter (where not ok)::int as failed
    from store_checks where source = 'on_demand' group by 1 order by 1`);
  show("Check DABS now limits hit, last 2 days (rate_limits windows over the cap)", await sql`
    select count(*) filter (where key like 'check:ip:%')::int as ip_hour_windows,
           count(*) filter (where key like 'check:ip:%' and count > 12)::int as ip_hour_windows_over_cap,
           max(count) filter (where key like 'check:ip:%')::int as max_taps_one_ip_hour,
           max(count) filter (where key = 'check:day')::int as max_daily_total
    from rate_limits`);
  show("traffic by week (people = distinct visitors; signed-in = distinct users)", await sql`
    select to_char(date_trunc('week', created_at at time zone 'America/Denver'), 'YYYY-MM-DD') as week,
           count(*)::int as views, count(distinct session_id)::int as sessions, count(distinct visitor_id)::int as visitors,
           count(distinct user_id)::int as signed_in_users,
           count(distinct visitor_id) filter (where region = 'UT' or region = 'Utah')::int as utah_visitors
    from page_events where created_at > now() - interval '12 weeks' group by 1 order by 1`);
  show("visitors last 30 days: new vs returning (returning = >1 day with a visit)", await sql`
    with v as (
      select visitor_id, count(distinct (created_at at time zone 'America/Denver')::date) as days,
             count(distinct session_id) as sessions, bool_or(user_id is not null) as signed_in
      from page_events where created_at > now() - interval '30 days' group by 1
    )
    select count(*)::int as visitors,
           count(*) filter (where days = 1)::int as one_day,
           count(*) filter (where days between 2 and 4)::int as days_2_4,
           count(*) filter (where days >= 5)::int as days_5_plus,
           count(*) filter (where days >= 10)::int as days_10_plus,
           count(*) filter (where signed_in)::int as signed_in
    from v`);
  show("landing sources, last 30 days (sessions)", await sql`
    select coalesce(source, 'unknown') as source, count(*)::int as sessions, count(distinct visitor_id)::int as visitors
    from page_events where is_landing and created_at > now() - interval '30 days' group by 1 order by 2 desc`);
  show("top referrers, last 30 days", await sql`
    select referrer_host, count(*)::int as sessions
    from page_events where is_landing and referrer_host is not null and created_at > now() - interval '30 days'
    group by 1 order by 2 desc limit 20`);
  show("devices and region, last 30 days (visitors)", await sql`
    select device, (region in ('UT', 'Utah')) as utah, count(distinct visitor_id)::int as visitors
    from page_events where created_at > now() - interval '30 days' group by 1, 2 order by 3 desc`);
  show("feature use, last 30 days (by first path segment)", await sql`
    select '/' || split_part(path, '/', 2) as section, count(*)::int as views,
           count(distinct visitor_id)::int as visitors, count(distinct user_id)::int as signed_in_users
    from page_events where created_at > now() - interval '30 days' group by 1 order by 3 desc limit 30`);
  show("discover_events by surface and kind, last 30 days", await sql`
    select surface, kind, count(*)::int as events, count(distinct coalesce(visitor_id, user_id::text))::int as actors
    from discover_events where created_at > now() - interval '30 days' group by 1, 2 order by 3 desc limit 40`);
  show("power users (tracked, anonymised): top 15 by days active in 30 days", await sql`
    with u as (
      select user_id, count(distinct (created_at at time zone 'America/Denver')::date)::int as active_days,
             count(*)::int as views, count(*) filter (where csc is not null)::int as product_views,
             count(*) filter (where search_query is not null)::int as searches,
             count(*) filter (where path like '/drawings%' or path like '/drops%')::int as drawing_views,
             mode() within group (order by device) as device
      from page_events where user_id is not null and created_at > now() - interval '30 days' group by 1
    )
    select row_number() over (order by active_days desc, views desc)::int as n, active_days, views, product_views, searches, drawing_views, device,
           (select count(*)::int from watchlist w where w.user_id = u.user_id) as watches,
           (select count(*)::int from alert_deliveries d where d.user_id = u.user_id and d.sent_at > now() - interval '30 days') as alerts_30d,
           exists (select 1 from user_stores s where s.user_id = u.user_id) as home_store
    from u order by active_days desc, views desc limit 15`);
  show("what watchers watch: category and price band of watched bottles", await sql`
    select coalesce(p.category, '?') as category,
           case when p.current_price is null then '?' when p.current_price < 30 then 'a <$30' when p.current_price < 60 then 'b $30-59'
                when p.current_price < 120 then 'c $60-119' else 'd $120+' end as price_band,
           count(*)::int as watches, count(distinct w.user_id)::int as users
    from watchlist w join products p using (csc) group by 1, 2 order by 3 desc limit 25`);
  return sql.end();
}
