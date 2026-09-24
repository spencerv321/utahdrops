import type { ReservedSql } from "postgres";

/**
 * Utah availability ("rarity") — EXPERIMENTAL, internal only (report.ts
 * rarity). Nothing here is shown on the site.
 *
 * Method v1 (sales-led):
 * - Primary signal: DABS monthly sales over the trailing 12 report months
 *   (all 16+ months kept for context). Months before a product's first
 *   record don't count. "Months with recorded sales" is what the data shows;
 *   a month with no report line is kept distinct from an explicit zero line.
 * - Low volume, few selling months or concentrated sales alone never earn a
 *   high tier: they also describe unpopular, new or ending products. A high
 *   tier needs corroboration (a repeated release pattern, or our own stock
 *   observations showing it rarely on shelves); otherwise "insufficient
 *   evidence".
 * - Stock observations count asymmetrically: consistently on shelves is
 *   strong evidence against rarity (caps the tier); rarely seen is weaker
 *   evidence for it. Only days with a successful catalog pass are observed
 *   (the Aug–Sep 2026 scraper outage is excluded from every denominator).
 * - Seasonality is a separate attribute, never an exclusion.
 * - DABS status/labels decide eligibility and are shown separately; they
 *   never raise or lower the computed tier.
 */
export const RARITY_METHOD = "v1-sales-led";
export const RARITY_TZ = "America/Denver";

// ── thresholds (proposed; tuned from the review) ─────────────────────────
export const T = {
  trailingMonths: 12,
  /** Months since first record needed before a product can be classified. */
  minRecordMonths: 6,
  /** Share of eligible months with recorded sales. */
  regularShare: 0.75,
  sporadicShare: 0.35,
  /** Trailing-12 bottles statewide. */
  everydayVolume: 300,
  scarceMaxVolume: 1200,
  rareMaxVolume: 600,
  unicornMaxVolume: 150,
  /** Share of trailing-12 bottles sold in the best two months. */
  unicornConcentration: 0.8,
  /** Stock observations. */
  minObservedDays: 30,
  consistentlyStocked: 0.8, // in stock on ≥80% of observed days → caps at Uncommon
  rarelyStocked: 0.5, // ≤50% → corroborates Scarce
  veryRarelyStocked: 0.25, // ≤25% → corroborates Rare/Unicorn
  wideStores: 10,
  widePeakBottles: 150, // proxy for "wide" when we have no store rows
  /** Release pattern: separate selling runs split by ≥ this many empty months. */
  releaseGapMonths: 2,
  /** A run counts toward a release pattern only if it's this big. */
  minRunBottles: 3,
  minRunShare: 0.1,
} as const;

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

// ── stock observations ───────────────────────────────────────────────────
export interface StockMetrics {
  csc: string;
  name: string;
  category: string | null;
  status: string | null;
  first_seen: Date;
  observed_days: number; // days with a successful pass since the product was known
  in_stock_days: number;
  restocks: number;
  stores_seen: number;
  stores_now: number;
  has_store_data: boolean;
  peak_shelf: number | null;
  in_stock_now: boolean;
  last_on_shelf: Date | null;
}

export interface StockCoverage {
  observedDays: number;
  spanDays: number;
  first: string;
  last: string;
  gaps: { after: string; days: number }[];
}

/**
 * Builds session temp tables (rarity_days, rarity_pd) on a reserved
 * connection; returns stock metrics for listed products plus coverage.
 */
