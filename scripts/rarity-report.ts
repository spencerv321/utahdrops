import type { Sql } from "postgres";
import {
  buildRarityMetrics,
  classifyRarity,
  scoreRarity,
  RARITY_METHOD,
  TIER_CUTOFFS,
  TIER_LABELS,
  TIER_ORDER,
  type RarityMetrics,
  type RarityOutcome,
} from "../lib/rarity";

/**
 * `report.ts rarity`: the review checkpoint for the availability tiers
 * (internal only). Prints the sales-import audit, the "absent vs zero" check,
 * then tier distribution, samples per tier, products near each cutoff, the
 * least-confident classifications and what fills the top tier.
 */
export async function rarityReport(sql: Sql) {
  const line = (s = "") => console.log(s);
  const head = (s: string) => line(`\n## ${s}`);
  const db = await sql.reserve();
  try {
    await db`set client_min_messages = warning`;
    head("sales import");
    for (const r of await db`
      select to_char(period_month, 'YYYY-MM') as month, fiscal_label, lines, item_codes, reused_codes,
             sum_dollars::float, reported_dollars::float, sum_bottles, imported_at
      from sales_reports order by period_month`) {
      const ok = r.reported_dollars == null ? "no total" : Math.abs(r.sum_dollars - r.reported_dollars) <= 1 ? "reconciled" : "MISMATCH";
      line(`${r.month} ${r.fiscal_label.padEnd(8)} lines ${r.lines} codes ${r.item_codes} reused ${r.reused_codes} bottles ${r.sum_bottles} $${Math.round(r.sum_dollars)} ${ok}`);
    }
    const [um] = await db`
      select count(distinct item_code)::int as codes,
             count(distinct item_code) filter (where exists (select 1 from products p where p.csc = m.item_code))::int as matched
      from monthly_sales m`;
    line(`codes across all months: ${um.codes}, in our catalog: ${um.matched} (${pct(um.matched, um.codes)})`);

    const t0 = Date.now();
    const metrics = await buildRarityMetrics(db);
    const [cov] = await db`
      select count(*)::int as days, min(d)::text as first, max(d)::text as last,
             (max(d) - min(d) + 1)::int as span from rarity_days`;
    head(`observation window (method ${RARITY_METHOD})`);
    line(`${cov.days} observed days out of ${cov.span} (${cov.first} → ${cov.last}); ${metrics.length} listed products; built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    for (const r of await db`
      select d::text as from, lead(d) over (order by d)::text as to,
             (lead(d) over (order by d) - d - 1)::int as missing
      from rarity_days order by d`) {
      if (r.missing > 0) line(`  gap: ${r.missing} day(s) with no successful catalog pass after ${r.from}`);
    }

    await absentVsZero(db, line, head);

    const rows = metrics.map((m) => ({ m, o: classifyRarity(m) }));
    const tiered = rows.filter((r): r is { m: RarityMetrics; o: Extract<RarityOutcome, { kind: "tier" }> } => r.o.kind === "tier");

    head("outcomes");
    const outcome = (o: RarityOutcome) => (o.kind === "tier" ? `tier: ${TIER_LABELS[o.tier]}` : o.kind === "orderable" ? "orderable (special order)" : `${o.kind}: ${o.reason}`);
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(outcome(r.o), (counts.get(outcome(r.o)) ?? 0) + 1);
    for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1])) line(`${String(n).padStart(6)}  ${k}`);

    head("tier distribution (score cutoffs: " + TIER_CUTOFFS.map(([t, c]) => `${TIER_LABELS[t]} ≥${c}`).join(", ") + ")");
    for (const t of [...TIER_ORDER].reverse()) {
      const inTier = tiered.filter((r) => r.o.tier === t);
      const conf = ["high", "medium", "low"].map((c) => `${c} ${inTier.filter((r) => r.o.confidence === c).length}`).join(" / ");
      line(`${TIER_LABELS[t].padEnd(9)} ${String(inTier.length).padStart(6)}  ${pct(inTier.length, tiered.length).padStart(6)}   confidence ${conf}`);
    }

    head("tier × DABS status (are we just reproducing 'Allocated'?)");
    const statuses = [...new Set(tiered.map((r) => r.m.status ?? "?"))].sort();
    line("tier       " + statuses.map((s) => s.padStart(6)).join(""));
    for (const t of [...TIER_ORDER].reverse()) {
      line(TIER_LABELS[t].padEnd(11) + statuses.map((s) => String(tiered.filter((r) => r.o.tier === t && (r.m.status ?? "?") === s).length).padStart(6)).join(""));
    }

    head("tier × category (top categories)");
    const cats = [...countBy(tiered, (r) => r.m.category ?? "?")].sort((a, b) => b[1] - a[1]).slice(0, 14);
    for (const [cat, n] of cats) {
      line(`${cat.slice(0, 28).padEnd(28)} ${String(n).padStart(5)}  ` + [...TIER_ORDER].reverse().map((t) => `${TIER_LABELS[t].slice(0, 3)} ${tiered.filter((r) => r.o.tier === t && (r.m.category ?? "?") === cat).length}`).join("  "));
    }

    const sorted = [...tiered].sort((a, b) => b.o.score - a.o.score);
    head("top 30 scores (what fills the top tier?)");
    sorted.slice(0, 30).forEach((r) => line(fmt(r.m, r.o)));

    for (const t of [...TIER_ORDER].reverse()) {
      const inTier = sorted.filter((r) => r.o.tier === t);
      head(`${TIER_LABELS[t]}: ${Math.min(12, inTier.length)} representative products (spread across the tier's score range)`);
      spread(inTier, 12).forEach((r) => line(fmt(r.m, r.o)));
    }

    for (const [t, cut] of TIER_CUTOFFS.slice(0, -1)) {
      head(`around the ${TIER_LABELS[t]} cutoff (${cut}): 5 just above, 5 just below`);
      const above = sorted.filter((r) => r.o.score >= cut).slice(-5);
      const below = sorted.filter((r) => r.o.score < cut).slice(0, 5);
      above.forEach((r) => line("▲ " + fmt(r.m, r.o)));
      below.forEach((r) => line("▼ " + fmt(r.m, r.o)));
    }

    head("least confident classifications (fewest observed days, then flags)");
    [...tiered]
      .sort((a, b) => a.m.observed_days - b.m.observed_days || b.o.flags.length - a.o.flags.length)
      .slice(0, 15)
      .forEach((r) => line(fmt(r.m, r.o)));

    head("flagged: code reused in sales files, among Scarce and above");
    tiered.filter((r) => r.o.flags.includes("code reused in sales files") && TIER_ORDER.indexOf(r.o.tier) >= 2)
      .slice(0, 12).forEach((r) => line(fmt(r.m, r.o)));

    head("never seen on shelves in the window, but DABS sold some (drawing-only / allocated candidates)");
    rows.filter((r) => r.o.kind === "unclassified" && r.o.reason === "not seen on shelves" && (r.m.bottles_12mo ?? 0) > 0)
      .sort((a, b) => (b.m.bottles_12mo ?? 0) - (a.m.bottles_12mo ?? 0))
      .slice(0, 20).forEach((r) => line(fmt(r.m, r.o)));

    head("in DABS sales (last 3 months) but not in our catalog: top sellers");
    for (const r of await db`
      select item_code, max(item_name) as name, max(class_name) as class, max(status) as status, sum(bottles)::int as bottles
      from monthly_sales m
      where period_month > (select max(period_month) from sales_reports) - interval '3 months'
        and not exists (select 1 from products p where p.csc = m.item_code)
      group by item_code order by bottles desc limit 15`) {
      line(`${r.item_code} ${r.name} · ${r.class} · status ${r.status} · ${r.bottles} bottles`);
    }
  } finally {
    await db`drop table if exists rarity_days, rarity_pd`.catch(() => {});
    db.release();
  }
  await sql.end();
}

/**
 * Is "absent from a month's sales report" the same as "sold zero"? Products
 * we saw on shelves on every observed day of a month almost certainly sold
 * something, so they should all be in that month's report.
 */
async function absentVsZero(db: Awaited<ReturnType<Sql["reserve"]>>, line: (s?: string) => void, head: (s: string) => void) {
  head("absent vs zero: products on shelves every observed day of a month — are they in that month's report?");
  const months = await db`
    select date_trunc('month', d)::date as month, count(*)::int as days
    from rarity_days group by 1 order by 1`;
  const reported = new Set(
    (await db`select to_char(period_month, 'YYYY-MM') as m from sales_reports`).map((r) => r.m as string)
  );
  for (const { month, days } of months) {
    const key = String(month instanceof Date ? month.toISOString() : month).slice(0, 7);
    if (!reported.has(key)) {
      line(`${key}: ${days} observed days — no sales report yet`);
      continue;
    }
    if (days < 15) {
      line(`${key}: only ${days} observed days — skipped`);
      continue;
    }
    const [r] = await db`
      with full_month as (
        select pd.csc from rarity_pd pd
        join products p using (csc)
        where date_trunc('month', pd.d) = ${month}::date and coalesce(p.status, '') <> 'S'
        group by pd.csc
        having count(*) = ${days} and bool_and(pd.in_stock)
      )
      select count(*)::int as on_shelf_all_month,
             count(*) filter (where not exists (
               select 1 from monthly_sales m where m.item_code = f.csc and m.period_month = ${month}::date
             ))::int as absent,
             (array_agg(f.csc || ' ' || p.name) filter (where not exists (
               select 1 from monthly_sales m where m.item_code = f.csc and m.period_month = ${month}::date
             )))[1:10] as absent_sample
      from full_month f join products p using (csc)`;
    line(`${key}: ${days} observed days · ${r.on_shelf_all_month} products on shelves every day · ${r.absent} absent from the report (${pct(r.absent, r.on_shelf_all_month)})`);
    for (const s of r.absent_sample ?? []) line(`    absent: ${s}`);
    const [z] = await db`
      select count(*)::int as n from monthly_sales
      where period_month = ${month}::date and coalesce(bottles, 0) <= 0`;
    line(`    lines with 0 or negative bottles in that report: ${z.n}`);
  }
}

function fmt(m: RarityMetrics, o: RarityOutcome): string {
  const { parts } = scoreRarity(m);
  const tier = o.kind === "tier" ? `${TIER_LABELS[o.tier]} ${o.score.toFixed(1)} (${o.confidence})` : o.kind === "unclassified" ? `unclassified ${o.score?.toFixed(1) ?? ""}` : o.kind;
  const last = m.in_stock_now ? "on shelves now" : m.last_on_shelf ? `last on shelves ${new Date(m.last_on_shelf).toISOString().slice(0, 10)}` : "never on shelves";
  const sales = m.months_sold > 0
    ? `sold in ${m.months_sold} mo, ${m.bottles_12mo ?? 0} btl/12mo, last ${m.last_sold_month}`
    : "no DABS sales";
  const flags = o.kind === "tier" && o.flags.length ? ` ⚑ ${o.flags.join(", ")}` : "";
  return `${tier} | ${m.name} [${m.csc}] ${m.category ?? "?"} · DABS ${m.status ?? "?"} | in stock ${m.in_stock_days}/${m.observed_days} days (${parts.avail}%), ${m.restocks} restocks, stretch ~${m.median_stretch_days ?? "–"}d · ${m.stores_seen} stores seen (${m.stores_now} now) · peak ${m.peak_shelf ?? "–"} on shelves · ${last} | ${sales}${flags}`;
}

function spread<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  return Array.from({ length: n }, (_, i) => arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
}

function countBy<T>(arr: T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of arr) m.set(key(a), (m.get(key(a)) ?? 0) + 1);
  return m;
}

function pct(a: number, b: number): string {
  return b ? `${((100 * a) / b).toFixed(1)}%` : "–";
}
