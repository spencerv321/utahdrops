import { test } from "node:test";
import assert from "node:assert/strict";
import { queryTokens, searchKey } from "../lib/search-key";

test("apostrophes, possessives and brand aliases", () => {
  assert.equal(searchKey("BLANTON'S GOLD SBS BARREL 750ml"), "blanton gold sbs barrel 750 ml");
  assert.equal(searchKey("Blanton’s"), "blanton");
  assert.equal(searchKey("MAKER'S MARK"), "makers mark");
  assert.equal(searchKey("TITOS HANDMADE VODKA"), "titos handmade vodka");
  // A typed possessive also matches the bare brand ("WELLER" in DABS).
  assert.deepEqual(queryTokens("Weller's")[0].alts, ["wellers", "weller"]);
  // …but a plain trailing "s" is never stripped.
  assert.deepEqual(queryTokens("titos")[0].alts, ["titos"]);
  assert.deepEqual(queryTokens("makers mark").map((t) => t.alts), [["makers"], ["mark"]]);
});

test("initials and DABS abbreviations", () => {
  assert.equal(searchKey("E.H. TAYLOR STRAIGHT RYE"), "eh taylor straight rye");
  assert.equal(searchKey("E H TAYLOR SMALL BATCH"), "eh taylor small batch");
  assert.equal(searchKey("EH Taylor"), "eh taylor");
  assert.equal(searchKey("BUFFALO TRACE O.F.C."), "buffalo trace ofc");
  assert.equal(searchKey("BLANTON BOURBON SNGL BRRL 750ml"), "blanton bourbon single barrel 750 ml");
  assert.equal(searchKey("KIM CRAWFORD ILLUMINATE SAUV BLANC"), "kim crawford illuminate sauvignon blanc");
  assert.equal(searchKey("josh cab"), "josh cabernet");
});

test("sizes, ages and vintages stay distinct tokens", () => {
  assert.equal(searchKey("WELLER 12YR"), "weller 12 yr");
  assert.equal(searchKey("eagle rare 10 year"), "eagle rare 10 yr");
  assert.equal(searchKey("TITOS HANDMADE VODKA 1.75L"), "titos handmade vodka 1.75 l");
  assert.equal(searchKey("TAYLOR FLADGATE VINTAGE'00"), "taylor fladgate vintage 00");
  assert.notEqual(searchKey("MAKERS MARK 46"), searchKey("MAKERS MARK"));
  // "12 year old" drops the "old" DABS never writes; "Old Forester" keeps it.
  assert.deepEqual(queryTokens("weller 12 year old").map((t) => t.raw), ["weller", "12", "yr"]);
  assert.deepEqual(queryTokens("old forester").map((t) => t.raw), ["old", "forester"]);
});

test("empty and junk input", () => {
  assert.equal(searchKey(""), "");
  assert.equal(searchKey(null), "");
  assert.deepEqual(queryTokens("  !!  "), []);
  assert.equal(queryTokens("a b c d e f g h i j k l m n o p q r s t u v w x y z 1 2 3 4 5 6 7 8 9").length <= 8, true);
});
