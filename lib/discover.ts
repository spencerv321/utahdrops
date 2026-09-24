import { cache } from "react";
import { sql } from "@/lib/db";
import { NEARBY_MILES, type Area } from "@/lib/area";
import { DISCOVER, type DiscoverItem, type DiscoverView, type Tier } from "@/lib/discover-rules";

/**
 * "Worth a look" candidates (rules in lib/discover-rules.ts). Every view
 * shares one eligibility floor: reported in stores statewide by a recent
 * catalog pass, sold at ordinary retail. Allocated-drop lists and drawing
 * quantities are never read as stock: availability is only DABS's current
 * store count and our own successful store checks.
 */

type Row = {
  csc: string;
  name: string;
  category: string | null;
  size_ml: number | null;
  price: string;
  is_spa: boolean;
  status: string | null;
  store_qty: number;
  last_seen: Date;
  store_checked_at: Date | null;
  tier: Tier | null;
  rarity_headline: string | null;
  near_stores: number | null;
  near_units: number | null;
  near_checked_at: Date | null;
  out_since?: Date | null;
  back_at?: Date | null;
  old_price?: string | null;
  drop_at?: Date | null;
};

/**
 * Retail-eligible and in stock now. Excluded: stale statewide data, delisted
 * and special-order/unavailable listings, and anything DABS has released by
 * drawing (bottles in stores may be held for winners; retail access unclear).
 */
const eligible = () => sql`
  p.in_stock and coalesce(p.store_qty, 0) > 0
  and p.current_price is not null
  and p.last_seen > now() - make_interval(hours => ${DISCOVER.statewideMaxAgeHours})
  and p.delisted_at is null
  and coalesce(p.status, '') not in ('S', 'N')
  and coalesce(p.category, '') not like 'SPECIAL ORDERS%'
  and not exists (select 1 from rhdp_drawings d where d.item_code = p.csc)`;

/** One DABS code used for several names or vintages: price or return comparisons are ambiguous. */
const notReusedCode = () => sql`
  not exists (
    select 1 from monthly_sales m where m.item_code = p.csc
    group by m.item_code
    having count(distinct upper(regexp_replace(m.item_name, '[^A-Za-z0-9]', '', 'g'))) > 1)`;

/** Published tier after overrides (an override with tier null hides the badge). */
const tierExpr = () => sql`case when o.csc is not null then o.tier when pr.published then pr.tier end`;

function nearJoin(area: Area | null) {
  if (!area) {
    return {
      cte: sql``,
      cols: sql`null::int as near_stores, null::int as near_units, null::timestamptz as near_checked_at`,
      join: sql``,
    };
  }
  return {
    cte: sql`
      near_stores as (
        select id from stores
        where lat is not null and 3959 * 2 * asin(least(1, sqrt(
          sin(radians(lat - ${area.lat}) / 2) ^ 2 +
          cos(radians(${area.lat})) * cos(radians(lat)) * sin(radians(lng - ${area.lng}) / 2) ^ 2
        ))) <= ${NEARBY_MILES}
      ),
      nb as (
        -- positive counts from successful checks only (failed checks never write here)
        select c.csc, count(*)::int as stores, sum(c.qty)::int as units, min(c.scraped_at) as checked_at
        from store_inventory_current c
        where c.store_id in (select id from near_stores) and c.qty > 0
          and c.scraped_at > now() - make_interval(hours => ${DISCOVER.nearbyMaxAgeHours})
        group by c.csc
      ),`,
    cols: sql`nb.stores as near_stores, nb.units as near_units, nb.checked_at as near_checked_at`,
    join: sql`left join nb on nb.csc = p.csc`,
  };
}

const baseCols = () => sql`
  p.csc, p.name, p.category, p.size_ml, p.current_price::text as price, p.is_spa, p.status,
  p.store_qty, p.last_seen, p.store_checked_at,
  ${tierExpr()} as tier,
  case when o.csc is not null and o.explanation is not null then o.explanation else pr.headline end as rarity_headline`;

async function scarce(area: Area | null): Promise<Row[]> {
  const n = nearJoin(area);
  return (await sql`
    with ${n.cte} _ as (select 1)
    select ${baseCols()}, ${n.cols}
    from products p
    join product_rarity pr on pr.csc = p.csc
    left join rarity_overrides o on o.csc = p.csc
    ${n.join}
    where ${eligible()}
      and ${tierExpr()} = any(${[...DISCOVER.tiers]})`) as unknown as Row[];
}

