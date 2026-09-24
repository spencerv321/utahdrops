import type { ReservedSql } from "postgres";

/**
 * Utah availability ("rarity") — EXPERIMENTAL, internal only (report.ts
 * rarity). Nothing here is shown on the site.
 *
 * Method v2: three kinds of evidence, kept separate and shown as facts —
 * - recorded sales: DABS monthly Sales Analysis (trailing 12 report months;
 *   all months for context). Context only; never sets a tier by itself.
 * - shelf availability: our catalog passes (share of observed days in stock
 *   somewhere in Utah) plus per-store history (how many stores typically
 *   carry it). Days without a successful pass — e.g. the Aug–Sep 2026
 *   scraper outage — are excluded from every denominator. Seasonal products
 *   are judged only on observations from their season.
 * - access method, verified from DABS's own pages: RHDP drawings (exact item
 *   code) and monthly allocated drops (exact catalog name, one code only);
 *   DABS status S = special order.
 *
 * Tiers (shopper label → collectible tier):
 *   DABS drawing → Unicorn (≥ unicornEntriesPerBottle entries per
 *     bottle in its latest drawing) or Rare
 *   Allocated release → Rare (largest statewide drop ≤ rareDropBottles) or
 *     Scarce — unless shelf observations show it widely and consistently in
 *     stock, which wins
 *   Hard to find (in stock < hardToFind of observed days, with evidence it
 *     exists: a sellout seen, or sales recorded in observed months) → Scarce
 *   Intermittently available (hardToFind … consistently) → Uncommon
 *   In stock most days at a few stores (typical < wideStores) → Uncommon
 *   Widely available (in stock ≥ consistently of days, typical ≥ wideStores
 *     stores) → Everyday
 * Anything else gets facts only (no tier). DABS labels (status, "allocated"
 * class, special-order class) are shown separately and never change a tier.
 */
export const RARITY_METHOD = "v2-evidence";
export const RARITY_TZ = "America/Denver";

// ── thresholds (proposed; tuned from the review) ─────────────────────────
export const T = {
  trailingMonths: 12,
  /** Share of observed days in stock somewhere in Utah. */
  consistently: 0.8,
  hardToFind: 0.25,
  /** Median stores carrying it on in-stock days. */
  wideStores: 10,
  /** Observation needed for a shelf tier. */
  minObservedDays: 30,
  minStoreDays: 10,
  /** Drawings: entries per bottle offered in the latest drawing. */
  unicornEntriesPerBottle: 100,
  /** Allocated drops: bottles statewide in its largest drop. */
  rareDropBottles: 100,
  /** Release runs in sales (facts only): split by ≥ this many empty months. */
  releaseGapMonths: 2,
  minRunBottles: 6,
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
  sellouts: number; // in stock on one observed day, out on the next observed day
  stores_seen: number;
  stores_now: number;
  has_store_data: boolean;
  store_days: number; // in-stock observed days with per-store data
  typical_stores: number | null; // median stores stocking it on those days
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
  holidayObserved: boolean; // any observed day in Nov–Dec
}

/**
 * Builds session temp tables (rarity_days, rarity_pd) on a reserved
 * connection; returns stock metrics for listed products plus coverage.
 */
