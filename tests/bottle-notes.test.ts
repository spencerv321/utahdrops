import { test } from "node:test";
import assert from "node:assert/strict";
import { bottleDescription } from "../lib/bottle-notes";
import notes from "../lib/bottle-notes.json";

test("our note wins over DABS text", () => {
  const d = bottleDescription("016850", "Some DABS text about the bottle.");
  assert.equal(d?.ours, true);
  assert.match(d!.text, /Blanton's/);
});

test("other sizes of a label share its note", () => {
  const sizes = Object.entries(notes.products).filter(([, id]) => id === "015626").map(([csc]) => csc);
  assert.ok(sizes.length > 1);
  for (const csc of sizes) assert.equal(bottleDescription(csc, null)?.ours, true);
});

test("DABS text is shown when we have no note, unless it only describes the size", () => {
  assert.deepEqual(bottleDescription("000000", "Crisp blanco tequila with bright agave."), { text: "Crisp blanco tequila with bright agave.", ours: false });
  assert.equal(bottleDescription("000000", "Larger bottle of smooth vodka, ideal for cocktails."), null);
  assert.equal(bottleDescription("000000", "Extra-large bottle of Jim Beam bourbon."), null);
  assert.equal(bottleDescription("000000", "  "), null);
  assert.equal(bottleDescription("000000", null), null);
});

test("every note is one short paragraph", () => {
  for (const [id, text] of Object.entries(notes.notes)) {
    assert.ok(text.length >= 60 && text.length <= 520, id);
    assert.ok(!/\s{2}|\n/.test(text), id);
  }
});
