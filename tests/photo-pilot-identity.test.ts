import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, compareIdentity, imageCollisions, parseIdentity, productKind, sameSize, type DabsListing } from "../pilot/photo-enrichment/identity";

// Material identity mistakes the photo pilot must never let through as "exact".
const listing = (name: string, sizeMl: number | null, kind: DabsListing["kind"] = "spirits", saleNames?: string[]): DabsListing =>
  ({ csc: "000000", name, sizeMl, kind, saleNames });
const judge = (cmp: ReturnType<typeof compareIdentity>, kind: DabsListing["kind"] = "spirits", over = {}) =>
  classify({ comparison: cmp, visual: "matches", brandConfirmed: true, expressionConfirmed: true, sizeConfirmed: true, imageUsable: true, kind, reusedCode: false, ...over }).cls;

test("sizes: label roundings match, different bottles don't", () => {
  assert.ok(sameSize(750, 750));
  assert.ok(parseIdentity("75cl").sizesMl.includes(750));
  assert.ok(parseIdentity("1.75 L").sizesMl.includes(1750));
  assert.ok(parseIdentity("12 fl oz can").sizesMl.includes(355));
  assert.ok(!sameSize(700, 750), "700 ml import vs 750 ml US bottle");
  assert.ok(!sameSize(1750, 1000));
});

test("a single-size page for another size is a hard conflict", () => {
  const cmp = compareIdentity(listing("TITOS HANDMADE VODKA 1750ml", 1750), "Tito's Handmade Vodka 750ml", "", true);
  assert.ok(cmp.conflicts.some((c) => c.startsWith("size")));
  assert.equal(judge(cmp), "reject");
});

test("a family page listing many sizes never confirms the size", () => {
  const cmp = compareIdentity(listing("TITOS HANDMADE VODKA 1750ml", 1750), "Tito's Handmade Vodka", "Available in 50ml, 375ml, 750ml, 1L and 1.75L", false);
  assert.equal(cmp.conflicts.length, 0);
  assert.ok(!cmp.confirmed.some((c) => c.startsWith("size")));
  assert.equal(judge(cmp, "spirits", { sizeConfirmed: false }), "possible");
});

test("expression: age statements and added expression words reject", () => {
  assert.equal(judge(compareIdentity(listing("KNOB CREEK 12 YR 750ml", 750), "Knob Creek 9 Year Small Batch", "750ml", true)), "reject");
  const cs = compareIdentity(listing("KNOB CREEK 12 YR 750ml", 750), "Knob Creek 12 Year Cask Strength", "750ml", true);
  assert.ok(cs.conflicts.some((c) => c.includes("cask strength")));
  assert.equal(judge(compareIdentity(listing("BUFFALO TRACE BOURBON 750ml", 750), "Eagle Rare 10 Year Bourbon", "750ml", true)), "reject");
  assert.equal(judge(compareIdentity(listing("OLD FORESTER SNGL BRL RYE BRL PRF 750ml", 750), "Old Forester Rye", "750ml", true)), "possible",
    "missing 'single barrel' / 'barrel proof' words leave the expression unconfirmed");
});

test("proof: a stated proof that differs rejects", () => {
  const cmp = compareIdentity(listing("ELIJAH CRAIG 94PF PRIVATE BARREL 750ml", 750), "Elijah Craig Private Barrel", "Bottled at 124.6 proof. 750ml", true);
  assert.ok(cmp.conflicts.some((c) => c.startsWith("proof")));
  assert.equal(judge(cmp), "reject");
  assert.equal(compareIdentity(listing("ELIJAH CRAIG 94PF PRIVATE BARREL 750ml", 750), "Elijah Craig Private Barrel", "47% ABV", true).conflicts.length, 0, "47% ABV = 94 proof");
});

test("vintage: another vintage is never exact; wine may be representative", () => {
  const cmp = compareIdentity(listing("CHATEAU D'YQUEM 2013 750ml", 750, "wine"), "Château d'Yquem 2015", "750ml", true);
  assert.ok(cmp.conflicts.some((c) => c.startsWith("vintage")));
  assert.equal(judge(cmp, "wine"), "representative");
  assert.equal(judge(compareIdentity(listing("HALE MARY PINOT NOIR RR'22 750ml", 750, "wine"), "Hale Mary Russian River Pinot Noir 2022", "750ml", true), "wine"), "exact");
  const nv = compareIdentity(listing("MEIOMI PINOT NOIR 750ml", 750, "wine"), "Meiomi Pinot Noir 2023", "750ml", true);
  assert.equal(judge(nv, "wine"), "representative", "DABS names no vintage: the pictured year can't be confirmed");
});

test("the representative exception is wine only", () => {
  const cmp = compareIdentity(listing("PENELOPE BOURBON F CANCER 2026 750ml", 750), "Penelope F Cancer Bourbon 2025", "750ml", true);
  assert.equal(judge(cmp), "reject");
  assert.equal(judge(compareIdentity(listing("KNOB CREEK 12 YR 750ml", 750), "Knob Creek 12 Year", "", false), "spirits", { visual: "family-only", sizeConfirmed: false }), "possible");
});

