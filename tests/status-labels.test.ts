import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_INFO, STATUS_LABELS } from "../lib/config";
import { listingNote } from "../lib/format";

// Every code in DABS's product locator status list.
const CODES = ["1", "A", "D", "L", "N", "P", "S", "T", "U", "X"];

test("every DABS status code has a label, explanation and note rule", () => {
  for (const c of CODES) {
    assert.ok(STATUS_INFO[c], `missing ${c}`);
    assert.ok(STATUS_LABELS[c].length > 0);
    assert.ok(STATUS_INFO[c].explain.endsWith("."));
  }
});

test("short notes", () => {
  assert.equal(listingNote("1"), null);
  assert.equal(listingNote(null), null);
  assert.equal(listingNote("T"), "Seasonal or trial");
  assert.equal(listingNote("L"), "Select stores");
  // U is "Unavailable Limited Distribution" at DABS, not "leaving soon".
  assert.equal(listingNote("U"), "Unavailable");
  assert.equal(listingNote("D"), "Discontinued");
  assert.equal(listingNote("Z"), null);
});

test("no unsourced claims in status wording", () => {
  const all = Object.values(STATUS_INFO).flatMap((v) => [v.label, v.note ?? "", v.explain]).join(" ").toLowerCase();
  for (const w of ["clearance", "leaving soon", "sale", "discount"]) assert.ok(!all.includes(w), w);
});
