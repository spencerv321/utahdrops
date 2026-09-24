import { createHash } from "node:crypto";
import type { ReservedSql, Sql } from "postgres";
import {
  buildStockMetrics,
  classifyRarity,
  computeSalesMetrics,
  isAllocatedLabel,
  loadSalesHistory,
  RARITY_METHOD,
  T,
  TIER_LABELS,
  TIER_ORDER,
  type RarityOutcome,
  type SalesMetrics,
  type StockMetrics,
} from "../lib/rarity";

/**
 * `report.ts rarity`: internal review of the experimental availability tiers
 * (method v1, sales-led). Prints thresholds, coverage, the "absent vs zero"
 * check, outcome counts, random products per tier, the review cohorts
 * (obscure wines, everyday spirits, seasonal, new, discontinued, famous
 * bottles), products near each cutoff, the highest-scoring non-allocated
 * products, and questionable classifications. Every line shows the component
 * metrics and the reason.
 */

interface Row {
  code: string;
  name: string;
  className: string | null; // DABS class (sales file) or catalog category
  status: string | null; // DABS status (catalog, else newest sales line)
  inCatalog: boolean;
  sales: SalesMetrics;
  stock: StockMetrics | undefined;
  o: RarityOutcome;
}

export async function rarityReport(sql: Sql) {
  const out = (s = "") => console.log(s);
  const head = (s: string) => out(`\n## ${s}`);
  const db = await sql.reserve();
  try {
    await db`set client_min_messages = warning`;
    const t0 = Date.now();
    const { stock, coverage } = await buildStockMetrics(db);
    const { reportMonths, history } = await loadSalesHistory(db);
    const [{ bootstrap }] = await db<{ bootstrap: Date }[]>`select min(first_seen) as bootstrap from products`;
    const newAfter = new Date(new Date(bootstrap).getTime() + 7 * 86400_000);

    const rows: Row[] = [];
    for (const k of stock) {
      const h = history.get(k.csc);
      const catalogFirst = new Date(k.first_seen) > newAfter ? new Date(k.first_seen).toISOString().slice(0, 7) : null;
      const sales = computeSalesMetrics(h, reportMonths, catalogFirst, k.name);
      rows.push({
        code: k.csc, name: k.name, className: h?.className ?? k.category, status: k.status,
        inCatalog: true, sales, stock: k, o: classifyRarity(k.status, sales, k, { name: k.name, className: h?.className ?? k.category }),
      });
    }
    // Sales-only codes (not in our catalog): classified without stock data.
    const listed = new Set(stock.map((k) => k.csc));
    const salesOnly: Row[] = [];
    for (const h of history.values()) {
      if (listed.has(h.code)) continue;
      const sales = computeSalesMetrics(h, reportMonths, null, h.names[0] ?? "");
      if (sales.bottles12 === 0) continue;
      salesOnly.push({
        code: h.code, name: h.names.at(-1) ?? h.code, className: h.className, status: h.status,
        inCatalog: false, sales, stock: undefined, o: classifyRarity(h.status, sales, undefined, { name: h.names.at(-1) ?? "", className: h.className }),
      });
    }

    head(`method ${RARITY_METHOD} — EXPERIMENTAL, internal only (built in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    out("thresholds:");
    out(`  sales window: trailing ${T.trailingMonths} report months (${reportMonths.slice(-T.trailingMonths)[0]} → ${reportMonths.at(-1)}); context: all ${reportMonths.length} (${reportMonths[0]} →)`);
    out(`  months only count after a product's first record; need ≥${T.minRecordMonths} eligible months, else "insufficient evidence"`);
    out(`  sales pattern: regular = sales in ≥${T.regularShare * 100}% of eligible months; sporadic = <${T.sporadicShare * 100}%; intermittent between`);
    out(`  sales-only candidate: regular ≥${T.everydayVolume} btl/12mo → Everyday; regular <${T.everydayVolume} → Uncommon;`);
    out(`    intermittent <${T.scarceMaxVolume} → Scarce; sporadic <${T.rareMaxVolume} → Rare; sporadic ≤${T.unicornMaxVolume} with top-2 months ≥${T.unicornConcentration * 100}% → Unicorn; otherwise Uncommon`);
    out(`  evidence floor: <${T.minEvidenceBottles} bottles recorded in all months → insufficient; special-order class or case-size-only sales never seen on shelves → insufficient`);
    out(`  seasonal (holiday product / summer seen 2 years) with ≥${T.everydayVolume} btl/12mo → at most Uncommon; gift/value-added packs → at most Uncommon`);
    out(`  corroboration: Scarce needs a release pattern (≥2 selling runs split by ≥${T.releaseGapMonths} empty months; a run counts if ≥${T.minRunBottles} bottles and ≥${T.minRunShare * 100}% of the product's total) or on shelves ≤${T.rarelyStocked * 100}% of observed days (must have been seen on shelves AND seen selling out; never seen, or only in its current stretch, corroborates nothing)`);
    out(`    Rare needs a release pattern or ≤${T.veryRarelyStocked * 100}% on shelves; Unicorn needs BOTH (one alone → Rare); none → insufficient evidence`);
    out(`    regular sellers on shelves ≤${T.veryRarelyStocked * 100}% of days → Scarce; ≤${T.rarelyStocked * 100}% → at least Uncommon (availability, not volume)`);
    out(`  decisive: on shelves ≥${T.consistentlyStocked * 100}% of ≥${T.minObservedDays} observed days → at most Uncommon (strong evidence against rarity)`);
    out(`  Rare+ that is on shelves now at ≥5 stores or ≥100 bottles → low confidence (the outage hides Aug–Sep; may be a recent arrival)`);
    out(`  DABS status: S → orderable; D/X/N/U → winding down (no tier); status and DABS 'allocated' labels never change the tier`);
    out(`  confidence: high = 12 eligible months + ≥45 observed days + store rows; medium = 9 months + ≥${T.minObservedDays} days; else low`);

    head("coverage");
    const salesRows = await db<{ m: string; lines: number; codes: number; reused: number; ok: boolean }[]>`
      select to_char(period_month, 'YYYY-MM') as m, lines, item_codes as codes, reused_codes as reused,
             (reported_dollars is null or abs(sum_dollars - reported_dollars) <= 1) as ok
      from sales_reports order by period_month`;
    out(`sales reports: ${salesRows.length} months, all reconciled: ${salesRows.every((r) => r.ok)}; codes reused across lines per month: ${salesRows.map((r) => r.reused).join(" ")}`);
    out(`stock observations: ${coverage.observedDays} observed days of ${coverage.spanDays} (${coverage.first} → ${coverage.last}) = ${pct(coverage.observedDays, coverage.spanDays)} coverage`);
    for (const g of coverage.gaps) out(`  excluded gap: ${g.days} day(s) with no successful catalog pass after ${g.after}`);
    const withStores = stock.filter((k) => k.has_store_data).length;
    out(`listed products: ${stock.length}; with any per-store rows: ${withStores}; sales-only codes with trailing sales: ${salesOnly.length}`);

    await absentVsZero(db, out, head);

    head("outcomes (listed products)");
    const label = (o: RarityOutcome) =>
      o.kind === "tier" ? `tier ${TIER_LABELS[o.tier]}` : o.kind === "insufficient" ? `insufficient evidence${o.candidate ? ` (sales suggested ${TIER_LABELS[o.candidate]})` : ""}` : o.kind;
    for (const [k, n] of [...countBy(rows, (r) => label(r.o))].sort((a, b) => b[1] - a[1])) out(`${String(n).padStart(6)}  ${k}`);

    const tiered = rows.filter((r) => r.o.kind === "tier") as (Row & { o: Extract<RarityOutcome, { kind: "tier" }> })[];
    head("tier distribution × confidence × DABS status (DABS labels are separate; shown for comparison)");
    const statuses = ["1", "L", "T", "A", "P"];
    out("tier        total   high  med   low  | " + statuses.map((s) => `st ${s}`.padStart(6)).join("") + "  alloc-label");
    for (const t of [...TIER_ORDER].reverse()) {
      const g = tiered.filter((r) => r.o.tier === t);
      const c = (x: string) => String(g.filter((r) => r.o.confidence === x).length).padStart(5);
      out(`${TIER_LABELS[t].padEnd(10)} ${String(g.length).padStart(6)} ${c("high")} ${c("medium")} ${c("low")}  | ` +
        statuses.map((s) => String(g.filter((r) => r.status === s).length).padStart(6)).join("") +
        String(g.filter((r) => isAllocatedLabel(r.status, r.className)).length).padStart(12));
    }
    head("sales candidate → final tier (how often stock/corroboration changed it)");
    for (const c of TIER_ORDER) {
      const g = rows.filter((r) => (r.o.kind === "tier" || r.o.kind === "insufficient") && r.o.candidate === c);
      if (!g.length) continue;
      const finals = countBy(g, (r) => (r.o.kind === "tier" ? TIER_LABELS[r.o.tier] : "insufficient"));
      out(`${TIER_LABELS[c].padEnd(9)} → ${[...finals].map(([k, n]) => `${k} ${n}`).join(", ")}`);
    }
    head("seasonal attribute (independent of tier)");
    for (const [k, n] of [...countBy(rows.filter((r) => r.sales.seasonal), (r) => r.sales.seasonal!.replace(/\(.*$/, "").trim())].sort((a, b) => b[1] - a[1])) {
      out(`${String(n).padStart(6)}  ${k}`);
    }

    const pick = (arr: Row[], n: number, seed: string) =>
      [...arr].sort((a, b) => h(seed + a.code).localeCompare(h(seed + b.code))).slice(0, n);

    for (const t of [...TIER_ORDER].reverse()) {
      const g = tiered.filter((r) => r.o.tier === t);
      head(`${TIER_LABELS[t]} — ${Math.min(10, g.length)} random of ${g.length}`);
      pick(g, 10, t).forEach((r) => out(fmt(r)));
    }

    head("highest-scoring NON-allocated products (possible false positives)");
    rows.filter((r) => !isAllocatedLabel(r.status, r.className) && (r.o.kind === "tier" || r.o.kind === "insufficient"))
      .sort((a, b) => score(b) - score(a)).slice(0, 25).forEach((r) => out(fmt(r)));

    head("allocated-labelled products and where they landed");
    rows.filter((r) => isAllocatedLabel(r.status, r.className)).sort((a, b) => score(b) - score(a)).slice(0, 25).forEach((r) => out(fmt(r)));

    head("famous / reference bottles");
    const famous = /VAN WINKLE|STAGG|BLANTON|WELLER|E H TAYLOR|EAGLE RARE 10 YR BOURBON 750|BUFFALO TRACE BOURBON 750|TITOS HANDMADE VODKA 750|LAPHROAIG CAIRDEAS|KING OF KENTUCKY|OLD FORESTER 1924|ELMER T LEE|RUSSELL.*13/i;
    [...rows, ...salesOnly].filter((r) => famous.test(r.name)).sort((a, b) => score(b) - score(a)).slice(0, 30).forEach((r) => out(fmt(r)));

    const wine = (r: Row) => /WINE|RED|WHITE|ROSE|CHAMPAGNE|SPARKLING|CABERNET|CHARDONNAY|PINOT|BURGUNDY|BORDEAUX|RIOJA|TUSCANY|MERLOT|ZINFANDEL|SYRAH|BLEND|VARIETAL/i.test(r.className ?? "");
    const spirit = (r: Row) => /VODKA|WHISK|BOURBON|RUM|TEQUILA|GIN|BRANDY|COGNAC|SCOTCH|LIQUEUR|MEZCAL/i.test(r.className ?? "");
    head("obscure wines (low volume) — random 12");
    pick(rows.filter((r) => wine(r) && r.sales.bottles12 > 0 && r.sales.bottles12 < 60 && r.status !== "S"), 12, "wine").forEach((r) => out(fmt(r)));
    head("everyday spirits (high volume) — random 8");
    pick(rows.filter((r) => spirit(r) && r.sales.bottles12 >= 5000), 8, "spirit").forEach((r) => out(fmt(r)));
    head("seasonal products — random 12 (attribute, not exclusion)");
    pick(rows.filter((r) => r.sales.seasonal), 12, "season").forEach((r) => out(fmt(r)));
    head("new listings / short records — random 10");
    pick(rows.filter((r) => r.o.kind === "insufficient" && r.o.reason.startsWith("new or short")), 10, "new").forEach((r) => out(fmt(r)));
    head("discontinued / winding down (DABS D/X/U) that still sold — random 8");
    pick(rows.filter((r) => r.o.kind === "winding_down" && r.sales.bottles12 > 0), 8, "disc").forEach((r) => out(fmt(r)));
    head("insufficient evidence where sales suggested Rare/Unicorn — random 12");
    pick(rows.filter((r) => r.o.kind === "insufficient" && (r.o.candidate === "rare" || r.o.candidate === "unicorn")), 12, "insuf").forEach((r) => out(fmt(r)));

    head("near the cutoffs (±25% of a volume threshold or ±0.08 of a months-share threshold)");
    const near: [string, (r: Row) => boolean][] = [
      [`volume ~${T.everydayVolume}`, (r) => near1(r.sales.bottles12, T.everydayVolume) && (r.sales.soldShare12 ?? 0) >= T.regularShare],
      [`volume ~${T.rareMaxVolume}`, (r) => near1(r.sales.bottles12, T.rareMaxVolume) && (r.sales.soldShare12 ?? 1) < T.sporadicShare],
      [`volume ~${T.unicornMaxVolume}`, (r) => near1(r.sales.bottles12, T.unicornMaxVolume) && (r.sales.soldShare12 ?? 1) < T.sporadicShare],
      [`months share ~${T.regularShare}`, (r) => Math.abs((r.sales.soldShare12 ?? -1) - T.regularShare) <= 0.08],
      [`months share ~${T.sporadicShare}`, (r) => Math.abs((r.sales.soldShare12 ?? -1) - T.sporadicShare) <= 0.08],
      [`on shelves ~${T.consistentlyStocked * 100}%`, (r) => !!r.stock && r.stock.observed_days >= T.minObservedDays && Math.abs(r.stock.in_stock_days / r.stock.observed_days - T.consistentlyStocked) <= 0.05],
    ];
    for (const [name, f] of near) {
      const g = tiered.filter(f);
      out(`-- ${name}: ${g.length} products; 6 random`);
      pick(g, 6, name).forEach((r) => out(fmt(r)));
    }

    head("questionable: high tier but on shelves now at many stores, or capped/downgraded by stock");
    tiered.filter((r) => TIER_ORDER.indexOf(r.o.tier) >= 3 && r.stock && r.stock.stores_now >= 5).slice(0, 10).forEach((r) => out("hi-tier+stocked: " + fmt(r)));
    tiered.filter((r) => /capped/.test(r.o.reason) && TIER_ORDER.indexOf(r.o.candidate) >= 3).slice(0, 10).forEach((r) => out("capped: " + fmt(r)));
    head("questionable: high tier with low confidence or a reused item code");
    tiered.filter((r) => TIER_ORDER.indexOf(r.o.tier) >= 3 && (r.o.confidence === "low" || (history.get(r.code)?.names.length ?? 0) > 1))
      .slice(0, 15).forEach((r) => out(fmt(r) + ` ⚑ names: ${history.get(r.code)?.names.join(" / ")}`));

    head("sales-only codes (in DABS sales, not in our catalog) — top by review score");
    salesOnly.sort((a, b) => score(b) - score(a)).slice(0, 15).forEach((r) => out(fmt(r)));
  } finally {
    await db`drop table if exists rarity_days, rarity_pd`.catch(() => {});
    db.release();
  }
  await sql.end();
}

/** Products on shelves every observed day of a month: are they in that month's sales report? */
async function absentVsZero(db: ReservedSql, out: (s?: string) => void, head: (s: string) => void) {
  head("absent vs zero: products on shelves every observed day of a month — in that month's report?");
  const months = await db<{ month: string; days: number }[]>`
    select to_char(date_trunc('month', d), 'YYYY-MM') as month, count(*)::int as days
    from rarity_days group by 1 order by 1`;
  const reported = new Set((await db<{ m: string }[]>`select to_char(period_month, 'YYYY-MM') as m from sales_reports`).map((r) => r.m));
  for (const { month, days } of months) {
    if (!reported.has(month)) { out(`${month}: ${days} observed days — no sales report yet`); continue; }
    if (days < 15) { out(`${month}: only ${days} observed days — skipped`); continue; }
    const period = `${month}-01`;
    const [r] = await db<{ n: number; absent: number; sample: string[] | null }[]>`
      with full_month as (
        select pd.csc from rarity_pd pd join products p using (csc)
        where date_trunc('month', pd.d) = ${period}::date and coalesce(p.status, '') <> 'S'
        group by pd.csc having count(*) = ${days} and bool_and(pd.in_stock)
      ), a as (
        select f.csc, p.name, p.current_price from full_month f join products p using (csc)
        where not exists (select 1 from monthly_sales m where m.item_code = f.csc and m.period_month = ${period}::date)
      )
      select (select count(*)::int from full_month) as n, (select count(*)::int from a) as absent,
             (select (array_agg(csc || ' ' || name || ' $' || coalesce(current_price::text, '?') order by current_price desc nulls last))[1:8] from a) as sample`;
    out(`${month}: ${days} observed days · ${r.n} on shelves every day · ${r.absent} not in the report (${pct(r.absent, r.n)})`);
    for (const s of r.sample ?? []) out(`    not in report: ${s}`);
  }
}

function fmt(r: Row): string {
  const o = r.o;
  const s = r.sales;
  const k = r.stock;
  const verdict =
    o.kind === "tier" ? `${TIER_LABELS[o.tier].toUpperCase()} (${o.confidence}${o.candidate !== o.tier ? `; sales said ${TIER_LABELS[o.candidate]}` : ""})`
    : o.kind === "insufficient" ? `INSUFFICIENT${o.candidate ? ` (sales said ${TIER_LABELS[o.candidate]})` : ""}`
    : o.kind.toUpperCase();
  const sales = `sales ${s.bottles12} btl/12mo · sold ${s.soldMonths12}/${s.recordMonths12} mo` +
    (s.notInReport12 ? ` (${s.notInReport12} not in report` + (s.explicitZero12 ? `, ${s.explicitZero12} zero)` : ")") : s.explicitZero12 ? ` (${s.explicitZero12} zero)` : "") +
    ` · top-2 ${s.top2Share12 != null ? Math.round(s.top2Share12 * 100) + "%" : "–"} · runs ${s.runsAll} · first ${s.firstRecord ?? "–"} last ${s.lastSold ?? "–"} · [${s.pattern16}]`;
  const stock = !k ? "stock: not in catalog"
    : `stock: ${k.in_stock_days}/${k.observed_days} obs days · sold out ${k.sellouts}× · stores ${k.stores_seen} seen/${k.stores_now} now${k.has_store_data ? "" : " (no store rows)"} · peak ${k.peak_shelf ?? "–"} · ${k.in_stock_now ? "on shelves now" : "not on shelves now"}`;
  const dabs = `DABS status ${r.status ?? "?"}${isAllocatedLabel(r.status, r.className) ? ", allocated label" : ""}`;
  const reason = "reason" in o ? o.reason : "";
  return `${verdict} | ${r.name} [${r.code}] ${r.className ?? "?"} · ${dabs}${s.seasonal ? ` · season: ${s.seasonal}` : ""}\n      ${sales}\n      ${stock}\n      why: ${reason}`;
}

function score(r: Row): number {
  return r.o.kind === "tier" || r.o.kind === "insufficient" ? r.o.score : -1;
}

function near1(v: number, t: number): boolean {
  return v >= t * 0.75 && v <= t * 1.25;
}

function h(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

function countBy<X>(arr: X[], key: (x: X) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of arr) m.set(key(a), (m.get(key(a)) ?? 0) + 1);
  return m;
}

function pct(a: number, b: number): string {
  return b ? `${((100 * a) / b).toFixed(1)}%` : "–";
}

