import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDrawings, drawingTitle, drawingYear, oneIn, type DrawingRow } from "../lib/drawings";

const NOW = Date.parse("2026-10-11T00:00:00Z");
const row = (drawing: string, item_code: string, bottles: number | null, entries: number | null, extra: Partial<DrawingRow> = {}): DrawingRow => ({
  drawing,
  item_code,
  product_name: `BOTTLE ${item_code} 750ml`,
  price: "154.99",
  bottles,
  entries,
  section: "past",
  first_seen: new Date("2026-09-24T00:00:00Z"),
  last_seen: new Date("2026-10-10T00:00:00Z"),
  listed: true,
  ...extra,
});

test("oneIn is entries per bottle, rounded; 1 when bottles cover entries; null without counts", () => {
  assert.equal(oneIn(6, 7209), 1202);
  assert.equal(oneIn(58, 7338), 127);
  assert.equal(oneIn(10, 8), 1);
  assert.equal(oneIn(0, 100), null);
  assert.equal(oneIn(null, 100), null);
  assert.equal(oneIn(5, null), null);
});

test("drawingYear reads the year in the name, else the first-seen year", () => {
  assert.equal(drawingYear("PAPPY VAN WINKLE & BUFFALO TRACE ANTIQUE COLLECTION 2026", new Date("2026-09-24")), 2026);
  assert.equal(drawingYear("Old Forester Birthday Bourbon 2024", new Date("2026-09-24")), 2024);
  assert.equal(drawingYear("Spring release", new Date("2025-03-01T12:00:00Z")), 2025);
});

test("each bottle is compared with the same item code in the latest earlier drawing", () => {
  const rows = [
    row("Pappy & Sazerac Antique Collection 2025", "017756", 7, 4684),
    row("PAPPY & BUFFALO TRACE ANTIQUE COLLECTION 2026", "017756", 6, 7209),
    row("PAPPY & BUFFALO TRACE ANTIQUE COLLECTION 2026", "020146", 58, 7338),
    row("Pappy & Sazerac Antique Collection 2025", "020146", 65, 4781),
    row("Pappy Antique 2024", "017756", 8, 3000),
    row("PAPPY & BUFFALO TRACE ANTIQUE COLLECTION 2026", "999999", 3, null),
  ];
  const [d26, d25, d24] = buildDrawings(rows, NOW);
  assert.deepEqual([d26.year, d25.year, d24.year], [2026, 2025, 2024]);
  // hardest first; no entry count last
  assert.deepEqual(d26.items.map((i) => i.code), ["017756", "020146", "999999"]);
  assert.equal(d26.items[0].previous?.year, 2025);
  assert.equal(d26.items[0].previous?.oneIn, 669);
  assert.equal(d25.items.find((i) => i.code === "017756")?.previous?.year, 2024);
  assert.equal(d24.items[0].previous, null);
  // entries summed over matched bottles only
  assert.deepEqual(d26.entriesChange, { now: 7209 + 7338, before: 4684 + 4781, year: 2025 });
  assert.equal(d26.bottles, 6 + 58 + 3);
});

test("an open drawing counts as open only while DABS still lists it", () => {
  const fresh = row("Fall drawing 2026", "1", 5, 500, { section: "current", last_seen: new Date(NOW - 86400_000) });
  const stale = row("Summer drawing 2026", "2", 5, 500, { section: "current", last_seen: new Date(NOW - 10 * 86400_000) });
  const out = buildDrawings([stale, fresh], NOW);
  assert.equal(out[0].name, "Fall drawing 2026");
  assert.equal(out[0].section, "current");
  assert.equal(out.find((d) => d.name === "Summer drawing 2026")?.section, "past");
});

test("drawingTitle drops the trailing size and spells out ages", () => {
  assert.equal(drawingTitle("EAGLE RARE BOURBON 17YR            750ml"), "Eagle Rare Bourbon 17 Year");
  assert.equal(drawingTitle("DRC ROMANEE-CONTI'22                750m"), "DRC Romanee-Conti'22");
  assert.equal(drawingTitle("GEORGE T STAGG BOURBON"), "George T Stagg Bourbon");
});
