import { sql } from "@/lib/db";
import { SOURCE_KIND } from "@/lib/analytics";
import { CURRENT_EDITION, editionPath } from "@/lib/year-in-bottles-cards";

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

/**
 * "Worth a look" (/discover): unique and returning visitors from page_events,
 * actions from discover_events, by view and surface. Confirmed = the watch was
 * actually added (after email verification for signed-out visitors), not the
 * Watch tap. Rare bottles draw interested people anyway, so a higher rate for
 * one view isn't proof the badge or the page caused it.
 */
export async function getDiscovery(range: RangeKey) {
  const days = RANGES[range].days;
  const start = sql`((date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ})`;
  const [visits, byView, useful] = await Promise.all([
    sql`
      with v as (
        select visitor_id, count(distinct session_id) as sessions from page_events
        where path = '/discover' and created_at >= ${start} group by visitor_id
      )
      select count(*) as visitors, count(*) filter (where sessions >= 2) as returning,
             (select count(distinct visitor_id) from page_events where path = '/' and created_at >= ${start}) as home_visitors
      from v`.catch(() => []),
    sql`
      select surface, view,
             count(distinct visitor_id) filter (where kind = 'click') as clickers,
             count(*) filter (where kind = 'click') as clicks,
             count(*) filter (where kind = 'watch_click') as watch_clicks,
             count(*) filter (where kind = 'watch_request') as email_requests,
             count(*) filter (where kind = 'watch_added') as confirmed
      from discover_events where created_at >= ${start} and view is not null and surface not in ('share', 'holiday')
      group by 1, 2`.catch(() => []),
    sql`
      select count(*) filter (where kind = 'useful_yes') as yes, count(*) filter (where kind = 'useful_no') as no
      from discover_events where created_at >= ${start}`.catch(() => []),
  ]);
  const v = visits[0] ?? {};
  const rows = byView.map((r) => ({
    surface: String(r.surface),
    view: String(r.view),
    clickers: n(r.clickers),
    clicks: n(r.clicks),
    watchClicks: n(r.watch_clicks),
    emailRequests: n(r.email_requests),
    confirmed: n(r.confirmed),
  }));
  const order = ["scarce", "back", "price"];
  rows.sort((a, b) => a.surface.localeCompare(b.surface) || order.indexOf(a.view) - order.indexOf(b.view));
  const onPage = rows.filter((r) => r.surface === "discover");
  const sum = (f: (r: (typeof rows)[number]) => number, list = onPage) => list.reduce((a, r) => a + f(r), 0);
  const [clickers] = await sql`
    select count(distinct visitor_id) as n from discover_events
    where created_at >= ${start} and surface = 'discover' and kind = 'click'`.catch(() => [{ n: 0 }]);
  return {
    visitors: n(v.visitors),
    returning: n(v.returning),
    homeVisitors: n(v.home_visitors),
    clickers: n(clickers?.n),
    watchClicks: sum((r) => r.watchClicks),
    confirmed: sum((r) => r.confirmed),
    rows,
    useful: { yes: n(useful[0]?.yes), no: n(useful[0]?.no) },
  };
}

export type Discovery = Awaited<ReturnType<typeof getDiscovery>>;

/**
 * Sharing: taps on the share button and how they went (discover_events,
 * surface "share"), then visits that landed from a shared link (?ref=share,
 * page_events.utm_source = 'share'). Recipients are visitor ids, so one person
 * on two devices counts twice, and a sharer opening their own link isn't a
 * recipient (left out by visitor id). Signed up / watched = the recipient
 * signed in later and that account was created, or added a watch, after the
 * shared visit.
 */
