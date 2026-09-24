import { sql } from "@/lib/db";
import { SOURCE_KIND } from "@/lib/analytics";

/**
 * Aggregations for /admin. Days are Mountain time. Each range is compared
 * with the same stretch just before it (for "today", yesterday up to this
 * time of day), so the deltas are like for like.
 */
export const TZ = "America/Denver";

export const RANGES = {
  today: { label: "Today", days: 1 },
  "7d": { label: "7 days", days: 7 },
  "30d": { label: "30 days", days: 30 },
  "90d": { label: "90 days", days: 90 },
} as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(v: string | undefined): RangeKey {
  return v && v in RANGES ? (v as RangeKey) : "7d";
}

export type Kpis = {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounced: number;
  avgSessionSec: number;
  newVisitors: number;
  signedIn: number;
  signups: number;
  watches: number;
};

export type Point = { t: string; visitors: number; pageviews: number; signups: number };
export type Row = { label: string; value: number; sub?: string | null; href?: string | null };
export type LiveVisitor = { path: string; city: string | null; source: string | null; device: string | null; seconds: number };

const n = (v: unknown) => Number(v ?? 0);

async function kpis(start: Date, end: Date): Promise<Kpis> {
  const [[t], [u]] = await Promise.all([
    sql`
      with e as (select * from page_events where created_at >= ${start} and created_at < ${end}),
      s as (
        select session_id, count(*) as views,
               extract(epoch from max(created_at) - min(created_at)) as secs
        from e group by session_id
      )
      select
        (select count(distinct visitor_id) from e) as visitors,
        (select count(*) from e) as pageviews,
        (select count(*) from s) as sessions,
        (select count(*) from s where views = 1) as bounced,
        (select coalesce(avg(secs), 0) from s) as avg_secs,
        (select count(distinct user_id) from e) as signed_in,
        (select count(*) from (
           select visitor_id from page_events
           where visitor_id in (select distinct visitor_id from e)
           group by visitor_id having min(created_at) >= ${start}
        ) nv) as new_visitors`,
    sql`
      select
        (select count(*) from auth.users where created_at >= ${start} and created_at < ${end}) as signups,
        (select count(*) from watchlist where created_at >= ${start} and created_at < ${end}) as watches`,
  ]);
  return {
    visitors: n(t.visitors),
    pageviews: n(t.pageviews),
    sessions: n(t.sessions),
    bounced: n(t.bounced),
    avgSessionSec: n(t.avg_secs),
    newVisitors: n(t.new_visitors),
    signedIn: n(t.signed_in),
    signups: n(u.signups),
    watches: n(u.watches),
  };
}

async function series(start: Date, hourly: boolean): Promise<Point[]> {
  const unit = hourly ? "hour" : "day";
  const rows = await sql`
    with buckets as (
      select generate_series(
        date_trunc(${unit}, ${start}::timestamptz at time zone ${TZ}),
        date_trunc(${unit}, now() at time zone ${TZ}),
        ${hourly ? "1 hour" : "1 day"}::interval
      ) as b
    ),
    pv as (
      select date_trunc(${unit}, created_at at time zone ${TZ}) as b,
             count(*) as pageviews, count(distinct visitor_id) as visitors
      from page_events where created_at >= ${start} group by 1
    ),
    su as (
      select date_trunc(${unit}, created_at at time zone ${TZ}) as b, count(*) as signups
      from auth.users where created_at >= ${start} group by 1
    )
    select to_char(buckets.b, 'YYYY-MM-DD"T"HH24:MI') as t,
           coalesce(pv.visitors, 0) as visitors, coalesce(pv.pageviews, 0) as pageviews,
           coalesce(su.signups, 0) as signups
    from buckets left join pv using (b) left join su using (b)
    order by buckets.b`;
  return rows.map((r) => ({ t: r.t, visitors: n(r.visitors), pageviews: n(r.pageviews), signups: n(r.signups) }));
}

const rows = (rs: Record<string, unknown>[]): Row[] =>
  rs.map((r) => ({
    label: String(r.label ?? "—"),
    value: n(r.value),
    sub: (r.sub as string | null) ?? null,
    href: (r.href as string | null) ?? null,
  }));

