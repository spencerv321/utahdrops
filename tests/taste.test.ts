import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIdentity, extractProfile, inputHash } from "../lib/taste/profile";
import { parseTasteText } from "../lib/taste/parse";
import { EMPTY_REQUEST, requestFromParams, requestHref, resolveRequest, type TasteRequest } from "../lib/taste/request";
import { applyOverrides, scoreProfile } from "../lib/taste/score";
import { chips, clarification, followUps, lowerBudget, relaxOptions } from "../lib/taste/view";
import { mergeModel } from "../lib/taste/interpret";
import type { TasteOutcome } from "../lib/taste/recommend";

const AREAS = ["Draper", "Park City", "Salt Lake City", "Sandy"];
const req = (r: Partial<TasteRequest>): TasteRequest => ({ ...EMPTY_REQUEST, tags: [], ...r });
const q = (s: string) => new URLSearchParams(s.split("?")[1]);

// --- Reading typed requests -------------------------------------------------

test("the headline request is read into hard constraints and preferences", () => {
  const t = parseTasteText("A white wine that's not super common and not too dry, under $30 near Draper", AREAS);
  assert.equal(t.request.type, "white");
  assert.equal(t.request.maxPrice, 30);
  assert.equal(t.request.area, "Draper");
  assert.equal(t.request.sweet, "offdry"); // "not too dry" is not "dry"
  assert.equal(t.request.novelty, "ask"); // ambiguous: asks rather than guessing
  assert.deepEqual(t.unused, []);
  assert.ok(t.isTaste);
});

test("sweetness phrases don't collapse into each other", () => {
  assert.equal(parseTasteText("red wine not too sweet").request.sweet, "dry");
  assert.equal(parseTasteText("a little sweeter white").request.sweet, "offdry");
  assert.equal(parseTasteText("sweet red wine").request.sweet, "sweet");
  assert.equal(parseTasteText("bone dry rosé").request.sweet, "dry");
  assert.equal(parseTasteText("bone dry rosé").request.type, "rose");
});

test("occasions become visible preferences, not hidden filters", () => {
  const t = parseTasteText("something light and refreshing for a summer patio, white");
  assert.equal(t.request.body, "light");
  assert.ok(t.request.tags.includes("refreshing"));
  assert.equal(t.request.maxPrice, null);
  assert.deepEqual(t.unused, []);
});

test("exact bottle names are not taste requests", () => {
  for (const name of ["Blanton's", "kendall jackson chardonnay", "caymus cabernet", "eagle rare 10 year", "prosecco"]) {
    assert.equal(parseTasteText(name).isTaste, false, name);
  }
});

test("prices: ranges, 'around' and 'cheap' say what they did", () => {
  const range = parseTasteText("red wine $20-30");
  assert.deepEqual([range.request.minPrice, range.request.maxPrice], [20, 30]);
  const around = parseTasteText("white wine around $25");
  assert.equal(around.request.maxPrice, 30);
  assert.equal(around.phrases.maxPrice, "around $25");
  const cheap = parseTasteText("cheap sweet white wine");
  assert.equal(cheap.request.maxPrice, 15);
  assert.equal(cheap.phrases.maxPrice, "cheap");
});

test("places: only known areas; 'near me' asks for the visitor's area", () => {
  assert.equal(parseTasteText("white wine near Park City", AREAS).request.area, "Park City");
  assert.equal(parseTasteText("white wine near Narnia", AREAS).request.area, null);
  assert.equal(parseTasteText("dry red near me", AREAS).request.area, "me");
});

test("unread words are reported, not silently dropped", () => {
  const t = parseTasteText("white wine for my mother in law's birthday");
  assert.ok(t.unused.includes("birthday"));
});

// --- Extraction keeps evidence ----------------------------------------------

