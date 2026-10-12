import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BAR_GROUPS, BAR_SOURCES, barSources } from "../lib/bars";

// /bars rules follow the Utah 101 sourcing rule: every claim cites a source.
test("every house rule cites a known source", () => {
  for (const g of BAR_GROUPS) {
    assert.ok(g.rules.length > 0, `${g.key} has no rules`);
    for (const r of g.rules) {
      assert.ok(r.s.length > 0, `${g.key}: uncited "${r.t}"`);
      for (const id of r.s) assert.ok(BAR_SOURCES[id], `${g.key}: unknown source ${id}`);
    }
  }
  assert.deepEqual(new Set(barSources().map((s) => s.id)), new Set(Object.keys(BAR_SOURCES)), "every source is cited");
});

test("every group's license types exist in DABS's list, spelled exactly", () => {
  const csv = readFileSync(join(__dirname, "../data/licensees/dabs-licensees-2026-10-12.csv"), "utf8");
  for (const g of BAR_GROUPS) {
    for (const t of g.types) assert.ok(csv.includes(`,${t},`) || csv.includes(`,"${t}",`), `type not in snapshot: ${t}`);
  }
});