type Return = { csc: string; out_since: Date; back_at: Date };
let returnsCache: { at: number; rows: Return[] } | null = null;
const RETURNS_TTL_MS = 15 * 60_000;

/** Tests change history between calls; production relies on the TTL. */
export function clearDiscoverCache() {
  returnsCache = null;
}

/**
 * Back after a while (statewide): the latest out-of-stock stretch (from the
 * first statewide zero after an in-stock observation, to the first in-stock
 * observation after it) lasted at least absenceDays, ended within
 * returnedWithinDays, and our catalog passes covered all of it with no gap
 * longer than maxCoverageGapHours. No earlier in-stock observation (a first
 * appearance) or an outage inside the stretch = not a confirmed absence.
 *
 * This walks snapshot history (~1s), and data changes ~3×/day, so the result
 * is kept per server instance for RETURNS_TTL_MS. While unbroken history is
 * shorter than absenceDays nothing can qualify, so the query is skipped.
 */
async function recentReturns(): Promise<Return[]> {
  if (returnsCache && Date.now() - returnsCache.at < RETURNS_TTL_MS) return returnsCache.rows;
  const b = DISCOVER.back;
  const { since } = await backCoverage();
  let rows: Return[] = [];
  if (since && since.getTime() <= Date.now() - b.absenceDays * 86400_000) {
    rows = (await sql`
      with cand as (
        -- a return inside the window leaves an in-stock snapshot inside it
        select p.csc from products p
        where ${eligible()}
          and exists (select 1 from inventory_snapshots s
                      where s.csc = p.csc and coalesce(s.store_qty, 0) > 0
                        and s.scraped_at > now() - make_interval(days => ${b.returnedWithinDays}))
      ),
      last_zero as (
        select s.csc, max(s.scraped_at) as z_last
        from inventory_snapshots s join cand using (csc)
        where coalesce(s.store_qty, 0) = 0 group by s.csc
      ),
      stretch as (
        select z.csc,
               (select min(s.scraped_at) from inventory_snapshots s
                 where s.csc = z.csc and s.scraped_at > z.z_last and coalesce(s.store_qty, 0) > 0) as back_at,
               (select max(s.scraped_at) from inventory_snapshots s
                 where s.csc = z.csc and s.scraped_at < z.z_last and coalesce(s.store_qty, 0) > 0) as prev_in_stock
        from last_zero z
      ),
      runs as (
        select started_at, lead(started_at) over (order by started_at) as next_at
        from scrape_runs where job = 'catalog' and ok
      ),
      gaps as (
        select started_at as gap_from, next_at as gap_to from runs
        where next_at - started_at > make_interval(hours => ${b.maxCoverageGapHours})
      ),
      ret as (
        select st.csc, st.back_at,
               (select min(s.scraped_at) from inventory_snapshots s
                 where s.csc = st.csc and s.scraped_at > st.prev_in_stock and coalesce(s.store_qty, 0) = 0) as out_since
        from stretch st
        where st.back_at is not null and st.prev_in_stock is not null
          and st.back_at > now() - make_interval(days => ${b.returnedWithinDays})
      )
      select bk.csc, bk.out_since, bk.back_at
      from ret bk
      join products p on p.csc = bk.csc
      where bk.back_at - bk.out_since >= make_interval(days => ${b.absenceDays})
        and not exists (select 1 from gaps g where g.gap_to > bk.out_since and g.gap_from < bk.back_at)
        -- a catalog pass must also have run shortly before the stretch began
        and exists (select 1 from runs r where r.started_at < bk.out_since
                      and r.started_at > bk.out_since - make_interval(hours => ${b.maxCoverageGapHours}))
        and ${notReusedCode()}`) as unknown as Return[];
  }
  returnsCache = { at: Date.now(), rows };
  return rows;
}

/** Recent returns with current facts (re-checked: still eligible now) and nearby stock. */
async function back(area: Area | null): Promise<Row[]> {
  const returns = await recentReturns();
  if (returns.length === 0) return [];
  const n = nearJoin(area);
  return (await sql`
    with ${n.cte}
    ret as (
      select * from jsonb_to_recordset(${sql.json(returns as never)}) as x(csc text, out_since timestamptz, back_at timestamptz)
    )
    select ${baseCols()}, ${n.cols}, bk.out_since, bk.back_at
    from ret bk
    join products p on p.csc = bk.csc
    left join product_rarity pr on pr.csc = p.csc
    left join rarity_overrides o on o.csc = p.csc
    ${n.join}
    where ${eligible()}`) as unknown as Row[];
}