export async function buildStockMetrics(
  db: ReservedSql,
  windowDays = 180
): Promise<{ stock: StockMetrics[]; coverage: StockCoverage }> {
  await db`drop table if exists rarity_days, rarity_pd`;
  // Observed days: at least one successful catalog pass that day (Denver).
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

  const [cov] = await db<{ observed: number; first: string; last: string; span: number }[]>`
    select count(*)::int as observed, min(d)::text as first, max(d)::text as last,
           (max(d) - min(d) + 1)::int as span
    from rarity_days`;
  const gaps = await db<{ after: string; days: number }[]>`
    select after, days from (
      select d::text as after, (lead(d) over (order by d) - d - 1)::int as days from rarity_days
    ) g where days > 0 order by after`;

  const stock = await db<StockMetrics[]>`
    with seq as (
      select csc, d, in_stock, lag(in_stock) over (partition by csc order by d) as prev
      from rarity_pd
    ),
    avail as (
      select csc, count(*)::int as observed_days,
             count(*) filter (where in_stock)::int as in_stock_days,
             count(*) filter (where in_stock and prev = false)::int as restocks
      from seq group by csc
    ),
    shelf as (
      select csc, max(store_qty) as peak_shelf from inventory_snapshots
      where scraped_at >= (select min(t_first) from rarity_days) group by csc
    ),
    shelf_prior as (
      select distinct on (csc) csc, store_qty from inventory_snapshots
      where scraped_at < (select min(t_first) from rarity_days)
      order by csc, scraped_at desc
    ),
    last_on as (
      select csc, max(coalesce(next_at, now())) as last_on_shelf
      from (
        select csc, store_qty, lead(scraped_at) over (partition by csc order by scraped_at) as next_at
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
      select csc, count(*) filter (where qty > 0)::int as stores_now from store_inventory_current group by csc
    )
    select p.csc, p.name, p.category, p.status, p.first_seen,
           coalesce(a.observed_days, 0) as observed_days,
           coalesce(a.in_stock_days, 0) as in_stock_days,
           coalesce(a.restocks, 0) as restocks,
           coalesce(st.stores_seen, 0) as stores_seen,
           coalesce(sn.stores_now, 0) as stores_now,
           sn.csc is not null as has_store_data,
           greatest(sh.peak_shelf, sp.store_qty) as peak_shelf,
           coalesce(p.store_qty, 0) > 0 as in_stock_now,
           lo.last_on_shelf
    from products p
    left join avail a using (csc)
    left join shelf sh using (csc)
    left join shelf_prior sp using (csc)
    left join last_on lo using (csc)
    left join stores st using (csc)
    left join stores_now sn using (csc)
    where p.delisted_at is null`;

  return {
    stock,
    coverage: { observedDays: cov.observed, spanDays: cov.span, first: cov.first, last: cov.last, gaps },
  };
}

// ── sales history ────────────────────────────────────────────────────────
export interface SalesMonth {
  bottles: number;
  lines: number;
  explicitZero: boolean; // report lines exist but total ≤ 0
}

export interface SalesHistory {
  code: string;
  names: string[];
  className: string | null;
  status: string | null; // DABS status on the newest line
  months: Map<string, SalesMonth>; // "YYYY-MM"
}

export async function loadSalesHistory(
  db: ReservedSql
): Promise<{ reportMonths: string[]; history: Map<string, SalesHistory> }> {
  const reportMonths = (
    await db<{ m: string }[]>`select to_char(period_month, 'YYYY-MM') as m from sales_reports order by 1`
  ).map((r) => r.m);
  const rows = await db<
    { code: string; m: string; bottles: number; lines: number; names: string[]; class_name: string | null; status: string | null }[]
  >`
    select item_code as code, to_char(period_month, 'YYYY-MM') as m,
           coalesce(sum(bottles), 0)::int as bottles, count(*)::int as lines,
           array_agg(distinct item_name) as names,
           max(class_name) as class_name,
           (array_agg(status order by line))[1] as status
    from monthly_sales group by 1, 2 order by 1, 2`;
  const history = new Map<string, SalesHistory>();
  for (const r of rows) {
    let h = history.get(r.code);
    if (!h) {
      h = { code: r.code, names: [], className: r.class_name, status: r.status, months: new Map() };
      history.set(r.code, h);
    }
    for (const n of r.names) if (n && !h.names.includes(n)) h.names.push(n);
    h.className = r.class_name ?? h.className;
    h.status = r.status ?? h.status; // rows are month-ordered, so this ends on the newest
    h.months.set(r.m, { bottles: r.bottles, lines: r.lines, explicitZero: r.bottles <= 0 });
  }
  return { reportMonths, history };
}