export async function getDashboard(range: RangeKey) {
  const days = RANGES[range].days;
  const [b] = await sql`
    select
      ((date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ}) as start,
      now() as now`;
  const start: Date = b.start;
  const now: Date = b.now;
  const prevStart = new Date(start.getTime() - days * 86_400_000);
  const prevEnd = new Date(now.getTime() - days * 86_400_000);
  const since = sql`created_at >= ${start}`;

  const [
    current,
    previous,
    points,
    live,
    sources,
    referrers,
    campaigns,
    pages,
    landings,
    products,
    searches,
    devices,
    browsers,
    cities,
    countries,
    hours,
  ] = await Promise.all([
    kpis(start, now),
    kpis(prevStart, prevEnd),
    series(start, range === "today"),
    sql`
      select distinct on (visitor_id) visitor_id, coalesce(p.name, e.path) as path, e.city, e.device,
             (select source from page_events l where l.session_id = e.session_id and l.is_landing limit 1) as source,
             extract(epoch from now() - e.created_at)::int as seconds
      from page_events e left join products p using (csc)
      where e.created_at > now() - interval '5 minutes'
      order by visitor_id, e.created_at desc`,
    sql`
      select coalesce(source, 'Direct') as label, count(*) as value
      from page_events where ${since} and is_landing group by 1 order by 2 desc limit 12`,
    sql`
      select referrer_host as label, count(*) as value
      from page_events where ${since} and is_landing and referrer_host is not null
      group by 1 order by 2 desc limit 10`,
    sql`
      select concat_ws(' / ', utm_source, utm_medium, utm_campaign) as label, count(*) as value
      from page_events where ${since} and is_landing and utm_source is not null
      group by 1 order by 2 desc limit 8`,
    sql`
      select case when path like '/product/%' then '/product/…' else path end as label,
             count(*) as value, count(distinct visitor_id)::text || ' visitors' as sub
      from page_events where ${since} group by 1 order by 2 desc limit 10`,
    sql`
      select case when path like '/product/%' then '/product/…' else path end as label, count(*) as value
      from page_events where ${since} and is_landing group by 1 order by 2 desc limit 8`,
    sql`
      select coalesce(p.name, e.csc) as label, count(*) as value,
             count(distinct e.visitor_id)::text || ' visitors' as sub, '/product/' || e.csc as href
      from page_events e left join products p using (csc)
      where e.created_at >= ${start} and e.csc is not null
      group by e.csc, p.name order by 2 desc limit 10`,
    sql`
      select min(lower(trim(search_query))) as label, count(*) as value
      from page_events where ${since} and search_query is not null and trim(search_query) <> ''
      group by regexp_replace(lower(trim(search_query)), '[''’]', '', 'g') order by 2 desc limit 10`,
    sql`
      select initcap(device) as label, count(distinct visitor_id) as value
      from page_events where ${since} and device is not null group by 1 order by 2 desc`,
    sql`
      select browser || ' · ' || os as label, count(distinct visitor_id) as value
      from page_events where ${since} group by 1 order by 2 desc limit 6`,
    sql`
      select city as label, count(distinct visitor_id) as value, region as sub
      from page_events where ${since} and city is not null
      group by city, region order by 2 desc limit 10`,
    sql`
      select coalesce(country, 'Unknown') as label, count(distinct visitor_id) as value
      from page_events where ${since} group by 1 order by 2 desc limit 6`,
    sql`
      select extract(hour from created_at at time zone ${TZ})::int as h, count(*) as value
      from page_events where ${since} group by 1`,
  ]);

  const byHour = Array.from({ length: 24 }, (_, h) => n(hours.find((r) => r.h === h)?.value));

  const kinds = new Map<string, number>();
  for (const r of sources) {
    const kind = SOURCE_KIND[String(r.label)] ?? "Referral";
    kinds.set(kind, (kinds.get(kind) ?? 0) + n(r.value));
  }

  return {
    range,
    start,
    now,
    current,
    previous,
    points,
    hourly: range === "today",
    live: {
      count: live.length,
      visitors: live
        .map((r) => ({
          path: String(r.path),
          city: r.city as string | null,
          source: r.source as string | null,
          device: r.device as string | null,
          seconds: n(r.seconds),
        }))
        .sort((a, b) => a.seconds - b.seconds) as LiveVisitor[],
    },
    channels: [...kinds.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    sources: rows(sources),
    referrers: rows(referrers),
    campaigns: rows(campaigns),
    pages: rows(pages),
    landings: rows(landings),
    products: rows(products),
    searches: rows(searches).map((r) => ({ ...r, href: `/search?q=${encodeURIComponent(r.label)}` })),
    devices: rows(devices),
    browsers: rows(browsers),
    cities: rows(cities),
    countries: rows(countries),
    byHour,
  };
}

/** Accounts, alerts and data freshness — the parts that aren't traffic. */
export async function getAccounts(range: RangeKey) {
  const days = RANGES[range].days;
  const start = sql`((date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ})`;
  const [[totals], recent, watched, jobs, events, [freshness]] = await Promise.all([
    sql`
      select
        (select count(*) from auth.users) as users,
        (select count(*) from auth.users where created_at >= ${start}) as new_users,
        (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days') as active_7d,
        (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days') as active_30d,
        (select count(distinct user_id) from watchlist) as watchers,
        (select count(*) from watchlist) as watch_items,
        (select count(distinct user_id) from user_stores) as with_stores,
        (select count(*) from alert_prefs where allocated_email) as drop_alerts,
        (select count(*) from alert_prefs where not watchlist_email) as watch_alerts_off,
        (select count(*) from alert_deliveries where sent_at >= ${start}) as alerts_sent,
        (select count(distinct user_id) from alert_deliveries where sent_at >= ${start}) as alerted_users,
        (select count(*) from email_signups) as legacy_signups`,
    sql`
      select u.email, u.created_at, u.last_sign_in_at,
             (select count(*) from watchlist w where w.user_id = u.id) as watching,
             (select string_agg(s.city, ', ') from user_stores us join stores s on s.id = us.store_id
              where us.user_id = u.id) as stores
      from auth.users u order by u.created_at desc limit 12`,
    sql`
      select coalesce(p.name, w.csc) as label, count(*) as value, '/product/' || w.csc as href,
             case when p.in_stock then 'in stock' else 'out of stock' end as sub
      from watchlist w left join products p using (csc)
      group by w.csc, p.name, p.in_stock order by 2 desc limit 10`,
    sql`
      select job,
             max(finished_at) filter (where ok) as last_ok,
             count(*) filter (where ok = false and started_at > now() - interval '24 hours') as fails_24h,
             count(*) filter (where started_at > now() - interval '24 hours') as runs_24h
      from scrape_runs where started_at > now() - interval '30 days'
      group by job order by job`,
    sql`
      select event_type as label, count(*) as value from inventory_events
      where created_at >= ${start} group by 1 order by 2 desc`,
    sql`
      select count(*) as products, count(*) filter (where in_stock) as in_stock,
             (select count(*) from stores) as stores
      from products where delisted_at is null`,
  ]);
  return {
    users: n(totals.users),
    newUsers: n(totals.new_users),
    active7d: n(totals.active_7d),
    active30d: n(totals.active_30d),
    watchers: n(totals.watchers),
    watchItems: n(totals.watch_items),
    withStores: n(totals.with_stores),
    dropAlerts: n(totals.drop_alerts),
    watchAlertsOff: n(totals.watch_alerts_off),
    alertsSent: n(totals.alerts_sent),
    alertedUsers: n(totals.alerted_users),
    legacySignups: n(totals.legacy_signups),
    recent: recent.map((r) => ({
      email: String(r.email ?? "—"),
      createdAt: r.created_at as Date,
      lastSignIn: (r.last_sign_in_at as Date | null) ?? null,
      watching: n(r.watching),
      stores: (r.stores as string | null) ?? null,
    })),
    watched: rows(watched),
    jobs: jobs.map((r) => ({
      job: String(r.job),
      lastOk: (r.last_ok as Date | null) ?? null,
      fails24h: n(r.fails_24h),
      runs24h: n(r.runs_24h),
    })),
    events: rows(events),
    products: n(freshness.products),
    inStock: n(freshness.in_stock),
    stores: n(freshness.stores),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
export type Accounts = Awaited<ReturnType<typeof getAccounts>>;

/**
 * Rating beta: product viewers vs watchlist adds per badge, with unrated
 * products as the baseline, plus recent "rating seems wrong" notes.
 * Viewers = distinct (visitor, product) pairs; rare bottles attract more
 * interested people anyway, so a higher rate isn't proof the badge caused it.
 */
export async function getRatingsBeta(range: RangeKey) {
  const days = RANGES[range].days;
  const start = sql`((date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ})`;
  const [groups, feedback] = await Promise.all([
    sql`
      with rated as (
        select pr.csc, case when o.csc is not null then o.tier when pr.published then pr.tier end as tier
        from product_rarity pr left join rarity_overrides o using (csc)
      ),
      views as (
        select csc, count(distinct visitor_id) as viewers from page_events
        where csc is not null and created_at >= ${start} group by csc
      ),
      adds as (select csc, count(*) as adds from watchlist where created_at >= ${start} group by csc),
      base as (select csc from views union select csc from adds)
      select coalesce(r.tier, case when r.csc is null then 'no card' else 'not rated' end) as tier,
             count(*) filter (where v.viewers > 0) as products,
             coalesce(sum(v.viewers), 0) as viewers,
             coalesce(sum(a.adds), 0) as adds
      from base b
      left join rated r using (csc)
      left join views v using (csc)
      left join adds a using (csc)
      group by 1`.catch(() => []),
    sql`
      select f.created_at, f.csc, f.tier_shown, f.message, p.name
      from rating_feedback f left join products p using (csc)
      order by f.created_at desc limit 15`.catch(() => []),
  ]);
  const order = ["unicorn", "rare", "scarce", "uncommon", "everyday", "not rated", "no card"];
  return {
    groups: groups
      .map((g) => ({ tier: String(g.tier), products: n(g.products), viewers: n(g.viewers), adds: n(g.adds) }))
      .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier)),
    feedback: feedback.map((f) => ({
      createdAt: f.created_at as Date,
      csc: String(f.csc),
      name: (f.name as string | null) ?? null,
      tier: (f.tier_shown as string | null) ?? null,
      message: String(f.message),
    })),
  };
}

export type RatingsBeta = Awaited<ReturnType<typeof getRatingsBeta>>;
