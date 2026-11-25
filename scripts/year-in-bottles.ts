/**
 * Utah's Year in Bottles: builds the frozen snapshot the page reads
 * (data/year-in-bottles-<edition>.json) from DABS monthly sales
 * (`monthly_sales`, filled by the `sales` job). Read-only on the database.
 *
 * Local: npx tsx scripts/year-in-bottles.ts [--through YYYY-MM] [--edition 2026] [--write]
 *   Without --write it prints the summary only. Review the summary and the
 *   JSON diff by eye before committing: shared numbers never change after launch.
 * Production check: report.yml → yearinbottles (summary only, no file).
 *
 * The snapshot can be rebuilt from a local database: start Postgres, run
 * scripts/migrate.ts, then `scrape.ts xlsx` (vendor codes for Utah brands)
 * and `scrape.ts sales` (the DABS reports), then this script.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Sql = typeof import("../lib/db").sql;

export async function loadYear(sql: Sql, through?: string) {
  const { buildYear, trailingWindow, YEAR_RULES } = await import("../lib/year-in-bottles");
  const { makerForProduct } = await import("../lib/makers");

  const rows = (await sql`
    select to_char(s.period_month, 'YYYY-MM') as month, s.item_code, s.item_name, s.class_name,
           s.size_ml, s.bottles, s.dollars::float8 as dollars, p.vendor_code
    from monthly_sales s
    left join products p on p.csc = s.item_code
    order by s.period_month, s.line`) as unknown as {
    month: string;
    item_code: string;
    item_name: string | null;
    class_name: string | null;
    size_ml: number | null;
    bottles: number | null;
    dollars: number | null;
    vendor_code: string | null;
  }[];
  const reports = (await sql`
    select to_char(period_month, 'YYYY-MM') as month, fiscal_label, source_url,
           sum_dollars::float8 as sum_dollars, sum_bottles, imported_at
    from sales_reports order by period_month`) as unknown as {
    month: string;
    fiscal_label: string;
    source_url: string;
    sum_dollars: number;
    sum_bottles: number;
    imported_at: Date;
  }[];

  const months = reports.map((r) => r.month).filter((m) => !through || m <= through);
  const window = trailingWindow(months, YEAR_RULES.WINDOW_MONTHS);
  const vendor = new Map(rows.map((r) => [r.item_code, r.vendor_code]));
  const snapshot = buildYear(
    rows.map((r) => ({
      month: r.month,
      itemCode: r.item_code,
      itemName: r.item_name,
      className: r.class_name,
      sizeMl: r.size_ml,
      bottles: r.bottles,
      dollars: r.dollars,
    })),
    {
      window,
      makerOf: (r) => {
        const m = makerForProduct({ csc: r.itemCode, name: r.itemName ?? "", vendor_code: vendor.get(r.itemCode) });
        return m ? { slug: m.slug, name: m.name } : null;
      },
    }
  );

  // Our line sums must match what the importer recorded for each report.
  const inWindow = reports.filter((r) => window.includes(r.month));
  const reportDollars = inWindow.reduce((s, r) => s + r.sum_dollars, 0);
  const reportUnits = inWindow.reduce((s, r) => s + r.sum_bottles, 0);
  const problems: string[] = [];
  if (Math.abs(reportDollars - snapshot.totals.dollars) > 1) {
    problems.push(`dollars: snapshot ${snapshot.totals.dollars} vs reports ${reportDollars}`);
  }
  if (reportUnits !== snapshot.totals.units) problems.push(`units: snapshot ${snapshot.totals.units} vs reports ${reportUnits}`);

  return {
    snapshot,
    sources: inWindow.map((r) => ({ month: r.month, fiscalLabel: r.fiscal_label, url: r.source_url })),
    problems,
  };
}

const pct = (n: number | null | undefined) => (n == null ? "n/a" : `${(n * 100).toFixed(1)}%`);
const signed = (n: number | null | undefined) => (n == null ? "n/a" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`);
const usd = (n: number) => `$${(n / 1e6).toFixed(2)}M`;
const int = (n: number) => n.toLocaleString("en-US");

type Snapshot = Awaited<ReturnType<typeof loadYear>>["snapshot"];

export function summarize(s: Snapshot): string {
  const lines: string[] = [];
  const p = (t = "") => lines.push(t);
  p(`Window ${s.window.from} → ${s.window.through} (${s.window.days} days)`);
  p(`Totals ${usd(s.totals.dollars)}, ${int(s.totals.units)} units, ${int(s.totals.items)} items, ${int(s.totals.unitsPerDay)} units/day`);
  p(`\nMix: ${s.mix.map((m) => `${m.label} ${pct(m.dollarShare)} of $, ${pct(m.unitShare)} of units`).join(" | ")}`);
  p(`\nGroups by $:`);
  for (const g of s.groups.slice(0, 12)) p(`  ${g.label.padEnd(28)} ${usd(g.dollars).padStart(9)} ${pct(g.dollarShare).padStart(6)}`);
  p(`\nTop families by $ (sizes summed):`);
  for (const f of s.top.familiesByDollars) p(`  ${f.title.padEnd(40)} ${usd(f.dollars).padStart(9)}  ${f.sizesMl.join("/")}ml`);
  p(`\nTop items by units (sold every month):`);
  for (const i of s.top.itemsByUnits) p(`  ${i.name.padEnd(42)} ${int(i.units).padStart(9)}`);
  p(`\nPeak month ${s.peakMonth.month}: ${usd(s.peakMonth.dollars)}, ${s.peakMonth.vsTypical}× a typical month (${usd(s.peakMonth.typicalMonthDollars)})`);
  for (const x of s.peakMonth.surges.slice(0, 3)) p(`  ${x.label}: ${int(x.peakUnits)} units, ${x.vsTypical}× typical`);
  p(`\nSeasons (groups, biggest swing first):`);
  for (const g of s.seasons.groups.slice(0, 6)) {
    p(`  ${g.label.padEnd(28)} peak ${g.peak.month} ${pct(g.peak.share)}, low ${g.low.month} ${pct(g.low.share)} (${g.peakVsLow}×)`);
  }
  p(`Seasons (DABS classes):`);
  for (const c of s.seasons.classes.slice(0, 8)) {
    p(`  ${c.className.padEnd(40)} peak ${c.peak.month} ${pct(c.peak.share)}, low ${c.low.month} ${pct(c.low.share)} (${c.peakVsLow}×)`);
  }
  if (s.yoy) {
    p(`\nYear over year, ${s.yoy.months[0]}…${s.yoy.months.at(-1)} vs a year earlier (${s.yoy.months.length} months):`);
    p(`  Total ${usd(s.yoy.total.prev.dollars)} → ${usd(s.yoy.total.cur.dollars)} ${signed(s.yoy.total.dollarChange)}`);
    p(`  Kinds: ${s.yoy.kinds.map((k) => `${k.label} ${signed(k.dollarChange)}`).join(" | ")}`);
    p(`  Groups: ${s.yoy.groups.map((g) => `${g.label} ${signed(g.dollarChange)}`).join(" | ")}`);
    p(`  Classes, top/bottom: ${[...s.yoy.classes.slice(0, 4), ...s.yoy.classes.slice(-3)].map((c) => `${c.className} ${signed(c.dollarChange)}`).join(" | ")}`);
  } else p(`\nYear over year: not enough matching months`);
  if (s.homegrown) {
    p(`\nUtah brands: ${pct(s.homegrown.dollarShare)} of $, ${pct(s.homegrown.unitShare)} of units`);
    p(`  By kind: ${s.homegrown.byKind.map((k) => `${k.label} ${pct(k.dollarShare)} of $`).join(" | ")}`);
    p(`  Makers: ${s.homegrown.makers.slice(0, 6).map((m) => `${m.name} ${usd(m.dollars)}`).join(" | ")}`);
  }
  p(`\nAllocated: ${int(s.allocated.units)} units across ${s.allocated.items} items; top ${s.allocated.topByUnits[0]?.name} (${int(s.allocated.topByUnits[0]?.units ?? 0)})`);
  p(`Splurge: ${s.splurge.map((x) => `${x.title} ${x.month} ${x.units}× $${int(x.unitPrice)}`).slice(0, 3).join(" | ")}`);
  return lines.join("\n");
}

export async function yearInBottlesReport(sql: Sql) {
  const { snapshot, problems } = await loadYear(sql);
  console.log(summarize(snapshot));
  if (problems.length) console.log(`\nPROBLEMS\n${problems.join("\n")}`);
  await sql.end();
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const { sql } = await import("../lib/db");
  const { snapshot, sources, problems } = await loadYear(sql, arg("--through"));
  await sql.end();
  console.log(summarize(snapshot));
  if (problems.length) {
    console.error(`\nPROBLEMS\n${problems.join("\n")}`);
    process.exit(1);
  }
  if (args.includes("--write")) {
    const edition = arg("--edition") ?? snapshot.window.through.slice(0, 4);
    const file = join(process.cwd(), "data", `year-in-bottles-${edition}.json`);
    const { YEAR_RULES } = await import("../lib/year-in-bottles");
    const body = {
      edition,
      note: "Frozen snapshot from DABS monthly Sales Analysis reports. Built by scripts/year-in-bottles.ts; reviewed by eye. Units are DABS bottle counts (cans included).",
      builtAt: new Date().toISOString().slice(0, 10),
      rules: YEAR_RULES,
      sources,
      ...snapshot,
    };
    writeFileSync(file, JSON.stringify(body, null, 1) + "\n");
    console.log(`\nwrote ${file}`);
  }
  process.exit(0);
}

if (process.argv[1]?.endsWith("year-in-bottles.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