// ── metrics ──────────────────────────────────────────────────────────────
export interface SalesMetrics {
  firstRecord: string | null; // first month with a report line, or catalog first-seen if later-listed
  lastSold: string | null;
  recordMonths12: number; // eligible months in the trailing window (after first record)
  soldMonths12: number; // months with recorded sales > 0
  notInReport12: number; // eligible months with no report line
  explicitZero12: number; // eligible months with lines totalling ≤ 0
  bottles12: number;
  bottlesAll: number;
  soldShare12: number | null; // soldMonths12 / recordMonths12
  top2Share12: number | null; // share of trailing bottles in the best two months
  runsAll: number; // separate selling runs across all months (split by ≥ releaseGapMonths empty)
  pattern16: string; // compact month-by-month bottles, "." = no line, "0" = explicit zero
  seasonal: string | null;
}

const HOLIDAY_WORDS = /\b(NOG|EGGNOG|HOLIDAY|CHRISTMAS|XMAS|WINTER|PEPPERMINT|SANTA|MISTLETOE|GLOGG|ADVENT|NOUVEAU|GIFT SET|VAP)\b/i;
const AUTUMN_WORDS = /\b(OKTOBERFEST|PUMPKIN|HARVEST|FALL)\b/i;
const SUMMER_WORDS = /\b(SUMMER|ROSE|ROSÉ|SHANDY|RADLER)\b/i;

export function computeSalesMetrics(
  h: SalesHistory | undefined,
  reportMonths: string[],
  catalogFirstMonth: string | null,
  label: string
): SalesMetrics {
  const window = reportMonths.slice(-T.trailingMonths);
  const firstSales = h ? reportMonths.find((m) => h.months.has(m)) ?? null : null;
  // A product first listed in our catalog after its first sales month keeps
  // the sales month; one we only know from the catalog starts there.
  const firstRecord =
    firstSales && catalogFirstMonth ? (firstSales < catalogFirstMonth ? firstSales : catalogFirstMonth)
    : firstSales ?? catalogFirstMonth;
  const eligible = firstRecord ? window.filter((m) => m >= firstRecord) : [];
  let sold = 0, notIn = 0, zero = 0, bottles12 = 0;
  const monthly: number[] = [];
  for (const m of eligible) {
    const s = h?.months.get(m);
    if (!s) notIn++;
    else if (s.explicitZero) zero++;
    else {
      sold++;
      bottles12 += s.bottles;
      monthly.push(s.bottles);
    }
  }
  monthly.sort((a, b) => b - a);
  const top2 = (monthly[0] ?? 0) + (monthly[1] ?? 0);

  // Selling runs over every report month since first record, split by
  // ≥ releaseGapMonths months without recorded sales. A run that is tiny next
  // to the product's total (a stray bottle, a return) doesn't count.
  const runTotals: number[] = [];
  let gap = Infinity, bottlesAll = 0;
  let lastSold: string | null = null;
  const pattern: string[] = [];
  for (const m of reportMonths) {
    const s = h?.months.get(m);
    pattern.push(!s ? "." : s.explicitZero ? "0" : String(s.bottles));
    if (firstRecord && m < firstRecord) continue;
    if (s && !s.explicitZero) {
      if (gap >= T.releaseGapMonths) runTotals.push(0);
      runTotals[runTotals.length - 1] += s.bottles;
      gap = 0;
      bottlesAll += s.bottles;
      lastSold = m;
    } else gap++;
  }
  const runs = runTotals.filter((b) => b >= Math.max(T.minRunBottles, bottlesAll * T.minRunShare)).length;

  return {
    firstRecord,
    lastSold,
    recordMonths12: eligible.length,
    soldMonths12: sold,
    notInReport12: notIn,
    explicitZero12: zero,
    bottles12,
    bottlesAll,
    soldShare12: eligible.length ? sold / eligible.length : null,
    top2Share12: bottles12 > 0 ? top2 / bottles12 : null,
    runsAll: runs,
    pattern16: pattern.join(" "),
    seasonal: seasonality(h, reportMonths, label),
  };
}

/**
 * Seasonality is an attribute, not a tier input. With 16 months, Nov–Dec is
 * seen once, so a holiday pattern is "unconfirmed" unless the name/category
 * also says holiday; May–Aug is seen twice (2025, 2026).
 */