test("listing text: the value carries the exact DABS words", () => {
  const p = extractProfile({
    name: "CLEAN SLATE RIESLING 750ml",
    category: "WHITE VARIETAL - RIESLING",
    sizeMl: 750,
    description: "A vibrant Riesling with flavors of peach, apple, and lime, balanced by crisp acidity and a touch of sweetness.",
  });
  assert.equal(p.sweetness.value, "off-dry");
  assert.equal(p.sweetness.evidence, "product");
  assert.equal(p.sweetness.source, "dabs_description");
  assert.match(p.sweetness.quote!, /touch of sweetness/);
  assert.deepEqual(p.grapes.value, ["Riesling"]);
  assert.ok(p.tags.some((t) => t.value === "crisp" && t.evidence === "product"));
});

test("no information stays unknown; Riesling gets no sweetness guess", () => {
  const p = extractProfile({ name: "CHAT ST MICHELLE RIESLING 750ml", category: "WHITE VARIETAL - RIESLING", sizeMl: 750, description: null });
  assert.equal(p.sweetness.value, null);
  assert.equal(p.sweetness.evidence, "none");
});

test("style knowledge is marked as style, with its general note", () => {
  const p = extractProfile({ name: "FETZER PINOT GRIGIO 750ml", category: "WHITE VARIETAL - PINOT GRIS", sizeMl: 750, description: null });
  assert.equal(p.sweetness.value, "dry");
  assert.equal(p.sweetness.evidence, "style");
  assert.match(p.sweetness.note!, /typically/);
});

test("label words: Brut is dry, Extra Dry is off-dry, and White Zinfandel isn't a big red", () => {
  const brut = extractProfile({ name: "ZARDETTO PROSECCO Z BRUT 750ml", category: "SPARKLING WINE - PROSECCO", sizeMl: 750, description: null });
  assert.deepEqual([brut.sweetness.value, brut.sweetness.source], ["dry", "dabs_name"]);
  const xd = extractProfile({ name: "LA MARCA PROSECCO EXTRA DRY 750ml", category: "SPARKLING WINE - PROSECCO", sizeMl: 750, description: null });
  assert.equal(xd.sweetness.value, "off-dry");
  const wz = extractProfile({ name: "CORBETT CANYON WH ZINFANDEL 1500ml", category: "BLUSH WINE - DOMESTIC", sizeMl: 1500, description: null });
  assert.equal(wz.sweetness.value, "off-dry");
  assert.equal(wz.body.value, null);
});

test("aroma words aren't sweetness: 'sweet spice' and 'sweet tannins' don't count", () => {
  const p = extractProfile({ name: "SOME RED 750ml", category: "RED VARIETAL - MISC", sizeMl: 750, description: "Sweet spice and cedar with ripe plum." });
  assert.notEqual(p.sweetness.evidence, "product");
});

test("accented words match: 'sweet rosé'", () => {
  const p = extractProfile({ name: "JAM JAR BLUSH 750ml", category: "BLUSH WINE - IMPORTED", sizeMl: 750, description: "Fruity and sweet rosé with berry notes." });
  assert.equal(p.sweetness.value, "sweet");
});

test("ratings are never quoted back", () => {
  const p = extractProfile({ name: "X CABERNET 750ml", category: "RED VARIETAL - CABERNET", sizeMl: 750, description: "91 points Decanter Bold and full-bodied with dark fruit." });
  assert.doesNotMatch(p.body.quote ?? "", /91|points|Decanter/);
});

test("ambiguous codes are flagged, not profiled", () => {
  assert.equal(checkIdentity("RIDGE PETITE SIRAH LYTTN'21/22 750ml").status, "ambiguous");
  assert.equal(checkIdentity("KIM CRAWFORD ROSÉ (USE 284118) 750ml").status, "ambiguous");
  assert.equal(checkIdentity("RIDGE ZIN EASTBENCH'23 750ml").status, "ok");
});

test("cache key changes when the listing text changes", () => {
  const a = { name: "X 750ml", category: "C", sizeMl: 750, description: "one" };
  assert.equal(inputHash(a), inputHash({ ...a }));
  assert.notEqual(inputHash(a), inputHash({ ...a, description: "two" }));
});

// --- Scoring: preferences rank, contradictions exclude ----------------------