/**
 * Price drops, from the catalog's price_change events (emitted only between
 * consecutive passes, never after an outage, so "old" is the price we saw
 * one pass earlier). The latest change must be the drop, DABS's current
 * price must still equal it, and the old price must have held prevMinDays.
 */
async function price(area: Area | null): Promise<Row[]> {
  const n = nearJoin(area);
  const c = DISCOVER.price;
  return (await sql`
    with ${n.cte}
    latest as (
      select distinct on (e.csc) e.csc, e.created_at,
             (e.detail->>'old')::numeric as old_price, (e.detail->>'new')::numeric as new_price
      from inventory_events e
      where e.event_type = 'price_change'
      order by e.csc, e.created_at desc, e.id desc
    )
    select ${baseCols()}, ${n.cols}, l.old_price::text as old_price, l.created_at as drop_at
    from latest l
    join products p on p.csc = l.csc
    left join product_rarity pr on pr.csc = p.csc
    left join rarity_overrides o on o.csc = p.csc
    ${n.join}
    where ${eligible()}
      and l.created_at > now() - make_interval(days => ${c.withinDays})
      and l.new_price = p.current_price
      and l.old_price - l.new_price >= ${c.minDollars}
      and l.old_price - l.new_price >= l.old_price * ${c.minPct}
      and not exists (
        select 1 from inventory_events e2
        where e2.csc = l.csc and e2.event_type = 'price_change'
          and e2.created_at < l.created_at
          and e2.created_at > l.created_at - make_interval(days => ${c.prevMinDays}))
      and ${notReusedCode()}`) as unknown as Row[];
}

function toItem(r: Row): DiscoverItem {
  return {
    csc: r.csc,
    name: r.name,
    category: r.category,
    sizeMl: r.size_ml,
    price: Number(r.price),
    isSpa: r.is_spa,
    status: r.status,
    storeQty: r.store_qty,
    statewideAt: new Date(r.last_seen),
    storeCheckedAt: r.store_checked_at ? new Date(r.store_checked_at) : null,
    tier: r.tier,
    rarityHeadline: r.rarity_headline,
    near:
      r.near_stores && r.near_checked_at
        ? { stores: r.near_stores, units: r.near_units ?? 0, checkedAt: new Date(r.near_checked_at) }
        : null,
    outSince: r.out_since ? new Date(r.out_since) : undefined,
    backAt: r.back_at ? new Date(r.back_at) : undefined,
    oldPrice: r.old_price != null ? Number(r.old_price) : undefined,
    dropAt: r.drop_at ? new Date(r.drop_at) : undefined,
  };
}

const QUERIES: Record<DiscoverView, (area: Area | null) => Promise<Row[]>> = { scarce, back, price };

/** Unranked candidates for one view (rank with rankView). */
export async function getDiscoverCandidates(view: DiscoverView, area: Area | null): Promise<DiscoverItem[]> {
  return (await QUERIES[view](area)).map(toItem);
}

/** All three views, cached per request (the page's tabs and the homepage preview). */
export const getAllDiscover = cache(async (lat: number | null, lng: number | null) => {
  const area = lat != null && lng != null ? { label: "", lat, lng } : null;
  const [s, b, p] = await Promise.all([
    getDiscoverCandidates("scarce", area),
    getDiscoverCandidates("back", area),
    getDiscoverCandidates("price", area),
  ]);
  return { scarce: s, back: b, price: p } as Record<DiscoverView, DiscoverItem[]>;
});

/**
 * When "Back after a while" can first show anything: the start of the
 * current unbroken run of catalog passes, plus absenceDays.
 */
export async function backCoverage(): Promise<{ since: Date | null; earliest: Date | null }> {
  const [row] = (await sql`
    with runs as (
      select started_at, lag(started_at) over (order by started_at) as prev_at
      from scrape_runs where job = 'catalog' and ok
    )
    select coalesce(
      (select max(started_at) from runs
        where prev_at is null or started_at - prev_at > make_interval(hours => ${DISCOVER.back.maxCoverageGapHours})),
      null) as since`) as unknown as { since: Date | null }[];
  const since = row?.since ? new Date(row.since) : null;
  return { since, earliest: since ? new Date(since.getTime() + DISCOVER.back.absenceDays * 86400_000) : null };
}
