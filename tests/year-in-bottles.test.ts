import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { addMonths, buildYear, kindOf, trailingWindow, YEAR_RULES, type SalesRow } from "../lib/year-in-bottles";

const MONTHS = Array.from({ length: 12 }, (_, i) => addMonths("2025-10", i)); // 2025-10 … 2026-09

const row = (month: string, name: string, className: string, bottles: number, dollars: number, extra: Partial<SalesRow> = {}): SalesRow => ({
  month,
  itemCode: extra.itemCode ?? `I${name}`,
  itemName: name,
  className,
  sizeMl: extra.sizeMl ?? 750,
  bottles,
  dollars,
  ...extra,
});

/** Every month: vodka 100 @ $20, red wine 50 @ $15 (Dec: 100), one can 1000 @ $2. */
function baseYear(): SalesRow[] {
  return MONTHS.flatMap((m) => [
    row(m, "TITOS HANDMADE VODKA 750ml", "VODKA - DOMESTIC", 100, 2000, { itemCode: "T750" }),
    row(m, "TITOS HANDMADE VODKA 1750ml", "VODKA - DOMESTIC", 10, 400, { itemCode: "T1750", sizeMl: 1750 }),
    row(m, "HOUSE RED 750ml", "RED VARIETAL - CABERNET", m === "2025-12" ? 100 : 50, m === "2025-12" ? 1500 : 750, { itemCode: "R" }),
    row(m, "BIG CAN 355ml", "ALE - PALE", 1000, 2000, { itemCode: "C", sizeMl: 355 }),
  ]);
}

test("kinds follow DABS class names", () => {
  assert.equal(kindOf("WHISKEY - BOURBON & TENNESSEE"), "spirits");
  assert.equal(kindOf("GIFT SETS - LIQUEURS"), "spirits");
  assert.equal(kindOf("ALLOCATED SPIRIT"), "spirits");
  assert.equal(kindOf("ALE - WHITE & BELGIAN STYLE"), "beer");
  assert.equal(kindOf("CIDER - FLAVORED"), "beer");
  assert.equal(kindOf("FLAVORED MALT BEVERAGES"), "beer");
  assert.equal(kindOf("ALLOCATED BEER"), "beer");
  assert.equal(kindOf("PREMIXED - MARGARITA"), "premixed");
  assert.equal(kindOf("WHITE VARIETAL - CHARDONNAY"), "wine");
  assert.equal(kindOf("SPARKLING WINE - PROSECCO"), "wine");
  assert.equal(kindOf("SAKE - IMPORTED"), "wine");
  assert.equal(kindOf("GIFT SETS - WINES"), "wine");
  assert.equal(kindOf("SUPPLIES"), "other");
  assert.equal(kindOf(null), "other");
});

test("the window is the latest 12 consecutive months; a gap is an error", () => {
  assert.deepEqual(trailingWindow(["2025-05", ...MONTHS]), MONTHS);
  assert.throws(() => trailingWindow(MONTHS.slice(1)), /need 12 months/);
  assert.throws(() => trailingWindow(["2025-08", ...MONTHS.filter((m) => m !== "2026-03")]), /gap/);
  assert.equal(addMonths("2026-01", -12), "2025-01");
  assert.equal(addMonths("2025-12", 1), "2026-01");
});

test("totals, mix and per-day figures add up", () => {
  const y = buildYear(baseYear());
  assert.equal(y.window.from, "2025-10");
  assert.equal(y.window.through, "2026-09");
  assert.equal(y.window.days, 365);
  assert.equal(y.totals.units, 12 * (100 + 10 + 50 + 1000) + 50);
  assert.equal(y.totals.dollars, 12 * (2000 + 400 + 750 + 2000) + 750);
  assert.equal(y.totals.unitsPerDay, Math.round(y.totals.units / 365));
  const shareSum = y.mix.reduce((s, m) => s + (m.dollarShare ?? 0), 0);
  assert.ok(Math.abs(shareSum - 1) < 0.001);
  assert.equal(y.monthly.length, 12);
  assert.equal(y.monthly.reduce((s, m) => s + m.dollars, 0), y.totals.dollars);
});