const riesling = extractProfile({ name: "R 750ml", category: "WHITE VARIETAL - RIESLING", sizeMl: 750, description: "Crisp and refreshing dry Riesling with citrus." });
const moscato = extractProfile({ name: "M 750ml", category: "WHITE VARIETAL - MISC", sizeMl: 750, description: "Sweet Moscato with peach." });
const unknownWhite = extractProfile({ name: "BLEND WHITE 750ml", category: "WHITE GENERIC - TABLE & PROPRIETARY", sizeMl: 750, description: null });

test("'not too dry' ranks a sweet wine up and excludes one its listing calls dry", () => {
  const r = req({ sweet: "offdry" });
  const ctx = { lessCommon: null, rarityTier: null };
  assert.ok(scoreProfile(moscato, r, ctx).points > 0);
  const dry = scoreProfile(riesling, r, ctx);
  assert.ok(dry.contradicted);
  const u = scoreProfile(unknownWhite, r, ctx);
  assert.deepEqual(u.unknowns, ["sweetness"]);
  assert.ok(u.points <= 0); // unknown never counts as a match
});

test("style evidence counts for less than the bottle's own listing", () => {
  const style = extractProfile({ name: "FETZER PINOT GRIGIO 750ml", category: "WHITE VARIETAL - PINOT GRIS", sizeMl: 750, description: null });
  const ctx = { lessCommon: null, rarityTier: null };
  assert.ok(scoreProfile(riesling, req({ sweet: "dry" }), ctx).points > scoreProfile(style, req({ sweet: "dry" }), ctx).points);
});

test("manual corrections win and keep their note", () => {
  const fixed = applyOverrides(unknownWhite, { sweetness: { value: "off-dry", note: "Producer sheet: 12 g/L", reviewed_on: "2026-09-25" } });
  assert.equal(fixed.sweetness.value, "off-dry");
  assert.equal(fixed.sweetness.evidence, "manual");
  const s = scoreProfile(fixed, req({ sweet: "offdry" }), { lessCommon: null, rarityTier: null });
  assert.match(s.contributions[0].reason, /reviewed by Utah Drops/);
});