export async function buildStockMetrics(
  db: ReservedSql,
  windowDays = 180
): Promise<{ stock: StockMetrics[]; coverage: StockCoverage }> {
  await db`drop table if exists rarity_days, rarity_pd, rarity_store_days`;
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
  // Stores stocking the product on each in-stock observed day, from the
  // delta-encoded per-store history (each row holds until the next one for
  // that store). Days before the product's first store check are unknown.
  await db`drop table if exists rarity_store_days`;
  await db`
    create temp table rarity_store_days as
    with si as (
      select csc, store_id, qty > 0 as pos, scraped_at as t0,
             coalesce(lead(scraped_at) over (partition by csc, store_id order by scraped_at), 'infinity') as t1
      from store_inventory
    ),
    first_check as (select csc, min(scraped_at) as t from store_inventory group by csc)
    select pd.csc, pd.d, count(distinct si.store_id) filter (where si.pos)::int as stores
    from rarity_pd pd
    join rarity_days dy on dy.d = pd.d
    join first_check fc on fc.csc = pd.csc and fc.t <= dy.t_last
    left join si on si.csc = pd.csc and si.t0 <= dy.t_last and si.t1 > dy.t_first
    where pd.in_stock
    group by pd.csc, pd.d`;

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
             count(*) filter (where in_stock and prev = false)::int as restocks,
             count(*) filter (where not in_stock and prev = true)::int as sellouts
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
    ),
    store_days as (
      select csc, count(*)::int as store_days,
             percentile_cont(0.5) within group (order by stores)::float as typical_stores
      from rarity_store_days group by csc
    )
    select p.csc, p.name, p.category, p.status, p.first_seen,
           coalesce(a.observed_days, 0) as observed_days,
           coalesce(a.in_stock_days, 0) as in_stock_days,
           coalesce(a.restocks, 0) as restocks,
           coalesce(a.sellouts, 0) as sellouts,
           coalesce(st.stores_seen, 0) as stores_seen,
           coalesce(sn.stores_now, 0) as stores_now,
           sn.csc is not null as has_store_data,
           coalesce(sd.store_days, 0) as store_days,
           sd.typical_stores,
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
    left join store_days sd using (csc)
    where p.delisted_at is null`;

  return {
    stock,
    coverage: {
      observedDays: cov.observed, spanDays: cov.span, first: cov.first, last: cov.last, gaps,
      holidayObserved: (await db<{ n: number }[]>`
        select count(*)::int as n from rarity_days where extract(month from d) in (11, 12)`)[0].n > 0,
    },
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
  monthly: Map<string, number>; // bottles by report month (lines present, > 0)
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
    monthly: new Map([...(h?.months ?? new Map<string, SalesMonth>())].filter(([, v]) => !v.explicitZero).map(([m, v]) => [m, v.bottles])),
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

// ── access evidence (verified from DABS pages) ───────────────────────────
export interface DrawingEvidence {
  drawing: string;
  bottles: number | null;
  entries: number | null;
  price: number | null;
  lastSeen: Date;
}
export interface DropEvidence {
  drops: number; // distinct drop dates
  largestDropBottles: number; // bottles statewide in its largest drop
  lastDrop: string;
  stores: number; // distinct store rows across drops
}

export async function loadAccessEvidence(db: ReservedSql): Promise<{
  drawings: Map<string, DrawingEvidence[]>;
  drops: Map<string, DropEvidence>;
  dropNamesUnmatched: string[];
}> {
  const drawings = new Map<string, DrawingEvidence[]>();
  const drawRows = await db<{ item_code: string; drawing: string; bottles: number | null; entries: number | null; price: string | null; last_seen: Date }[]>`
    select item_code, drawing, bottles, entries, price::text, last_seen from rhdp_drawings order by last_seen desc, drawing desc`
    .catch(() => []);
  for (const r of drawRows) {
    const list = drawings.get(r.item_code) ?? [];
    list.push({ drawing: r.drawing, bottles: r.bottles, entries: r.entries, price: r.price != null ? Number(r.price) : null, lastSeen: r.last_seen });
    drawings.set(r.item_code, list);
  }
  // Allocated drops carry no item code; match the exact DABS name to exactly
  // one code (catalog names first, then names in the sales files).
  const dropRows = await db<{ name: string; code: string | null; codes: number; drops: number; largest: number; last_drop: string; stores: number }[]>`
    with d as (
      select upper(regexp_replace(product_name, '\s+', ' ', 'g')) as name, drop_date,
             sum(coalesce(bottle_qty, 0))::int as bottles, count(*)::int as store_rows
      from allocated_drops group by 1, 2
    ),
    names as (
      select upper(regexp_replace(name, '\s+', ' ', 'g')) as name, csc as code from products
      union
      select upper(regexp_replace(item_name, '\s+', ' ', 'g')), item_code from monthly_sales
    ),
    m as (
      select d.name, count(distinct n.code)::int as codes, min(n.code) as code
      from (select distinct name from d) d left join names n using (name) group by d.name
    )
    select m.name, case when m.codes = 1 then m.code end as code, m.codes,
           count(distinct d.drop_date)::int as drops, max(d.bottles)::int as largest,
           max(d.drop_date)::text as last_drop, sum(d.store_rows)::int as stores
    from m join d using (name) group by m.name, m.code, m.codes`;
  const drops = new Map<string, DropEvidence>();
  const dropNamesUnmatched: string[] = [];
  for (const r of dropRows) {
    if (!r.code) {
      dropNamesUnmatched.push(`${r.name} (${r.codes} codes)`);
      continue;
    }
    drops.set(r.code, { drops: r.drops, largestDropBottles: r.largest, lastDrop: r.last_drop, stores: r.stores });
  }
  return { drawings, drops, dropNamesUnmatched };
}

// ── classification ───────────────────────────────────────────────────────
export type ShopperLabel =
  | "DABS drawing"
  | "Allocated release"
  | "Hard to find"
  | "Intermittently available"
  | "In stock at a few stores"
  | "Widely available"
  | "Special order"
  | "Being discontinued"
  | "Not observed in season"
  | "Facts only";

export interface RarityResult {
  label: ShopperLabel;
  tier: RarityTier | null;
  confidence: "high" | "medium" | "low" | null;
  access: string; // how it's sold, with its evidence
  reason: string;
  facts: string[];
  dabsLabels: string[]; // DABS's own labels, never tier inputs
  notListed: boolean; // not in the current catalog (sales/drawing only)
}

const WINDING_DOWN = new Set(["D", "X", "N", "U"]);
const LIMITED_PACK = /\bVAP\b|W\/ ?(GLASS|FLASK|FL\b)|GLASSES|GIFT (PK|PACK|SET)|DECANTER|LTD ED|LIMITED ED|SPECIAL RELEASE|LUNAR/i;

export function isAllocatedLabel(status: string | null, className: string | null): boolean {
  return status === "A" || /ALLOCATED/i.test(className ?? "");
}

function pctStr(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function classifyRarity(input: {
  name: string;
  status: string | null;
  className: string | null;
  sales: SalesMetrics;
  stock: StockMetrics | undefined;
  drawings: DrawingEvidence[] | undefined;
  drop: DropEvidence | undefined;
  holidayObserved: boolean;
  /** Report months (YYYY-MM) that overlap our observation window. */
  observedMonths: string[];
}): RarityResult {
  const { name, status, className, sales: s, stock: k, drawings, drop } = input;

  // Facts, always.
  const facts: string[] = [];
  facts.push(s.bottles12 > 0 || s.recordMonths12 > 0
    ? `recorded sales: ${s.bottles12} bottles in ${s.soldMonths12} of ${s.recordMonths12} report months (last ${s.lastSold ?? "none"})`
    : "recorded sales: none in the DABS reports");
  const observed = k?.observed_days ?? 0;
  const share = k && observed ? k.in_stock_days / observed : null;
  if (!k) facts.push("shelf availability: not tracked (not in the current catalog)");
  else facts.push(`shelf availability: in stock somewhere on ${k.in_stock_days}/${observed} observed days (${share != null ? pctStr(share) : "–"})` +
    (k.store_days ? `, typically at ${k.typical_stores} store(s) when in stock (${k.store_days} days with store data)` : ", store coverage unknown") +
    (k.sellouts ? `, sold out ${k.sellouts}×` : ""));
  const latestDraw = drawings?.[0];
  if (drawings?.length) {
    facts.push(`DABS drawings: ${drawings.map((d) => `${d.drawing}: ${d.bottles ?? "?"} bottles, ${d.entries ?? "?"} entries`).join("; ")}`);
  }
  if (drop) facts.push(`DABS allocated drops: ${drop.drops} (largest ${drop.largestDropBottles} bottles statewide, last ${drop.lastDrop})`);

  const dabsLabels: string[] = [];
  if (status) dabsLabels.push(`status ${status}`);
  if (isAllocatedLabel(status, className)) dabsLabels.push("allocated label");
  if (/^SPECIAL ORDERS/i.test(className ?? "")) dabsLabels.push("special-orders class");
  if (LIMITED_PACK.test(name)) dabsLabels.push("limited-edition/gift pack (name)");
  if (s.seasonal) dabsLabels.push(`season: ${s.seasonal}`);

  const base = { facts, dabsLabels, notListed: !k };
  const result = (label: ShopperLabel, tier: RarityTier | null, confidence: RarityResult["confidence"], access: string, reason: string): RarityResult =>
    ({ label, tier, confidence, access, reason, ...base });

  // Access method, strongest evidence first.
  if (drawings?.length && latestDraw) {
    const epb = latestDraw.entries != null && latestDraw.bottles ? latestDraw.entries / latestDraw.bottles : null;
    const tier: RarityTier = epb != null && epb >= T.unicornEntriesPerBottle ? "unicorn" : "rare";
    // Locator stock for a drawing product is shown as a fact only: it may be
    // bottles held for winners, so it never makes the product "on shelves".
    return result("DABS drawing", tier, "high",
      `DABS drawing (verified by item code, ${drawings.length} drawing(s))`,
      `${latestDraw.bottles ?? "?"} bottles offered to ${latestDraw.entries ?? "?"} entries in ${latestDraw.drawing}` +
      (epb != null ? ` (${Math.round(epb)} entries per bottle ${tier === "unicorn" ? "≥" : "<"} ${T.unicornEntriesPerBottle})` : ""));
  }
  if (status === "S") return result("Special order", null, null, "special order (DABS status S)", "orderable through DABS; no shelf tier");
  if (status && WINDING_DOWN.has(status)) return result("Being discontinued", null, null, `DABS status ${status}`, "discontinued or unavailable soon; no tier");

  // Shelf evidence (season-aware).
  const holidayItem = !!s.seasonal && /(holiday product|Nov–Dec)/.test(s.seasonal);
  const inSeason = !holidayItem || input.holidayObserved;
  const enoughDays = !!k && observed >= T.minObservedDays && inSeason;
  const storesKnown = !!k && k.store_days >= T.minStoreDays && k.typical_stores != null;
  const consistently = enoughDays && share! >= T.consistently;
  const wide = storesKnown && k!.typical_stores! >= T.wideStores;
  const shelfConfidence: RarityResult["confidence"] =
    enoughDays && observed >= 45 && storesKnown ? "high" : enoughDays && storesKnown ? "medium" : "low";

  if (drop) {
    if (consistently && wide) {
      return result("Widely available", "everyday", shelfConfidence, "allocated drops, but also on shelves",
        `appeared in ${drop.drops} allocated drop(s), yet in stock ${pctStr(share!)} of observed days at ~${k!.typical_stores} stores — shelf evidence wins`);
    }
    const tier: RarityTier = drop.largestDropBottles <= T.rareDropBottles ? "rare" : "scarce";
    return result("Allocated release", tier, "high", "DABS allocated drop (verified by exact name)",
      `largest drop ${drop.largestDropBottles} bottles statewide (${tier === "rare" ? "≤" : ">"} ${T.rareDropBottles})` +
      (enoughDays ? `; in stock ${pctStr(share!)} of observed days` : ""));
  }

  const access = "regular shelves";
  if (!k) return result("Facts only", null, null, "not in the current catalog", "no shelf data and no verified drawing/drop");
  if (!inSeason) {
    return result("Not observed in season", null, null, access,
      `holiday product; no observed days in Nov–Dec yet (${s.seasonal})`);
  }
  if (!enoughDays) return result("Facts only", null, null, access, `only ${observed} observed days (< ${T.minObservedDays})`);

  if (share! >= T.consistently) {
    if (!storesKnown) return result("Facts only", null, null, access, `in stock ${pctStr(share!)} of observed days, but store coverage unknown — can't tell wide from one store`);
    return wide
      ? result("Widely available", "everyday", shelfConfidence, access, `in stock ${pctStr(share!)} of observed days, typically at ${k.typical_stores} stores`)
      : result("In stock at a few stores", "uncommon", shelfConfidence, access, `in stock ${pctStr(share!)} of observed days but typically at only ${k.typical_stores} store(s)`);
  }
  if (share! >= T.hardToFind) {
    return result("Intermittently available", "uncommon", shelfConfidence, access, `in stock somewhere on ${pctStr(share!)} of observed days`);
  }
  // Rarely/never seen: needs evidence the bottle exists and moves.
  const soldWhileWatched = input.observedMonths.filter((m) => (s.monthly.get(m) ?? 0) > 0).length;
  if (k.sellouts > 0 || soldWhileWatched > 0) {
    return result("Hard to find", "scarce", shelfConfidence, access,
      `in stock on only ${pctStr(share!)} of observed days` +
      (k.sellouts ? `; seen selling out ${k.sellouts}×` : "") +
      (soldWhileWatched ? `; sales recorded in ${soldWhileWatched} month(s) we were watching` + (k.in_stock_days === 0 ? " though never seen in stock (gone between checks?)" : "") : ""));
  }
  return result("Facts only", null, null, access, `in stock ${pctStr(share!)} of observed days, no sellout seen and no sales while watched — may not be stocked at all`);
}