export async function getSharing(range: RangeKey) {
  const days = RANGES[range].days;
  const start = sql`((date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ})`;
  const [[t], shared, landed] = await Promise.all([
    sql`
      with s as (
        select kind, visitor_id from discover_events where created_at >= ${start} and surface = 'share'
      ),
      sharers as (
        select distinct visitor_id from discover_events where surface = 'share' and visitor_id is not null
      ),
      r as (
        select visitor_id, min(created_at) as at from page_events
        where created_at >= ${start} and is_landing and utm_source = 'share'
          and visitor_id not in (select visitor_id from sharers)
        group by 1
      ),
      u as (
        select distinct r.visitor_id, e.user_id, r.at from r
        join page_events e on e.visitor_id = r.visitor_id and e.user_id is not null and e.created_at >= r.at
      )
      select
        (select count(*) filter (where kind = 'share_tap') from s) as taps,
        (select count(distinct visitor_id) filter (where kind = 'share_tap') from s) as sharers,
        (select count(*) filter (where kind = 'share_native') from s) as native,
        (select count(*) filter (where kind = 'share_copy') from s) as copied,
        (select count(*) from page_events where created_at >= ${start} and is_landing and utm_source = 'share'
           and visitor_id not in (select visitor_id from sharers)) as visits,
        (select count(*) from r) as recipients,
        (select count(*) from r where not exists (
           select 1 from page_events p where p.visitor_id = r.visitor_id and p.created_at < r.at)) as new_recipients,
        (select count(distinct u.visitor_id) from u join auth.users a on a.id = u.user_id and a.created_at >= u.at) as signed_up,
        (select count(distinct u.visitor_id) from u join watchlist w on w.user_id = u.user_id and w.created_at >= u.at) as watched`,
    sql`
      select coalesce(p.name, case when e.view = 'discover' then 'Worth a look' when e.view = 'holidays' then 'Holidays'
               when e.view = 'year' then 'Year in Bottles' when e.view like 'year-%' then 'Year in Bottles · ' || substr(e.view, 6)
               else e.csc end) as label,
             count(*) filter (where e.kind = 'share_tap') as value,
             count(*) filter (where e.kind in ('share_native', 'share_copy'))::text || ' sent' as sub,
             case when e.csc is not null then '/product/' || e.csc when e.view = 'discover' then '/discover'
                  when e.view = 'holidays' then '/holidays'
                  when e.view like 'year%' then ${editionPath(CURRENT_EDITION)} || coalesce('/' || nullif(substr(e.view, 6), ''), '') end as href
      from discover_events e left join products p using (csc)
      where e.created_at >= ${start} and e.surface = 'share'
      group by e.view, e.csc, p.name having count(*) filter (where e.kind = 'share_tap') > 0
      order by 2 desc limit 10`,
    sql`
      select coalesce(p.name, e.path) as label, count(*) as value,
             case when e.csc is not null then '/product/' || e.csc else e.path end as href
      from page_events e left join products p using (csc)
      where e.created_at >= ${start} and e.is_landing and e.utm_source = 'share'
        and e.visitor_id not in (select visitor_id from discover_events where surface = 'share' and visitor_id is not null)
      group by e.path, e.csc, p.name order by 2 desc limit 10`,
  ]);
  return {
    taps: n(t.taps),
    sharers: n(t.sharers),
    native: n(t.native),
    copied: n(t.copied),
    visits: n(t.visits),
    recipients: n(t.recipients),
    newRecipients: n(t.new_recipients),
    signedUp: n(t.signed_up),
    watched: n(t.watched),
    shared: rows(shared),
    landed: rows(landed),
  };
}

export type Sharing = Awaited<ReturnType<typeof getSharing>>;

/**
 * Holidays: the homepage holiday strip and /holidays/<year>. Visits from
 * page_events; bottle clicks, Watch taps, email requests and confirmed watches
 * from discover_events surface "holiday" (view "home" = a strip bottle,
 * "guide" = the strip's link to the page, otherwise the page's group); shares
 * of the page from surface "share", view "holidays". The strip shows on every
 * homepage visit during the season, so home visitors are its audience.
 */
