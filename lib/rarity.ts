import type { ReservedSql } from "postgres";

/**
 * Utah availability ("rarity") — PROTOTYPE, internal only (report.ts rarity).
 * Nothing here is shown on the site yet.
 *
 * Kept deliberately separate:
 * - availability tier: from our own observations only (share of observed days
 *   in stock, stores seen, peak bottles on shelves)
 * - sales context: DABS monthly sales, shown next to the tier, not in it
 * - DABS status: decides eligibility and stays a separate label; never scored
 * - confidence: how much observation backs the tier
 *
 * A day counts as observed only if a catalog pass succeeded that day (Denver
 * time); failed or missing passes are unknown, never "out of stock".
 */
export const RARITY_METHOD = "v0-prototype";
export const RARITY_TZ = "America/Denver";

export interface RarityMetrics {
  csc: string;
  name: string;
  category: string | null;
  status: string | null;
  first_observed: string | null;
  observed_days: number;
  in_stock_days: number;
  restocks: number;
  median_stretch_days: number | null; // fully observed in-stock stretches only
  stores_seen: number;
  stores_now: number;
  has_store_data: boolean;
  peak_shelf: number | null;
  last_on_shelf: Date | null;
  in_stock_now: boolean;
  months_sold: number;
  bottles_12mo: number | null;
  bottles_total: number | null;
  last_sold_month: string | null;
  sales_names: number; // distinct names under this code in the sales files (reuse)
}

/**
 * Builds session temp tables (rarity_days, rarity_pd) on a reserved
 * connection and returns per-product metrics for listed products.
 */
export async function buildRarityMetrics(db: ReservedSql, windowDays = 180): Promise<RarityMetrics[]> {
  await db`drop table if exists rarity_days, rarity_pd`;
  // Observed days: at least one successful catalog pass, with the time span of
  // that day's passes (state is checked against that span).
  await db`
    create temp table rarity_days as
    select (finished_at at time zone ${RARITY_TZ})::date as d,
           min(finished_at) as t_first, max(finished_at) as t_last
    from scrape_runs
    where job = 'catalog' and ok and finished_at is not null
      and finished_at >= now() - make_interval(days => ${windowDays})
    group by 1`;
  // Product-day state from the delta-encoded snapshots: each snapshot holds
  // until the next one (or until the product was delisted).
  await db`
    create temp table rarity_pd as
    with iv as (
      select * from (
        select s.csc, s.scraped_at as t0,
               least(coalesce(lead(s.scraped_at) over (partition by s.csc order by s.scraped_at), 'infinity'),
                     coalesce(p.delisted_at, 'infinity')) as t1,
               coalesce(s.store_qty, 0) > 0 as on_shelf
        from inventory_snapshots s join products p using (csc)
        where p.delisted_at is null
      ) x
      where t1 > (select min(t_first) from rarity_days)
    ),
    bounds as (select min(d) as d0, max(d) as d1 from rarity_days)
    select iv.csc, dy.d, bool_or(iv.on_shelf) as in_stock
    from iv
    cross join bounds b
    cross join lateral generate_series(
      greatest((iv.t0 at time zone ${RARITY_TZ})::date, b.d0),
      least((least(iv.t1, now()) at time zone ${RARITY_TZ})::date, b.d1),
      interval '1 day') g(day)
    join rarity_days dy on dy.d = g.day::date and iv.t0 <= dy.t_last and iv.t1 > dy.t_first
    group by 1, 2`;
  await db`create index on rarity_pd (csc, d)`;
  await db`analyze rarity_pd`;

  return db<RarityMetrics[]>`
    with seq as (
      select csc, d, in_stock, lag(in_stock) over (partition by csc order by d) as prev
      from rarity_pd
    ),
    isl as (
      select csc, d, in_stock, prev,
             sum(case when in_stock is distinct from prev then 1 else 0 end)
               over (partition by csc order by d) as g
      from seq
    ),
    stretches as (
      select csc, g, bool_and(in_stock) as in_stock, count(*) as n,
             min(g) over (partition by csc) as g_min, max(g) over (partition by csc) as g_max
      from isl group by csc, g
    ),
    avail as (
      select csc, min(d) as first_observed, count(*)::int as observed_days,
             count(*) filter (where in_stock)::int as in_stock_days,
             count(*) filter (where in_stock and prev = false)::int as restocks
      from seq group by csc
    ),
    stretch_med as (
      select csc, percentile_cont(0.5) within group (order by n)::numeric(6,1) as median_stretch_days
      from stretches where in_stock and g > g_min and g < g_max
      group by csc
    ),
    shelf as (
      select s.csc, max(s.store_qty) as peak_shelf
      from inventory_snapshots s
      where s.scraped_at >= (select min(t_first) from rarity_days)
      group by s.csc
    ),
    shelf_prior as (
      -- state carried into the window from before it
      select distinct on (s.csc) s.csc, s.store_qty
      from inventory_snapshots s
      where s.scraped_at < (select min(t_first) from rarity_days)
      order by s.csc, s.scraped_at desc
    ),
    last_on as (
      select csc, max(coalesce(next_at, now())) as last_on_shelf
      from (
        select csc, store_qty,
               lead(scraped_at) over (partition by csc order by scraped_at) as next_at
        from inventory_snapshots
      ) s
      where coalesce(store_qty, 0) > 0
      group by csc
    ),
    stores as (
      select csc, count(distinct store_id)::int as stores_seen
      from (
        select csc, store_id from store_inventory
        where qty > 0 and scraped_at >= (select min(t_first) from rarity_days)
        union
        select csc, store_id from store_inventory_current where qty > 0
      ) u group by csc
    ),
    stores_now as (
      select csc, count(*) filter (where qty > 0)::int as stores_now, true as has_store_data
      from store_inventory_current group by csc
    ),
    sm as (
      select item_code as csc, period_month, sum(bottles) as b
      from monthly_sales group by 1, 2
    ),
    sales as (
      select sm.csc,
             count(*) filter (where b > 0)::int as months_sold,
             sum(b) filter (where period_month > (select max(period_month) from sales_reports) - interval '12 months')::int as bottles_12mo,
             sum(b)::int as bottles_total,
             to_char(max(period_month) filter (where b > 0), 'YYYY-MM') as last_sold_month,
             (select count(distinct item_name)::int from monthly_sales m where m.item_code = sm.csc) as sales_names
      from sm group by sm.csc
    )
    select p.csc, p.name, p.category, p.status,
           a.first_observed::text, a.observed_days, a.in_stock_days, a.restocks,
           sm2.median_stretch_days::float as median_stretch_days,
           coalesce(st.stores_seen, 0) as stores_seen,
           coalesce(sn.stores_now, 0) as stores_now,
           coalesce(sn.has_store_data, false) as has_store_data,
           greatest(sh.peak_shelf, sp.store_qty) as peak_shelf,
           lo.last_on_shelf, coalesce(p.store_qty, 0) > 0 as in_stock_now,
           coalesce(sa.months_sold, 0) as months_sold, sa.bottles_12mo, sa.bottles_total,
           sa.last_sold_month, coalesce(sa.sales_names, 0) as sales_names
    from products p
    join avail a using (csc)
    left join stretch_med sm2 using (csc)
    left join shelf sh using (csc)
    left join shelf_prior sp using (csc)
    left join last_on lo using (csc)
    left join stores st using (csc)
    left join stores_now sn using (csc)
    left join sales sa using (csc)
    where p.delisted_at is null`;
}