test("a bottle's sizes add up as one family; top items need every month", () => {
  const rows = baseYear();
  // A launch: huge, but only two months. It mustn't top the units list.
  rows.push(row("2026-08", "NEW SELTZER 355ml", "PREMIXED - MISC", 50_000, 100_000, { itemCode: "N", sizeMl: 355 }));
  rows.push(row("2026-09", "NEW SELTZER 355ml", "PREMIXED - MISC", 50_000, 100_000, { itemCode: "N", sizeMl: 355 }));
  const y = buildYear(rows);
  const titos = y.top.familiesByDollars.find((f) => f.title === "Titos Handmade Vodka");
  assert.ok(titos);
  assert.equal(titos.dollars, 12 * 2400);
  assert.deepEqual(titos.sizesMl, [750, 1750]);
  assert.deepEqual(titos.itemCodes, ["T1750", "T750"]);
  assert.equal(y.top.itemsByUnits[0].itemCode, "C");
  assert.ok(!y.top.itemsByUnits.some((i) => i.itemCode === "N"));
});

test("peak month compares with the median month", () => {
  const y = buildYear(baseYear());
  assert.equal(y.peakMonth.month, "2025-12");
  assert.equal(y.peakMonth.typicalMonthDollars, 5150);
  assert.equal(y.peakMonth.vsTypical, Math.round((5900 / 5150) * 10000) / 10000);
  assert.equal(y.peakMonth.surges[0].slug, "red-wine");
  assert.equal(y.peakMonth.surges[0].vsTypical, 2);
});

