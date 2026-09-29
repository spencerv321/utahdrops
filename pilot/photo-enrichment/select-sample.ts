/**
 * Photo/enrichment pilot: pick the 100-product sample reproducibly.
 *
 *   npx tsx pilot/photo-enrichment/select-sample.ts > pilot/photo-enrichment/data/sample.json
 *
 * Needs a local DB with the DABS catalog (`scrape.ts catalog`) and monthly
 * sales (`scrape.ts sales`), plus the production demand counts saved from
 * `report.yml → photosample` in data/demand-2026-09-29.json.
 *
 * No hand picking: every slot is filled by a rule, and ties (and the pick
 * inside each difficult-case group) are broken by md5(SEED || code), so the
 * same inputs give the same 100 codes. The exact codes are saved in
 * data/sample.json; re-running later will drift as the catalog changes, so
 * the saved list is the experiment, this script is the method.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groupOf } from "../../lib/categories";
import { productKind } from "./identity";
config({ path: ".env.local", quiet: true });

const SEED = "utahdrops-photo-pilot-2026-09-29";
const SALES_FROM = "2026-06-01"; // last three imported months (Jun–Aug 2026)

// Popular: 25 by Utah Drops demand, 35 by statewide sales dollars, per kind.
const DEMAND_SLOTS = 25;
const SALES_SLOTS: Record<string, number> = { spirits: 15, wine: 12, beer: 5, other: 3 };
// Difficult: 5 per detector.
const PER_GROUP = 5;

interface Row {
  csc: string; name: string; category: string | null; size_ml: number | null;
  in_stock: boolean; status: string | null; dollars: number; bottles: number; h: string;
  sale_names: string[] | null;
}

async function main() {
  const { sql } = await import("../../lib/db");
  const demand = JSON.parse(readFileSync(join(__dirname, "data/demand-2026-09-29.json"), "utf8")) as {
    rows: { csc: string; viewers: number; watchers: number; search_clicks: number }[];
  };
  // Live = something a visitor can see as current: in stock, or sold in the window.
  const rows = await sql<Row[]>`
    with s as (
      select item_code, sum(dollars)::float8 as dollars, sum(bottles)::int as bottles,
             array_agg(distinct regexp_replace(item_name, '\\s*\\d+(\\.\\d+)?\\s*(ml|l|m|oz)?$', '', 'i')) as sale_names
      from monthly_sales where period_month >= ${SALES_FROM} group by 1)
    select p.csc, p.name, p.category, p.size_ml, p.in_stock, p.status,
           coalesce(s.dollars, 0) as dollars, coalesce(s.bottles, 0) as bottles,
           md5(${SEED} || p.csc) as h, s.sale_names
    from products p left join s on s.item_code = p.csc
    where p.in_stock or s.item_code is not null`;
  const byCsc = new Map(rows.map((r) => [r.csc, r]));
  const kindOf = (r: Row) => productKind(r.category, r.name);
  const picked = new Map<string, { csc: string; group: string; reason: string }>();
  const take = (r: Row, group: string, reason: string) => {
    if (!picked.has(r.csc)) picked.set(r.csc, { csc: r.csc, group, reason });
  };

  // 1. Demand: watchers ×5 + page viewers + search clicks; ties by hash.
  const dem = demand.rows
    .map((d) => ({ d, r: byCsc.get(d.csc), score: d.watchers * 5 + d.viewers + d.search_clicks }))
    .filter((x) => x.r)
    .sort((a, b) => b.score - a.score || a.r!.h.localeCompare(b.r!.h));
  for (const { d, r } of dem.slice(0, DEMAND_SLOTS))
    take(r!, "popular:demand", `watchers ${d.watchers}, viewers ${d.viewers}, search clicks ${d.search_clicks}`);

  // 2. Statewide sales dollars, Jun–Aug 2026, per kind.
  for (const [kind, n] of Object.entries(SALES_SLOTS)) {
    const top = rows.filter((r) => kindOf(r) === kind && r.dollars > 0 && !picked.has(r.csc))
      .sort((a, b) => b.dollars - a.dollars).slice(0, n);
    for (const r of top) take(r, `popular:sales:${kind}`, `$${Math.round(r.dollars).toLocaleString()} / ${r.bottles.toLocaleString()} bottles Jun–Aug 2026`);
  }

  // 3. Difficult cases: rule detectors, first PER_GROUP by hash.
  const base = (n: string) => n.replace(/\s*\d+(\.\d+)?\s*(ml|l|m)?$/i, "").replace(/\s+/g, " ").trim();
  const sizesByBase = new Map<string, Set<number>>();
  for (const r of rows) if (r.in_stock && r.size_ml) {
    const k = base(r.name); (sizesByBase.get(k) ?? sizesByBase.set(k, new Set()).get(k)!).add(r.size_ml);
  }
  const brand2 = (n: string) => base(n).split(" ").slice(0, 2).join(" ");
  const namesByBrand = new Map<string, Set<string>>();
  for (const r of rows) if (r.in_stock && kindOf(r) === "spirits") {
    const k = brand2(r.name); (namesByBrand.get(k) ?? namesByBrand.set(k, new Set()).get(k)!).add(base(r.name));
  }
  const cat = (r: Row) => r.category ?? "";
  const detectors: [string, string, (r: Row) => boolean][] = [
    ["difficult:multi-size", "same name in 3+ sizes in stock", (r) => r.in_stock && (sizesByBase.get(base(r.name))?.size ?? 0) >= 3],
    ["difficult:similar-expression", "brand has 5+ different expressions in stock", (r) => r.in_stock && kindOf(r) === "spirits" && (namesByBrand.get(brand2(r.name))?.size ?? 0) >= 5],
    ["difficult:proof", "proof / barrel strength in the name", (r) => /\b\d{2,3}(\.\d)?\s?(PF|PROOF)\b|BARREL PROOF|BRL PRF|CASK STR|BOTTLED IN BOND|\bBIB\b|FULL PROOF/i.test(r.name)],
    ["difficult:gift-set", "gift set / value-add pack", (r) => /^GIFT SETS/.test(cat(r)) || /\bW\/|\bVAP\b|GIFT|GLASSES/i.test(r.name)],
    ["difficult:beer-package", "beer name says can/bottle or the beer comes in 2+ sizes", (r) => r.in_stock && kindOf(r) === "beer" && (/\bCANS?\b|\bBTL|BOTTLE/i.test(r.name) || (sizesByBase.get(base(r.name))?.size ?? 0) >= 2)],
    ["difficult:wine-vintage", "wine with a vintage in the name or several vintages on one code", (r) => kindOf(r) === "wine" && (/'\s?\d{2}\b|\b(19|20)\d{2}\b/.test(r.name) || (r.sale_names?.length ?? 0) > 1)],
    ["difficult:limited", "allocated / offer / limited or numbered release", (r) => /^(ALLOCATED|SPIRIT OFFER|WINE OFFER|BEER OFFER)/.test(cat(r)) || /\bLTD\b|LIMITED|EDITION|RELEASE|ANNIVERSARY|\bBATCH\s?\d/i.test(r.name)],
    ["difficult:reused-code", "one DABS code sold under 2+ different names", (r) => (r.sale_names?.length ?? 0) > 1],
  ];
  for (const [group, reason, test] of detectors) {
    const cands = rows.filter((r) => !picked.has(r.csc) && test(r)).sort((a, b) => a.h.localeCompare(b.h));
    const seenBase = new Set<string>();
    let n = 0;
    for (const r of cands) {
      if (n >= PER_GROUP) break;
      if (seenBase.has(brand2(r.name))) continue; // one per brand inside a group
      seenBase.add(brand2(r.name));
      const extra = group === "difficult:reused-code" || group === "difficult:wine-vintage" ? ` (${(r.sale_names ?? []).join(" | ")})` : "";
      take(r, group, reason + extra);
      n++;
    }
  }

  const out = [...picked.values()].map((p) => {
    const r = byCsc.get(p.csc)!;
    return { ...p, name: r.name, category: r.category, kind: kindOf(r), group_label: groupOf(r.category)?.label ?? null,
      size_ml: r.size_ml, in_stock: r.in_stock, sales_dollars_jun_aug: Math.round(r.dollars) };
  });
  console.log(JSON.stringify({ seed: SEED, sales_from: SALES_FROM, selected_at: new Date().toISOString(), count: out.length, products: out }, null, 1));
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
