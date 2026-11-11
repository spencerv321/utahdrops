/**
 * Traffic spike report (report.yml → `spike` or `spike:YYYY-MM-DD`): one Mountain
 * day against the 14 days before it, broken down by where visitors came from,
 * what they landed on and where they are. Aggregates only: no emails, no user ids.
 */
type Sql = typeof import("../lib/db").sql;

export async function spikeReport(sql: Sql, dayArg?: string) {
  const tz = "America/Denver";
  const [{ day }] = await sql<{ day: string }[]>`
    select coalesce(${dayArg ?? null}::date, (now() at time zone ${tz})::date)::text as day`;
  const show = async (title: string, run: () => Promise<unknown>) => {
    try {
      const rows = await run();
      console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
    } catch (err) {
      console.log(`\n## ${title}\nERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  await sql`set statement_timeout = '60s'`;
  console.log(`Spike report for ${day} (Mountain) vs the 14 days before`);

  // e: events tagged as the spike day ('day') or the baseline ('base').
  const e = sql`(
    select *, case when (created_at at time zone ${tz})::date = ${day}::date then 'day' else 'base' end as win
    from page_events
    where created_at >= (${day}::date - 14)::timestamp at time zone ${tz}
      and created_at < (${day}::date + 1)::timestamp at time zone ${tz}
  ) e`;

  await show("daily totals (last 15 days)", () => sql`
    select (created_at at time zone ${tz})::date::text as day, to_char((created_at at time zone ${tz})::date, 'Dy') as dow,
           count(*)::int as views, count(distinct visitor_id)::int as visitors, count(distinct session_id)::int as sessions,
           count(distinct visitor_id) filter (where user_id is not null)::int as signed_in
    from ${e} group by 1, 2 order by 1`);
  await show("spike day by hour (Mountain)", () => sql`
    select extract(hour from created_at at time zone ${tz})::int as hour, count(*)::int as views,
           count(distinct session_id)::int as sessions, count(*) filter (where is_landing)::int as landings
    from ${e} where win = 'day' group by 1 order by 1`);
  await show("landing sessions by source: spike day vs baseline daily avg", () => sql`
    select coalesce(source, 'unknown') as source,
           count(*) filter (where win = 'day')::int as day,
           round(count(*) filter (where win = 'base') / 14.0, 1)::float as base_avg
    from ${e} where is_landing group by 1 order by 2 desc`);
  await show("landing sessions by referrer host", () => sql`
    select coalesce(referrer_host, '(none)') as referrer,
           count(*) filter (where win = 'day')::int as day,
           round(count(*) filter (where win = 'base') / 14.0, 1)::float as base_avg
    from ${e} where is_landing group by 1 order by 2 desc limit 25`);
  await show("utm tags on spike day", () => sql`
    select utm_source, utm_medium, utm_campaign, count(*)::int as sessions
    from ${e} where win = 'day' and is_landing and (utm_source is not null or utm_campaign is not null)
    group by 1, 2, 3 order by 4 desc limit 20`);
  await show("landing pages", () => sql`
    select path, count(*) filter (where win = 'day')::int as day,
           round(count(*) filter (where win = 'base') / 14.0, 1)::float as base_avg
    from ${e} where is_landing group by 1 order by 2 desc limit 25`);
  await show("landing page x source on spike day", () => sql`
    select path, coalesce(source, 'unknown') as source, coalesce(referrer_host, '(none)') as referrer, count(*)::int as sessions
    from ${e} where win = 'day' and is_landing group by 1, 2, 3 order by 4 desc limit 30`);
  await show("first landing hour per source on spike day", () => sql`
    select coalesce(source, 'unknown') as source, min(created_at at time zone ${tz})::text as first, max(created_at at time zone ${tz})::text as last,
           count(*)::int as sessions
    from ${e} where win = 'day' and is_landing group by 1 order by 4 desc`);
  await show("region / city", () => sql`
    select coalesce(region, '?') as region, coalesce(city, '?') as city,
           count(distinct visitor_id) filter (where win = 'day')::int as day_visitors,
           round(count(distinct visitor_id) filter (where win = 'base') / 14.0, 1)::float as base_avg
    from ${e} group by 1, 2 order by 3 desc limit 20`);
  await show("device", () => sql`
    select coalesce(device, '?') as device, count(distinct visitor_id) filter (where win = 'day')::int as day_visitors,
           round(count(distinct visitor_id) filter (where win = 'base') / 14.0, 1)::float as base_avg
    from ${e} group by 1 order by 2 desc`);
  await show("new vs returning visitors on spike day", () => sql`
    with d as (select distinct visitor_id from ${e} where win = 'day'),
         seen as (select distinct visitor_id from page_events
                  where created_at < ${day}::date::timestamp at time zone ${tz})
    select count(*) filter (where s.visitor_id is null)::int as new, count(*) filter (where s.visitor_id is not null)::int as returning
    from d left join seen s using (visitor_id)`);
  await show("engagement: views per session", () => sql`
    with s as (select session_id, win, count(*) as v from ${e} group by 1, 2)
    select win, count(*)::int as sessions, round(avg(v), 2)::float as avg_views,
           count(*) filter (where v = 1)::int as one_view
    from s group by 1 order by 1`);
  await show("top products viewed on spike day", () => sql`
    select e.csc, p.name, count(*)::int as views, count(distinct e.session_id)::int as sessions
    from ${e} left join products p on p.csc = e.csc
    where win = 'day' and e.csc is not null group by 1, 2 order by 3 desc limit 20`);
  await show("top searches on spike day", () => sql`
    select lower(trim(search_query)) as q, count(*)::int as n
    from ${e} where win = 'day' and path = '/search' and coalesce(trim(search_query), '') <> ''
    group by 1 order by 2 desc limit 25`);
  await show("top paths on spike day", () => sql`
    select path, count(*)::int as views from ${e} where win = 'day' group by 1 order by 2 desc limit 25`);

  await show("accounts created per day (last 15)", () => sql`
    select (created_at at time zone ${tz})::date::text as day, count(*)::int as n,
           count(*) filter (where email_confirmed_at is not null)::int as confirmed
    from auth.users where created_at >= (${day}::date - 14)::timestamp at time zone ${tz}
      and created_at < (${day}::date + 1)::timestamp at time zone ${tz}
    group by 1 order by 1`);
  await show("spike-day sign-ups: how they arrived (landing of their first session)", () => sql`
    with u as (select id, created_at from auth.users
               where (created_at at time zone ${tz})::date = ${day}::date),
         v as (select distinct u.id, pe.visitor_id from u join page_events pe on pe.user_id = u.id),
         l as (select distinct on (v.id) v.id, pe.created_at, pe.path, pe.source, pe.referrer_host, pe.utm_source, pe.city
               from v join page_events pe on pe.visitor_id = v.visitor_id and pe.is_landing
               order by v.id, pe.created_at)
    select row_number() over (order by u.created_at)::int as n, (u.created_at at time zone ${tz})::text as created,
           (l.created_at at time zone ${tz})::text as first_landing, l.path, l.source, l.referrer_host, l.utm_source, l.city,
           (select count(*)::int from watchlist w where w.user_id = u.id) as watches
    from u left join l on l.id = u.id order by u.created_at`);
  await show("email signups per day", () => sql`
    select (created_at at time zone ${tz})::date::text as day, count(*)::int as n from email_signups
    where created_at >= (${day}::date - 14)::timestamp at time zone ${tz} group by 1 order by 1`);
  await show("watches added per day", () => sql`
    select (created_at at time zone ${tz})::date::text as day, count(*)::int as n from watchlist
    where created_at >= (${day}::date - 14)::timestamp at time zone ${tz} group by 1 order by 1`);
  await show("alert emails per day", () => sql`
    select (sent_at at time zone ${tz})::date::text as day, count(*)::int as n from alert_deliveries
    where sent_at >= (${day}::date - 14)::timestamp at time zone ${tz} group by 1 order by 1`);
  await show("inventory events per day by type", () => sql`
    select (created_at at time zone ${tz})::date::text as day, event_type, count(*)::int as n from inventory_events
    where created_at >= (${day}::date - 7)::timestamp at time zone ${tz} group by 1, 2 order by 1, 2`);
  await show("spike-day restocks / new arrivals (top by views)", () => sql`
    select ie.event_type, ie.csc, p.name, (ie.created_at at time zone ${tz})::text as at
    from inventory_events ie join products p on p.csc = ie.csc
    where (ie.created_at at time zone ${tz})::date = ${day}::date and ie.event_type in ('new_product', 'restock')
    order by ie.created_at limit 40`);
  return sql.end();
}