test("package: can vs bottle, gift sets", () => {
  assert.equal(judge(compareIdentity(listing("EPIC PFEIFFERHORN LAGER CANS 355ml", 355, "beer"), "Epic Pfeifferhorn Lager 22 oz bottle", "", true), "beer"), "reject");
  assert.equal(judge(compareIdentity(listing("HORNITOS PLATA 750ml", 750), "Hornitos Plata Gift Set with Shot Glass", "750ml", true)), "reject");
  const gift = compareIdentity(listing("VAMPIRE CHARDONNAY W/CAPES 750ml", 750, "wine"), "Vampire Chardonnay", "750ml", true);
  assert.ok(gift.unconfirmed.some((u) => u.includes("gift set")));
});

test("reused DABS codes can't be exact without a confirmed vintage", () => {
  const d = listing("CHAT BARET PESSAC LEOGNAN '23 750ml", 750, "wine", ["CHAT BARET PESSAC LEOGNAN '16/18", "CHAT BARET PESSAC LEOGNAN '23"]);
  const cmp = compareIdentity(d, "Château Baret Pessac-Léognan", "750ml", true);
  assert.ok(cmp.unconfirmed.some((u) => u.includes("reused")));
  assert.notEqual(judge(cmp, "wine", { reusedCode: true }), "exact");
});

test("one image accepted for two different listings is a collision", () => {
  const c = imageCollisions([
    { csc: "038176", name: "TITOS HANDMADE VODKA 750ml", sizeMl: 750, hash: "abc" },
    { csc: "038178", name: "TITOS HANDMADE VODKA 1750ml", sizeMl: 1750, hash: "abc" },
    { csc: "018006", name: "BUFFALO TRACE BOURBON 750ml", sizeMl: 750, hash: "def" },
  ]);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].cscs, ["038176", "038178"]);
});

test("unseen images are never exact, conflicts beat everything", () => {
  const clean = compareIdentity(listing("BUFFALO TRACE BOURBON 750ml", 750), "Buffalo Trace Kentucky Straight Bourbon Whiskey", "750 mL", true);
  assert.equal(judge(clean, "spirits", { visual: "not-inspected" }), "possible");
  assert.equal(judge(clean, "spirits", { visual: "wrong" }), "reject");
  assert.equal(judge(clean), "exact");
  assert.equal(productKind("GIFT SETS - LIQUEURS"), "spirits");
  assert.equal(productKind("ALLOCATED BEER"), "beer");
  assert.equal(productKind("SPECIAL ORDERS - WINE"), "wine");
});

test("DABS abbreviations, truncation and accents don't hide a match", () => {
  const trunc = compareIdentity(listing("ELIJAH CRAIG PRIVATE BARREL BRRL PR750ml", 750), "Elijah Craig Private Barrel Barrel Proof", "750ml", true);
  assert.equal(trunc.conflicts.length, 0, "PR is a truncated PROOF, not a missing word");
  assert.ok(!trunc.unconfirmed.some((u) => u.startsWith("DABS words")));
  const acc = compareIdentity(listing("PATRON SILVER TEQUILA 750ml", 750), "PATRÓN® Silver", "Patrón Silver Tequila 750ml", true);
  assert.ok(!acc.unconfirmed.some((u) => u.startsWith("DABS words")));
  const str = compareIdentity(listing("BOMBERGER'S KENTUCKY STR BOURBON 750ml", 750), "Bomberger's Declaration Kentucky Straight Bourbon", "", false);
  assert.ok(!str.unconfirmed.some((u) => u.startsWith("DABS words")));
  const white = compareIdentity(listing("BLACK BOX CHARDONNAY 3000ml", 3000, "wine"), "Black Box Chardonnay White Wine - 3L Box", "3L", true);
  assert.equal(white.conflicts.length, 0, "a wine's color isn't an expression");
  const jd = compareIdentity(listing("JACK DANIELS BLACK LABEL 1750ml", 1750), "Jack Daniel's Old No. 7 Tennessee Whiskey 1.75L", "", true);
  assert.ok(!jd.unconfirmed.some((u) => u.startsWith("DABS words")), "explicit alias: Black Label = Old No. 7");
  const other = compareIdentity(listing("BLACK BOX CHARDONNAY 3000ml", 3000, "wine"), "Bota Box Chardonnay 3L", "3L", true);
  assert.ok(other.unconfirmed.some((u) => u.includes("black")), "a different brand still misses the brand words");
});

test("BIB means Bottled in Bond; marketing copy isn't an expression", () => {
  assert.equal(compareIdentity(listing("NEW RIFF STR RYE WHSKY BIB 4YR 750ml", 750), "New Riff Kentucky Straight Rye Whiskey - Bottled in Bond 4 Year", "", false).conflicts.length, 0);
  assert.equal(compareIdentity(listing("SQUATTERS HOP RISING DBLE IPA CAN 355ml", 355, "beer"), "Hop Rising Double IPA – Smooth Finish", "", false).conflicts.length, 0);
  const cs = compareIdentity(listing("WILLETT BOURBON SMALL BATCH 4YR 750ml", 750), "Willett Family Estate Small Batch 4 Year Cask Strength", "", false);
  assert.ok(cs.conflicts.length > 0, "an added 'cask strength' still rejects, even when it may be the same bottle");
});
