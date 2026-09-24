import { createHash } from "node:crypto";
import type { ReservedSql, Sql } from "postgres";
import {
  buildStockMetrics,
  classifyRarity,
  computeSalesMetrics,
  isAllocatedLabel,
  loadAccessEvidence,
  loadSalesHistory,
  RARITY_METHOD,
  T,
  TIER_LABELS,
  TIER_ORDER,
  type RarityResult,
  type SalesMetrics,
  type StockMetrics,
} from "../lib/rarity";

/**
 * `report.ts rarity`: internal review of the experimental availability
 * labels/tiers (method v2). Every product line shows the facts (sales, shelf,
 * access), DABS's own labels, the shopper label, the tier and the reason.
 */

interface Row {
  code: string;
  name: string;
  className: string | null;
  status: string | null;
  sales: SalesMetrics;
  stock: StockMetrics | undefined;
  r: RarityResult;
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
    const { drawings, drops, dropNamesUnmatched } = await loadAccessEvidence(db);
    const [{ bootstrap }] = await db<{ bootstrap: Date }[]>`select min(first_seen) as bootstrap from products`;
    const newAfter = new Date(new Date(bootstrap).getTime() + 7 * 86400_000);
    // Report months we watched closely enough to say "sold while watched".
    const watched = (await db<{ m: string }[]>`
      select to_char(date_trunc('month', d), 'YYYY-MM') as m from rarity_days group by 1 having count(*) >= 15`)
      .map((r) => r.m).filter((m) => reportMonths.includes(m));

    const rows: Row[] = [];
    const classify = (code: string, name: string, status: string | null, className: string | null, sales: SalesMetrics, k: StockMetrics | undefined) =>
      classifyRarity({ name, status, className, sales, stock: k, drawings: drawings.get(code), drop: drops.get(code), holidayObserved: coverage.holidayObserved, observedMonths: watched });
    for (const k of stock) {
      const h = history.get(k.csc);
      const catalogFirst = new Date(k.first_seen) > newAfter ? new Date(k.first_seen).toISOString().slice(0, 7) : null;
      const sales = computeSalesMetrics(h, reportMonths, catalogFirst, k.name);
      const className = h?.className ?? k.category;
      rows.push({ code: k.csc, name: k.name, className, status: k.status, sales, stock: k, r: classify(k.csc, k.name, k.status, className, sales, k) });
    }
    const listed = new Set(stock.map((k) => k.csc));
    const notListed: Row[] = [];
    for (const h of history.values()) {
      if (listed.has(h.code)) continue;
      const sales = computeSalesMetrics(h, reportMonths, null, h.names[0] ?? "");
      if (sales.bottles12 === 0 && !drawings.has(h.code)) continue;
      const name = h.names.at(-1) ?? h.code;
      notListed.push({ code: h.code, name, className: h.className, status: h.status, sales, stock: undefined, r: classify(h.code, name, h.status, h.className, sales, undefined) });
    }
    const all = [...rows, ...notListed];