test("year over year uses only months reported in both years, and needs enough of them", () => {
  const rows = baseYear();
  const prior = (m: string, bottles: number, dollars: number) =>
    row(m, "TITOS HANDMADE VODKA 750ml", "VODKA - DOMESTIC", bottles, dollars, { itemCode: "T750" });
  // Two prior months only: not enough.
  const two = [...rows, prior("2025-08", 1, 1), prior("2025-09", 1, 1)];
  assert.equal(buildYear(two, { window: MONTHS }).yoy, null);

  // Prior Jul–Sep 2025 exist; the window's Jul–Sep 2026 are compared with them, nothing else.
  const three = [...rows, prior("2025-07", 80, 1_600_000), prior("2025-08", 80, 1_600_000), prior("2025-09", 80, 1_600_000)];
  const y = buildYear(three, { window: MONTHS });
  assert.ok(y.yoy);
  assert.deepEqual(y.yoy.months, ["2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(y.yoy.priorMonths, ["2025-07", "2025-08", "2025-09"]);
  assert.equal(y.yoy.total.prev.dollars, 4_800_000);
  assert.equal(y.yoy.total.cur.dollars, 3 * 5150);
  const vodka = y.yoy.groups.find((g) => g.slug === "vodka");
  assert.ok(vodka);
  assert.equal(vodka.cur.dollars, 3 * 2400);
  // Red wine had no prior sales: it can't claim growth.
  assert.ok(!y.yoy.groups.some((g) => g.slug === "red-wine"));
  assert.ok(YEAR_RULES.MIN_YOY_MONTHS === 3);
});

test("buying channels stay in totals but out of style facts", () => {
  const rows = baseYear();
  for (const m of MONTHS) rows.push(row(m, "SOME SPECIAL ORDER 750ml", "SPECIAL ORDERS - WINE", m === "2026-02" ? 500 : 5, m === "2026-02" ? 9000 : 90));
  const y = buildYear(rows);
  assert.ok(y.groups.some((g) => g.slug === "special-orders"));
  assert.ok(!y.seasons.groups.some((g) => g.slug === "special-orders"));
  assert.ok(!y.seasons.classes.some((c) => c.className.startsWith("SPECIAL ORDERS")));
  assert.ok(!y.top.perGroup.some((g) => g.slug === "special-orders"));
  assert.ok(!y.peakMonth.surges.some((g) => g.slug === "special-orders"));
});

test("seasons: each category's share of each month", () => {
  const y = buildYear(baseYear());
  const red = y.seasons.groups.find((g) => g.slug === "red-wine");
  assert.ok(red);
  assert.equal(red.peak.month, "2025-12");
  assert.equal(red.peak.share, Math.round((1500 / 5900) * 10000) / 10000);
  assert.equal(red.shares.length, 12);
});

test("allocated counts allocated lines only; Utah brands come from the maker match", () => {
  const rows = baseYear();
  rows.push(row("2025-11", "BLANTON BOURBON SNGL BRRL 750ml", "ALLOCATED SPIRIT", 40, 4000, { itemCode: "B" }));
  rows.push(row("2026-03", "BLANTON BOURBON SNGL BRRL 750ml", "WHISKEY - BOURBON SINGLE BARREL, BATCH", 60, 6000, { itemCode: "B" }));
  const y = buildYear(rows, { makerOf: (r) => (r.itemCode === "C" ? { slug: "big-can", name: "Big Can Brewing" } : null) });
  assert.equal(y.allocated.units, 40);
  assert.equal(y.allocated.items, 1);
  assert.equal(y.allocated.topByUnits[0].itemCode, "B");
  assert.ok(y.homegrown);
  assert.equal(y.homegrown.units, 12_000);
  assert.equal(y.homegrown.makers[0].slug, "big-can");
  const beer = y.homegrown.byKind.find((k) => k.kind === "beer");
  assert.equal(beer?.dollarShare, 1);
  assert.equal(buildYear(rows).homegrown, null);
});

test("the splurge is the highest price per bottle on any line", () => {
  const rows = baseYear();
  rows.push(row("2026-09", "DRC ROMANEE-CONTI'23 750ml", "ALLOCATED WINE", 2, 22574.06, { itemCode: "D" }));
  rows.push(row("2026-09", "RETURNED THING 750ml", "VODKA - DOMESTIC", 0, 500, { itemCode: "Z" }));
  const y = buildYear(rows);
  assert.equal(y.splurge[0].itemCode, "D");
  assert.equal(y.splurge[0].unitPrice, 11287.03);
  assert.ok(!y.splurge.some((s) => s.itemCode === "Z"));
});

// The committed snapshot: internally consistent and only the facts we allow.
const SNAPSHOT = join(process.cwd(), "data", "year-in-bottles-2026.json");
test("committed snapshot is a consistent 12-month year", { skip: !existsSync(SNAPSHOT) }, () => {
  const s = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  assert.equal(s.window.months.length, 12);
  assert.deepEqual(trailingWindow(s.window.months), s.window.months);
  assert.equal(s.sources.length, 12);
  assert.deepEqual(s.sources.map((x: { month: string }) => x.month), s.window.months);
  for (const src of s.sources) assert.match(src.url, /^https:\/\/abs\.utah\.gov\//);
  const monthly = s.monthly.reduce((t: number, m: { dollars: number }) => t + m.dollars, 0);
  assert.ok(Math.abs(monthly - s.totals.dollars) < 1);
  assert.equal(s.monthly.reduce((t: number, m: { units: number }) => t + m.units, 0), s.totals.units);
  assert.ok(Math.abs(s.mix.reduce((t: number, m: { dollarShare: number }) => t + m.dollarShare, 0) - 1) < 0.001);
  assert.ok(s.yoy === null || s.yoy.months.length >= YEAR_RULES.MIN_YOY_MONTHS);
  // State and bottle facts only: nothing per person.
  assert.doesNotMatch(JSON.stringify(s), /per ?(capita|person|adult|resident)/i);
});