export async function getHolidays(range: RangeKey) {
  const days = RANGES[range].days;
  const start = sql`((date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ})`;
  const page = sql`path like '/holidays%'`;
  const [[v], byView, bottles, sources, daily] = await Promise.all([
    sql`
      with p as (select * from page_events where created_at >= ${start} and ${page}),
      ev as (select * from discover_events where created_at >= ${start} and surface = 'holiday')
      select
        (select count(distinct visitor_id) from p) as visitors,
        (select count(*) from p) as views,
        (select count(*) from (select visitor_id from p group by 1 having count(distinct session_id) >= 2) r) as returning,
        (select count(*) from p where is_landing) as landings,
        (select count(*) from p where is_landing and utm_source = 'share') as from_shares,
        (select count(distinct visitor_id) from page_events where created_at >= ${start} and path = '/') as home_visitors,
        (select count(distinct visitor_id) from ev where kind = 'click' and view in ('home', 'guide')) as strip_clickers,
        (select count(distinct visitor_id) from ev where kind = 'click' and view = 'guide') as guide_clickers,
        (select count(distinct visitor_id) from ev where kind = 'click' and view not in ('home', 'guide')) as page_clickers,
        (select count(*) from ev where kind = 'watch_click') as watch_clicks,
        (select count(*) from ev where kind = 'watch_added') as confirmed,
        (select count(*) from discover_events where created_at >= ${start} and surface = 'share' and view = 'holidays'
           and kind = 'share_tap') as share_taps,
        (select count(*) from discover_events where created_at >= ${start} and surface = 'share' and view = 'holidays'
           and kind in ('share_native', 'share_copy')) as shares_sent`,
    sql`
      select view,
             count(*) filter (where kind = 'click') as clicks,
             count(distinct visitor_id) filter (where kind = 'click') as clickers,
             count(*) filter (where kind = 'watch_click') as watch_clicks,
             count(*) filter (where kind = 'watch_request') as email_requests,
             count(*) filter (where kind = 'watch_added') as confirmed
      from discover_events where created_at >= ${start} and surface = 'holiday'
      group by 1`,
    sql`
      select coalesce(p.name, e.csc) as label, count(*) filter (where e.kind = 'click') as value,
             count(*) filter (where e.kind = 'watch_added')::text || ' watched' as sub,
             '/product/' || e.csc as href
      from discover_events e left join products p using (csc)
      where e.created_at >= ${start} and e.surface = 'holiday' and e.csc is not null
      group by e.csc, p.name having count(*) filter (where e.kind = 'click') > 0
      order by 2 desc limit 10`,
    sql`
      select coalesce(source, 'Direct') as label, count(*) as value
      from page_events where created_at >= ${start} and ${page} and is_landing
      group by 1 order by 2 desc limit 8`,
    sql`
      select to_char(day, 'Dy Mon DD') as label, count(distinct visitor_id) as value, count(*)::text || ' views' as sub
      from (select date_trunc('day', created_at at time zone ${TZ}) as day, visitor_id
            from page_events where created_at >= ${start} and ${page}) d
      group by day order by day desc limit 14`,
  ]);
  const order = ["home", "guide", "nog", "warm", "beer", "nouveau", "seasonal", "gift"];
  const views = byView
    .map((r) => ({
      view: String(r.view),
      clicks: n(r.clicks),
      clickers: n(r.clickers),
      watchClicks: n(r.watch_clicks),
      emailRequests: n(r.email_requests),
      confirmed: n(r.confirmed),
    }))
    .sort((a, b) => order.indexOf(a.view) - order.indexOf(b.view));
  return {
    visitors: n(v.visitors),
    views: n(v.views),
    returning: n(v.returning),
    landings: n(v.landings),
    fromShares: n(v.from_shares),
    homeVisitors: n(v.home_visitors),
    stripClickers: n(v.strip_clickers),
    guideClickers: n(v.guide_clickers),
    pageClickers: n(v.page_clickers),
    watchClicks: n(v.watch_clicks),
    confirmed: n(v.confirmed),
    shareTaps: n(v.share_taps),
    sharesSent: n(v.shares_sent),
    byView: views,
    bottles: rows(bottles),
    sources: rows(sources),
    daily: rows(daily),
  };
}

export type Holidays = Awaited<ReturnType<typeof getHolidays>>;

/**
 * Year in Bottles (/year-in-bottles): visits from page_events (path), actions
 * from discover_events surface "year" (lib/year-in-bottles-paths.ts:
 * banner shown/click, dismiss, home, drops, watch, card-<slug> shown) and
 * shares from surface "share", view "year" or "year-<card>". Converted =
 * after their first visit to the deck, the visitor's account was created,
 * added a watch, or has the allocated-list email on (alert_prefs updated
 * since). Visitor ids, so one person on two devices counts twice.
 */