test("reasons say which kind of evidence they rest on", () => {
  const ctx = { lessCommon: null, rarityTier: null };
  assert.match(scoreProfile(moscato, req({ sweet: "sweet" }), ctx).contributions[0].reason, /^DABS's listing describes it as sweet: “/);
  const style = extractProfile({ name: "FETZER PINOT GRIGIO 750ml", category: "WHITE VARIETAL - PINOT GRIS", sizeMl: 750, description: null });
  assert.match(scoreProfile(style, req({ body: "light" }), ctx).contributions[0].reason, /^Style note: .*general, not from this bottle's listing/);
});

// --- URL state, chips, follow-ups -------------------------------------------

test("URL values override typed words; 'any' clears", () => {
  const t = parseTasteText("white wine not too dry under $30", AREAS);
  const r = resolveRequest(t, { sweet: "any", max: "20" }, null);
  assert.equal(r.request.sweet, null);
  assert.equal(r.request.maxPrice, 20);
  assert.equal(r.request.type, "white");
});

test("the area setting is a default that typed words and the URL replace", () => {
  assert.equal(resolveRequest(null, {}, "Sandy").request.area, "Sandy");
  assert.equal(resolveRequest(parseTasteText("white near Draper", AREAS), {}, "Sandy").request.area, "Draper");
  assert.equal(resolveRequest(null, { area: "any" }, "Sandy").request.area, null);
});

test("guided form: empty like plus checked boxes", () => {
  assert.deepEqual(requestFromParams({ like: ["", "crisp", "fruity"] }).tags, ["crisp", "fruity"]);
  assert.deepEqual(requestFromParams({ like: "" }).tags, []);
});

test("links write only what differs from the typed request, and round-trip", () => {
  const typed = parseTasteText("white wine not too dry under $30 near Draper", AREAS);
  const defaults = resolveRequest(typed, {}, null).request;
  const base = { q: "white wine not too dry under $30 near Draper" };
  const href = requestHref(base, { ...defaults, sweet: "sweet" }, defaults);
  const params = Object.fromEntries(q(href));
  assert.deepEqual(Object.keys(params).sort(), ["q", "sweet"]);
  const again = resolveRequest(typed, params, null).request;
  assert.equal(again.sweet, "sweet");
  assert.equal(again.maxPrice, 30); // earlier constraints kept
  assert.equal(again.area, "Draper");
});

const outcome = (prices: string[]): TasteOutcome => ({
  results: prices.map((price, i) => ({ csc: String(i), name: "", sizeMl: 750, category: null, price, score: 1, reason: "", unknowns: [], evidence: [], near: null, statewide: { units: 1, asOf: new Date() }, rarityTier: null, showRarity: false })),
  eligible: prices.length, unknownNear: 0, notNear: 0, noInfo: 0, pilotSize: 260,
});

test("follow-ups change one thing and keep the rest", () => {
  const r = req({ type: "white", maxPrice: 30, area: "Draper", sweet: "offdry" });
  const f = followUps(r, EMPTY_REQUEST, {}, outcome(["12.99"]));
  const sweeter = Object.fromEntries(q(f.find((x) => x.key === "sweeter")!.href!));
  assert.deepEqual([sweeter.sweet, sweeter.max, sweeter.area, sweeter.wine], ["sweet", "30", "Draper", "white"]);
  const cheaper = Object.fromEntries(q(f.find((x) => x.key === "cheaper")!.href!));
  assert.equal(cheaper.max, "25");
  const maxed = followUps(req({ sweet: "sweet", body: "light" }), EMPTY_REQUEST, {}, outcome([]));
  assert.equal(maxed.find((x) => x.key === "sweeter")!.href, null); // explained, not silently changed
  assert.equal(maxed.find((x) => x.key === "lighter")!.href, null);
  assert.equal(lowerBudget(10), null);
});

test("relaxing is offered, never applied", () => {
  const r = req({ type: "white", maxPrice: 30, area: "Draper", sweet: "offdry" });
  const opts = relaxOptions(r, EMPTY_REQUEST, {}, outcome([]), "Draper");
  assert.ok(opts.some((o) => /all of Utah/.test(o.label)));
  assert.ok(opts.some((o) => /\$40/.test(o.label)));
});

test("chips split strict constraints from preferences", () => {
  const t = parseTasteText("A white wine that's not super common and not too dry, under $30 near Draper", AREAS);
  const r = resolveRequest(t, {}, null);
  const c = chips(r, r.request, {}, "Draper");
  assert.deepEqual(c.hard.map((x) => x.label), ["White wine", "Under $30", "Near Draper (10 mi)"]);
  assert.deepEqual(c.prefs.map((x) => x.from), ["“not too dry”", "“not super common”"]);
  const removed = resolveRequest(t, Object.fromEntries(q(c.hard[1].removeHref)), null).request;
  assert.equal(removed.maxPrice, null);
  assert.equal(removed.sweet, "offdry");
});

test("one clarification at most, and only when it changes results", () => {
  const amb = resolveRequest(parseTasteText("an unusual white wine under $25"), {}, null);
  assert.equal(clarification(amb, amb.request, {}, true)?.kind, "novelty");
  const noType = resolveRequest(parseTasteText("a wine that's not too dry under $20"), {}, null);
  assert.equal(clarification(noType, noType.request, {}, true)?.kind, "type");
  const me = resolveRequest(parseTasteText("dry red near me"), {}, null);
  assert.equal(clarification(me, me.request, {}, false)?.kind, "area");
  const clear = resolveRequest(parseTasteText("dry red under $20"), {}, null);
  assert.equal(clarification(clear, clear.request, {}, true), null);
});

test("the model can only fill empty preferences, never constraints", () => {
  const t = parseTasteText("white wine for a barbecue under $20");
  const merged = mergeModel(t, { sweet: "offdry", tags: ["fruity"], words: "barbecue", ...({ maxPrice: 99, area: "Moab" } as object) });
  assert.equal(merged.request.maxPrice, 20);
  assert.equal(merged.request.area, null);
  assert.equal(merged.request.sweet, "offdry");
  assert.equal(merged.origin.sweet, "model");
  const kept = mergeModel(parseTasteText("dry white wine"), { sweet: "sweet" });
  assert.equal(kept.request.sweet, "dry");
});