function seasonality(h: SalesHistory | undefined, reportMonths: string[], label: string): string | null {
  if (!h) return null;
  let total = 0, holiday = 0, summer = 0;
  const summerYears = new Set<string>();
  for (const m of reportMonths) {
    const s = h.months.get(m);
    if (!s || s.explicitZero) continue;
    total += s.bottles;
    const mm = Number(m.slice(5));
    if (mm === 11 || mm === 12) holiday += s.bottles;
    if (mm >= 5 && mm <= 8) {
      summer += s.bottles;
      summerYears.add(m.slice(0, 4));
    }
  }
  if (total < 12) return null;
  const text = `${label} ${h.names.join(" ")} ${h.className ?? ""}`;
  if (holiday / total >= 0.6) {
    return HOLIDAY_WORDS.test(text)
      ? `holiday product (name/category + ${pctStr(holiday / total)} of sales in Nov–Dec)`
      : `Nov–Dec concentrated (${pctStr(holiday / total)}; one season seen, unconfirmed)`;
  }
  if (summer / total >= 0.8 && summerYears.size >= 2) {
    return `summer-concentrated (${pctStr(summer / total)} in May–Aug, seen 2 years${SUMMER_WORDS.test(text) ? "; name fits" : ""})`;
  }
  if (AUTUMN_WORDS.test(text)) return "autumn product (name only)";
  return null;
}

// ── classification ───────────────────────────────────────────────────────
export type RarityOutcome =
  | {
      kind: "tier";
      tier: RarityTier;
      candidate: RarityTier; // what sales alone suggested
      confidence: "high" | "medium" | "low";
      reason: string;
      score: number; // ordering aid for the review only
    }
  | { kind: "insufficient"; candidate: RarityTier | null; reason: string; score: number }
  | { kind: "orderable"; reason: string }
  | { kind: "winding_down"; reason: string };

const WINDING_DOWN = new Set(["D", "X", "N", "U"]);

export function isAllocatedLabel(status: string | null, className: string | null): boolean {
  return status === "A" || /ALLOCATED/i.test(className ?? "");
}