    head(`method ${RARITY_METHOD} — EXPERIMENTAL, internal only (built in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    out("evidence kept separate: recorded sales (context only) · shelf availability (days in stock + stores) · access method (verified from DABS pages)");
    out("labels → tiers:");
    out(`  DABS drawing → Unicorn if ≥${T.unicornEntriesPerBottle} entries per bottle in its latest DABS drawing, else Rare (verified by item code)`);
    out(`  Allocated release → Rare if its largest drop ≤${T.rareDropBottles} bottles statewide, else Scarce (verified by exact DABS name → one code); widely + consistently stocked wins → Everyday`);
    out(`  Hard to find: in stock <${T.hardToFind * 100}% of observed days AND (a sellout seen OR sales recorded in a month we watched ≥15 days) → Scarce`);
    out(`  Intermittently available: ${T.hardToFind * 100}–${T.consistently * 100}% → Uncommon`);
    out(`  In stock ≥${T.consistently * 100}% of days: typically ≥${T.wideStores} stores → Widely available (Everyday); fewer → In stock at a few stores (Uncommon); store coverage unknown → facts only`);
    out(`  shelf tiers need ≥${T.minObservedDays} observed days (in season) and ≥${T.minStoreDays} in-stock days with store data for the stores test`);
    out("  DABS status S → Special order; D/X/N/U → Being discontinued; DABS labels (status, allocated class, special-order class, packs, season) never change a tier");
    out("  holiday products are only judged on Nov–Dec observations; confidence: high = ≥45 observed days + store data; medium = ≥30 + store data; low otherwise; drawings/drops = high");

    head("coverage");
    out(`stock observations: ${coverage.observedDays} observed days of ${coverage.spanDays} (${coverage.first} → ${coverage.last}); Nov–Dec observed: ${coverage.holidayObserved}`);
    for (const g of coverage.gaps) out(`  excluded gap: ${g.days} day(s) with no successful catalog pass after ${g.after}`);
    out(`report months watched ≥15 days (for "sold while watched"): ${watched.join(", ") || "none"}`);
    out(`listed products ${stock.length}; with in-stock store data (≥${T.minStoreDays} days): ${stock.filter((k) => k.store_days >= T.minStoreDays).length}`);
    const [drawCov] = await db<{ n: number; d: number }[]>`select count(*)::int as n, count(distinct drawing)::int as d from rhdp_drawings`.catch(() => [{ n: 0, d: 0 }]);
    const [dropCov] = await db<{ dates: string[] | null; rows: number }[]>`select array_agg(distinct drop_date::text order by drop_date::text) as dates, count(*)::int as rows from allocated_drops`;
    out(`DABS drawings: ${drawCov.n} product entries in ${drawCov.d} drawings; codes in catalog: ${[...drawings.keys()].filter((c) => listed.has(c)).length}/${drawings.size}`);
    out(`DABS allocated drops: ${dropCov.rows} store rows on dates ${(dropCov.dates ?? []).join(", ")}; matched to one code: ${drops.size}; unmatched names: ${dropNamesUnmatched.length}`);
    for (const n of dropNamesUnmatched.slice(0, 15)) out(`  unmatched drop name: ${n}`);

    await absentVsZero(db, out, head);

    head("shopper label → tier (listed + not-listed products)");
    const labelKey = (x: Row) => `${x.r.label.padEnd(26)} ${x.r.tier ? TIER_LABELS[x.r.tier] : "—"}`;
    for (const [k, n] of [...countBy(all, labelKey)].sort((a, b) => b[1] - a[1])) out(`${String(n).padStart(6)}  ${k}`);

    head("tier × confidence × DABS labels (for comparison only)");
    out("tier        total  high   med   low | allocated-label  status-A  special-class  not-listed");
    for (const t of [...TIER_ORDER].reverse()) {
      const g = all.filter((x) => x.r.tier === t);
      const c = (v: string) => String(g.filter((x) => x.r.confidence === v).length).padStart(5);
      out(`${TIER_LABELS[t].padEnd(10)} ${String(g.length).padStart(6)} ${c("high")} ${c("medium")} ${c("low")} | ` +
        `${String(g.filter((x) => isAllocatedLabel(x.status, x.className)).length).padStart(15)} ${String(g.filter((x) => x.status === "A").length).padStart(9)} ` +
        `${String(g.filter((x) => /^SPECIAL ORDERS/i.test(x.className ?? "")).length).padStart(14)} ${String(g.filter((x) => x.r.notListed).length).padStart(11)}`);
    }
    head("why no shelf tier (reasons among products that got none)");
    for (const [k, n] of [...countBy(all.filter((x) => !x.r.tier && !["Special order", "Being discontinued"].includes(x.r.label)), (x) => x.r.reason.replace(/\d+/g, "N").slice(0, 90))].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      out(`${String(n).padStart(6)}  ${k}`);
    }

    const pick = (arr: Row[], n: number, seed: string) =>
      [...arr].sort((a, b) => hash(seed + a.code).localeCompare(hash(seed + b.code))).slice(0, n);

    head("every DABS drawing product");
    all.filter((x) => drawings.has(x.code)).sort((a, b) => TIER_ORDER.indexOf(b.r.tier ?? "everyday") - TIER_ORDER.indexOf(a.r.tier ?? "everyday")).forEach((x) => out(fmt(x)));
    head("allocated releases (verified drops) — all");
    all.filter((x) => x.r.label === "Allocated release" || (drops.has(x.code) && x.r.label !== "DABS drawing")).forEach((x) => out(fmt(x)));

    for (const label of ["Hard to find", "Intermittently available", "In stock at a few stores", "Widely available", "Not observed in season", "Facts only"] as const) {
      const g = all.filter((x) => x.r.label === label);
      head(`${label} — ${Math.min(10, g.length)} random of ${g.length}`);
      pick(g, 10, label).forEach((x) => out(fmt(x)));
    }

    head("reference bottles");
    const famous = /VAN WINKLE|STAGG|BLANTON|WELLER|E H TAYLOR|EAGLE RARE|BUFFALO TRACE BOURBON 750|TITOS HANDMADE VODKA 750|LAPHROAIG CAIRDEAS|OLD FORESTER 1924|CHARTREUSE|SKREWBALL EGGNOG|GHOSTFISH|CRYSTAL HEAD VODKA LUNAR|OPUS ONE|QUILCEDA/i;
    all.filter((x) => famous.test(x.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40).forEach((x) => out(fmt(x)));

    const wine = (x: Row) => /WINE|RED|WHITE|ROSE|CHAMPAGNE|SPARKLING|CABERNET|CHARDONNAY|PINOT|BURGUNDY|BORDEAUX|RIOJA|TUSCANY|MERLOT|ZINFANDEL|SYRAH|BLEND|VARIETAL/i.test(x.className ?? "");
    const spirit = (x: Row) => /VODKA|WHISK|BOURBON|RUM|TEQUILA|GIN|BRANDY|COGNAC|SCOTCH|LIQUEUR|MEZCAL/i.test(x.className ?? "");
    head("obscure wines (≤60 bottles/12mo) — random 10");
    pick(rows.filter((x) => wine(x) && x.sales.bottles12 > 0 && x.sales.bottles12 <= 60 && x.status !== "S"), 10, "wine").forEach((x) => out(fmt(x)));
    head("everyday spirits (≥5,000 bottles/12mo) — random 6");
    pick(rows.filter((x) => spirit(x) && x.sales.bottles12 >= 5000), 6, "spirit").forEach((x) => out(fmt(x)));
    head("seasonal products — random 10");
    pick(all.filter((x) => x.sales.seasonal && x.status !== "S"), 10, "season").forEach((x) => out(fmt(x)));
    head("new listings (first record within 6 months) — random 6");
    pick(rows.filter((x) => x.sales.recordMonths12 > 0 && x.sales.recordMonths12 < 6), 6, "new").forEach((x) => out(fmt(x)));
    head("being discontinued that still sold — random 5");
    pick(rows.filter((x) => x.r.label === "Being discontinued" && x.sales.bottles12 > 0), 5, "disc").forEach((x) => out(fmt(x)));
    head("not currently listed (sales/drawings only) — top 12 by recorded sales");
    [...notListed].sort((a, b) => b.sales.bottles12 - a.sales.bottles12).slice(0, 12).forEach((x) => out(fmt(x)));

    head("near the cutoffs");
    const near: [string, (x: Row) => boolean][] = [
      [`in stock ~${T.consistently * 100}% of days`, (x) => !!x.stock && x.stock.observed_days >= T.minObservedDays && Math.abs(x.stock.in_stock_days / x.stock.observed_days - T.consistently) <= 0.04],
      [`in stock ~${T.hardToFind * 100}% of days`, (x) => !!x.stock && x.stock.observed_days >= T.minObservedDays && Math.abs(x.stock.in_stock_days / x.stock.observed_days - T.hardToFind) <= 0.04],
      [`typically ~${T.wideStores} stores`, (x) => !!x.stock && x.stock.typical_stores != null && Math.abs(x.stock.typical_stores - T.wideStores) <= 2 && x.stock.store_days >= T.minStoreDays],
      [`largest drop ~${T.rareDropBottles} bottles`, (x) => { const d = drops.get(x.code); return !!d && Math.abs(d.largestDropBottles - T.rareDropBottles) <= 40; }],
      [`~${T.unicornEntriesPerBottle} entries per bottle`, (x) => { const d = drawings.get(x.code)?.[0]; return !!d?.bottles && d.entries != null && Math.abs(d.entries / d.bottles - T.unicornEntriesPerBottle) <= 40; }],
    ];
    for (const [name, f] of near) {
      const g = all.filter(f);
      out(`-- ${name}: ${g.length} products; up to 6 random`);
      pick(g, 6, name).forEach((x) => out(fmt(x)));
    }

    head("questionable");
    const q = (title: string, g: Row[], n = 8) => {
      out(`-- ${title}: ${g.length}`);
      g.slice(0, n).forEach((x) => out(fmt(x)));
    };
    q("Hard to find but never seen in stock (sales only — gone between checks, or not a shelf product?)", rows.filter((x) => x.r.label === "Hard to find" && (x.stock?.in_stock_days ?? 0) === 0).sort((a, b) => b.sales.bottles12 - a.sales.bottles12));
    q("Hard to find with high recorded sales (≥1,000 bottles/12mo)", rows.filter((x) => x.r.label === "Hard to find" && x.sales.bottles12 >= 1000).sort((a, b) => b.sales.bottles12 - a.sales.bottles12));
    q("Everyday/Uncommon but carrying DABS's allocated label", all.filter((x) => (x.r.tier === "everyday" || x.r.tier === "uncommon") && isAllocatedLabel(x.status, x.className)));
    q("'In stock at a few stores' but ≥10 stores carry it right now", rows.filter((x) => x.r.label === "In stock at a few stores" && (x.stock?.stores_now ?? 0) >= 10));
    q("Allocated release also in stock most observed days (≥50%)", rows.filter((x) => x.r.label === "Allocated release" && x.stock && x.stock.observed_days >= T.minObservedDays && x.stock.in_stock_days / x.stock.observed_days >= 0.5));
    q("reused item codes among Scarce and above", all.filter((x) => TIER_ORDER.indexOf(x.r.tier ?? "everyday") >= 2 && (history.get(x.code)?.names.length ?? 0) > 1));
  } finally {
    await db`drop table if exists rarity_days, rarity_pd, rarity_store_days`.catch(() => {});
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
             (select (array_agg(csc || ' ' || name || ' $' || coalesce(current_price::text, '?') order by current_price desc nulls last))[1:5] from a) as sample`;
    out(`${month}: ${days} observed days · ${r.n} on shelves every day · ${r.absent} not in the report (${pct(r.absent, r.n)})`);
    for (const s of r.sample ?? []) out(`    not in report: ${s}`);
  }
}

function fmt(x: Row): string {
  const r = x.r;
  const tier = r.tier ? `${TIER_LABELS[r.tier].toUpperCase()} (${r.confidence})` : "no tier";
  const s = x.sales;
  return `${r.label} · ${tier} | ${x.name} [${x.code}] ${x.className ?? "?"}${r.notListed ? " · NOT CURRENTLY LISTED" : ""}\n` +
    `      access: ${r.access} · DABS labels: ${r.dabsLabels.join(", ") || "—"}\n` +
    r.facts.map((f) => `      ${f}\n`).join("") +
    `      sales pattern [${s.pattern16}]\n` +
    `      why: ${r.reason}`;
}

function hash(s: string): string {
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