export type RarityTier = "everyday" | "uncommon" | "scarce" | "rare" | "unicorn";
export const TIER_ORDER: RarityTier[] = ["everyday", "uncommon", "scarce", "rare", "unicorn"];

/** Working names only; final names get picked after the review. */
export const TIER_LABELS: Record<RarityTier, string> = {
  everyday: "Everyday",
  uncommon: "Uncommon",
  scarce: "Scarce",
  rare: "Rare",
  unicorn: "Unicorn",
};

/** Lower score bound for each tier (v0; tuned from the review). */
export const TIER_CUTOFFS: [RarityTier, number][] = [
  ["unicorn", 85],
  ["rare", 70],
  ["scarce", 50],
  ["uncommon", 30],
  ["everyday", 0],
];

export const MIN_OBSERVED_DAYS = 30;
/** Stores / bottles at which a product counts as widely stocked. */
const WIDE_STORES = 30;
const PLENTY_BOTTLES = 1000;

export type RarityOutcome =
  | { kind: "tier"; tier: RarityTier; score: number; confidence: "high" | "medium" | "low"; flags: string[] }
  | { kind: "orderable" }
  | { kind: "ineligible"; reason: string }
  | { kind: "unclassified"; reason: string; score?: number };

/** DABS statuses that are winding down: no tier (dead listings aren't treasures). */
const WINDING_DOWN = new Set(["D", "X", "N", "U"]);

export function scoreRarity(m: RarityMetrics): { score: number; parts: Record<string, number> } {
  const avail = m.observed_days > 0 ? m.in_stock_days / m.observed_days : 0;
  const time = 1 - avail;
  const stores = 1 - Math.min(m.stores_seen, WIDE_STORES) / WIDE_STORES;
  const supply =
    1 - Math.min(Math.log10(1 + Math.max(m.peak_shelf ?? 0, 0)) / Math.log10(1 + PLENTY_BOTTLES), 1);
  const score = 100 * (0.7 * time + 0.2 * stores + 0.1 * supply);
  return {
    score: Math.round(score * 10) / 10,
    parts: { avail: Math.round(avail * 1000) / 10, time, stores, supply },
  };
}

export function classifyRarity(m: RarityMetrics): RarityOutcome {
  if (m.status === "S") return { kind: "orderable" };
  if (m.status && WINDING_DOWN.has(m.status)) return { kind: "ineligible", reason: `DABS status ${m.status}` };
  const { score } = scoreRarity(m);
  if (m.observed_days < MIN_OBSERVED_DAYS) {
    return { kind: "unclassified", reason: "insufficient history", score };
  }
  if (m.in_stock_days === 0) return { kind: "unclassified", reason: "not seen on shelves", score };

  const flags: string[] = [];
  if (!m.has_store_data) flags.push("no store data");
  if (m.sales_names > 1) flags.push("code reused in sales files");
  if (m.months_sold === 0) flags.push("no DABS sales");
  const confidence =
    m.observed_days >= 60 && m.has_store_data ? "high" : m.observed_days >= 45 ? "medium" : "low";
  const tier = TIER_CUTOFFS.find(([, min]) => score >= min)![0];
  return { kind: "tier", tier, score, confidence, flags };
}