function pctStr(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Ordering aid for the review (not a tier input): higher = rarer-looking. */
export function reviewScore(s: SalesMetrics, k: StockMetrics | undefined): number {
  const vol = 1 - Math.min(Math.log10(1 + s.bottles12) / Math.log10(1 + 10_000), 1);
  const months = 1 - (s.soldShare12 ?? 0);
  const conc = s.top2Share12 ?? 0;
  const obs = k && k.observed_days >= T.minObservedDays ? 1 - k.in_stock_days / k.observed_days : 0.5;
  return Math.round(100 * (0.4 * vol + 0.3 * months + 0.15 * conc + 0.15 * obs) * 10) / 10;
}

export function classifyRarity(
  status: string | null,
  s: SalesMetrics,
  k: StockMetrics | undefined
): RarityOutcome {
  if (status === "S") return { kind: "orderable", reason: "DABS special order — separate 'orderable' channel, no shelf tier" };
  if (status && WINDING_DOWN.has(status)) {
    return { kind: "winding_down", reason: `DABS status ${status} (discontinued / unavailable soon) — no tier` };
  }
  const score = reviewScore(s, k);

  // Stock evidence (asymmetric).
  const observed = k ? k.observed_days : 0;
  const stockKnown = observed >= T.minObservedDays;
  const inShare = stockKnown ? k!.in_stock_days / observed : null;
  const wide = k ? k.stores_seen >= T.wideStores || (!k.has_store_data && (k.peak_shelf ?? 0) >= T.widePeakBottles) : false;
  const consistently = inShare != null && inShare >= T.consistentlyStocked;
  const rarely = inShare != null && inShare <= T.rarelyStocked && !wide;
  const veryRarely = inShare != null && inShare <= T.veryRarelyStocked && !wide;
  const stockText = !k
    ? "no stock observations (not in catalog)"
    : !stockKnown
      ? `only ${observed} observed days`
      : `on shelves ${k.in_stock_days}/${observed} observed days (${pctStr(inShare!)})${wide ? ", widely stocked" : ""}`;

  // Sales evidence.
  if (!s.firstRecord) {
    return { kind: "insufficient", candidate: null, reason: `no recorded sales in any report and not newly listed; ${stockText}`, score };
  }
  if (s.recordMonths12 < T.minRecordMonths) {
    const cand = s.bottles12 > 0 ? salesCandidate(s) : null;
    return {
      kind: "insufficient",
      candidate: cand,
      reason: `new or short record (first record ${s.firstRecord ?? "none"}, ${s.recordMonths12} eligible months < ${T.minRecordMonths}); ${stockText}`,
      score,
    };
  }
  const share = s.soldShare12 ?? 0;
  const salesText = `sales in ${s.soldMonths12}/${s.recordMonths12} months, ${s.bottles12} bottles/12mo${s.top2Share12 != null ? `, top-2 months ${pctStr(s.top2Share12)}` : ""}`;
  if (s.bottles12 === 0) {
    return {
      kind: "insufficient",
      candidate: null,
      reason: `no recorded sales in the last ${s.recordMonths12} months${s.lastSold ? ` (last ${s.lastSold})` : ""} — ending, between releases, or unsold; ${stockText}`,
      score,
    };
  }

  const candidate = salesCandidate(s);
  const releasePattern = s.runsAll >= 2;
  let tier: RarityTier = candidate;
  const why: string[] = [salesText];

  // Demonstration requirements for high tiers.
  if (candidate === "unicorn") {
    if (releasePattern && veryRarely) {
      why.push(`${s.runsAll} separate selling runs (release pattern)`, stockText);
    } else if (releasePattern || veryRarely) {
      tier = "rare";
      why.push(
        releasePattern ? `${s.runsAll} selling runs but stock doesn't confirm (${stockText})` : `rarely on shelves (${stockText}) but only one selling run`,
        "Unicorn needs both → Rare"
      );
    } else {
      return {
        kind: "insufficient",
        candidate,
        reason: `${salesText}; low/concentrated sales alone (release? unpopular? ending?) — no repeated release pattern and ${stockText}`,
        score,
      };
    }
  } else if (candidate === "rare") {
    if (releasePattern || veryRarely) {
      why.push(releasePattern ? `${s.runsAll} separate selling runs` : "", stockText);
    } else {
      return {
        kind: "insufficient",
        candidate,
        reason: `${salesText}; sporadic low sales alone — no release pattern and ${stockText}`,
        score,
      };
    }
  } else if (candidate === "scarce") {
    if (releasePattern || rarely) why.push(releasePattern ? `${s.runsAll} separate selling runs` : "", stockText);
    else {
      tier = "uncommon";
      why.push(`intermittent sales not corroborated (${stockText}) → Uncommon`);
    }
  } else {
    why.push(stockText);
    // Regular sellers that are rarely on shelves: availability, not volume.
    if (share >= T.regularShare && veryRarely) {
      tier = "scarce";
      why.push("sells most months but rarely on shelves → Scarce");
    }
  }

  // Strong negative evidence caps the tier.
  if (consistently && TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf("uncommon")) {
    why.push(`capped: consistently on shelves (${pctStr(inShare!)} of ${observed} days)`);
    tier = "uncommon";
  }

  const confidence: "high" | "medium" | "low" =
    s.recordMonths12 >= 12 && observed >= 45 && k?.has_store_data ? "high"
    : s.recordMonths12 >= 9 && observed >= T.minObservedDays ? "medium"
    : "low";
  return { kind: "tier", tier, candidate, confidence, reason: why.filter(Boolean).join("; "), score };
}

/** What sales alone suggest (volume × how many months sold × concentration). */
function salesCandidate(s: SalesMetrics): RarityTier {
  const share = s.soldShare12 ?? 0;
  if (share >= T.regularShare) return s.bottles12 >= T.everydayVolume ? "everyday" : "uncommon";
  if (share < T.sporadicShare) {
    if (s.bottles12 <= T.unicornMaxVolume && (s.top2Share12 ?? 0) >= T.unicornConcentration) return "unicorn";
    if (s.bottles12 < T.rareMaxVolume) return "rare";
    return "uncommon";
  }
  return s.bottles12 < T.scarceMaxVolume ? "scarce" : "uncommon";
}