export async function getYearInBottles(range: RangeKey) {
  const days = RANGES[range].days;
  const start = sql`((date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ})`;
  const page = sql`path like '/year-in-bottles%'`;
  const [[v], cards, shares, landed, sources, daily] = await Promise.all([
    sql`
      with p as (select * from page_events where created_at >= ${start} and ${page}),
      ev as (select * from discover_events where created_at >= ${start} and surface = 'year'),
      sh as (select * from discover_events where created_at >= ${start} and surface = 'share' and view like 'year%'),
      firsts as (
        select visitor_id, min(created_at) as at from page_events where ${page} and visitor_id in (select visitor_id from p) group by 1
      ),
      u as (
        select distinct f.visitor_id, e.user_id, f.at from firsts f
        join page_events e on e.visitor_id = f.visitor_id and e.user_id is not null and e.created_at >= f.at
      )
      select
        (select count(distinct visitor_id) from p) as visitors,
        (select count(*) from p) as views,
        (select count(*) from (select visitor_id from p group by 1 having count(distinct session_id) >= 2) r) as returning,
        (select count(*) from p where is_landing) as landings,
        (select count(*) from p where is_landing and utm_source = 'share') as from_shares,
        (select count(*) from firsts f where not exists (
           select 1 from page_events e where e.visitor_id = f.visitor_id and e.created_at < f.at)) as new_to_site,
        (select count(*) from ev where kind = 'shown' and view = 'banner') as banner_shown,
        (select count(distinct visitor_id) from ev where kind = 'click' and view = 'banner') as banner_clickers,
        (select count(distinct visitor_id) from ev where kind = 'click' and view = 'dismiss') as dismissed,
        (select count(distinct visitor_id) from ev where kind = 'click' and view = 'home') as home_clickers,
        (select count(distinct visitor_id) from page_events where created_at >= ${start} and path = '/') as home_visitors,
        (select count(distinct visitor_id) from ev where kind = 'shown' and view like 'card-%') as deck_viewers,
        (select count(distinct visitor_id) from ev where kind = 'shown' and view = 'card-next') as reached_end,
        (select count(distinct visitor_id) from ev where kind = 'click' and view = 'drops') as drops_clickers,
        (select count(distinct visitor_id) from ev where kind = 'click' and view = 'watch') as watch_clickers,
        (select count(*) from sh where kind = 'share_tap') as share_taps,
        (select count(distinct visitor_id) from sh where kind = 'share_tap') as sharers,
        (select count(*) from sh where kind in ('share_native', 'share_copy')) as shares_sent,
        (select count(distinct u.visitor_id) from u join auth.users a on a.id = u.user_id and a.created_at >= u.at) as signed_up,
        (select count(distinct u.visitor_id) from u join watchlist w on w.user_id = u.user_id and w.created_at >= u.at) as watched,
        (select count(distinct u.visitor_id) from u join alert_prefs ap on ap.user_id = u.user_id
           and ap.allocated_email and ap.updated_at >= u.at) as drop_emails`,
    sql`
      select substr(view, 6) as slug, count(distinct visitor_id) as visitors
      from discover_events where created_at >= ${start} and surface = 'year' and kind = 'shown' and view like 'card-%'
      group by 1`,
    sql`
      select view, count(*) filter (where kind = 'share_tap') as taps,
             count(*) filter (where kind in ('share_native', 'share_copy')) as sent
      from discover_events where created_at >= ${start} and surface = 'share' and view like 'year%'
      group by 1`,
    sql`
      select path as label, count(*) as value, path as href
      from page_events where created_at >= ${start} and ${page} and is_landing and utm_source = 'share'
      group by 1 order by 2 desc limit 12`,
    sql`
      select coalesce(source, 'Direct') as label, count(*) as value
      from page_events where created_at >= ${start} and ${page} and is_landing
      group by 1 order by 2 desc limit 8`,
    sql`
      select to_char(day, 'Dy Mon DD') as label, count(distinct visitor_id) as value, count(*)::text || ' views' as sub
      from (select date_trunc('day', created_at at time zone ${TZ}) as day, visitor_id
            from page_events where created_at >= ${start} and ${page}) d
      group by day order by day desc limit 14`,
  ]);
  return {
    visitors: n(v.visitors),
    views: n(v.views),
    returning: n(v.returning),
    landings: n(v.landings),
    fromShares: n(v.from_shares),
    newToSite: n(v.new_to_site),
    bannerShown: n(v.banner_shown),
    bannerClickers: n(v.banner_clickers),
    dismissed: n(v.dismissed),
    homeClickers: n(v.home_clickers),
    homeVisitors: n(v.home_visitors),
    deckViewers: n(v.deck_viewers),
    reachedEnd: n(v.reached_end),
    dropsClickers: n(v.drops_clickers),
    watchClickers: n(v.watch_clickers),
    shareTaps: n(v.share_taps),
    sharers: n(v.sharers),
    sharesSent: n(v.shares_sent),
    signedUp: n(v.signed_up),
    watched: n(v.watched),
    dropEmails: n(v.drop_emails),
    cardViewers: Object.fromEntries(cards.map((r) => [String(r.slug), n(r.visitors)])) as Record<string, number>,
    cardShares: Object.fromEntries(shares.map((r) => [String(r.view), { taps: n(r.taps), sent: n(r.sent) }])) as Record<
      string,
      { taps: number; sent: number }
    >,
    landed: rows(landed),
    sources: rows(sources),
    daily: rows(daily),
  };
}

export type YearInBottlesStats = Awaited<ReturnType<typeof getYearInBottles>>;
