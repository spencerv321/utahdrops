import { test } from "node:test";
import assert from "node:assert/strict";
import { activeSeason, holidayGroup, inBand, mixStrip, upcomingClosures, SEASONS, type HolidayGroup } from "../lib/holiday";

const g = (name: string, category: string, csc = "1") => holidayGroup({ csc, name, category });

test("groups holiday bottles by name and category", () => {
  assert.equal(g("CHAT D'OUILLY BEAUJOLAIS NOUVEAU'26 750", "WINE OFFER"), "nouveau");
  assert.equal(holidayGroup({ csc: "1", name: "DUBOEUF BEAUJOLAIS NOUVEAU'25 750ml", category: "WINE OFFER" }, 2026), null);
  assert.equal(g("NURNBERGER MARKT GLUHWEIN 1000 ml", "WINE OFFER"), "warm");
  assert.equal(g("EVAN WILLIAMS PPRMINT WH CH EGG NOG750ml", "GIFT SETS - LIQUEURS"), "nog");
  assert.equal(g("OLD NEW ENGLAND CINNAMON SPICE EGG 750ml", "GIFT SETS - LIQUEURS"), "nog");
  assert.equal(g("PENNSYLVANIA DUTCH PEP BARK EGG NOG750ml", "GIFT SETS - LIQUEURS"), "nog");
  assert.equal(g("DELIRIUM NOEL GIFT PACK 750ml", "BEER OFFER"), "beer");
  assert.equal(g("BIG SKY WINTER ALE POWDER HOUND 355ml", "BEER OFFER"), "beer");
  assert.equal(g("WOODFORD RES W/ GLASSES 750ml", "GIFT SETS - SPIRITS"), "gift");
  assert.equal(g("EL TEQUILENO PLAT/REPO TEQUILA GIFT375ml", "GIFT SETS - SPIRITS"), "gift");
  assert.equal(g("CROWN ROYAL SALTED CARAMEL 750ml", "GIFT SETS - SPIRITS"), "seasonal");
  assert.equal(g("THE HERB GARDEN FESTIVE GIN 750ml", "SPIRIT OFFER"), "seasonal");
});

test("leaves look-alikes out", () => {
  assert.equal(g("SANTA MARGHERITA PINOT GRIG0 750ml", "ITALIAN WHITE - PINOT GRIGIO"), null);
  assert.equal(g("SANTA CRISTINA CABERNET SAUV 750ml", "ITALIAN RED - VARIETAL"), null);
  assert.equal(g("ROTHMAN & WINTER CREME DE VIOLETTE 750ml", "LIQUEURS - CREAM"), null);
  assert.equal(g("YOSHI NO GAWA WINTER WARRIOR 720 ml", "SAKE - IMPORTED"), null);
  assert.equal(g("SPECIAL ORDER HOLIDAY THING", "SPECIAL ORDERS - SPIRITS"), null);
  assert.equal(g("JACK DANIELS OLD NO 7 750ml", "WHISKEY - BOURBON & TENNESSEE"), null);
});

test("season window and closures", () => {
  assert.equal(activeSeason(new Date("2026-11-21T18:00:00Z"))?.year, 2026);
  assert.equal(activeSeason(new Date("2027-01-03T18:00:00Z")), null);
  assert.equal(activeSeason(new Date("2026-10-01T18:00:00Z"), true)?.year, 2026);
  const s = SEASONS[0];
  assert.deepEqual(upcomingClosures(s, new Date("2026-11-27T18:00:00Z")).map((c) => c.holiday), ["Christmas", "New Year's Day"]);
  // Utah time: late on Nov 26 in Denver is still Thanksgiving.
  assert.equal(upcomingClosures(s, new Date("2026-11-27T05:00:00Z"))[0].holiday, "Thanksgiving");
});

test("strip mixes groups in order, one per group per round", () => {
  const by = { nouveau: ["n1"], warm: [], nog: ["e1", "e2"], beer: ["b1"], gift: ["g1", "g2"], seasonal: [] } as unknown as Record<HolidayGroup, string[]>;
  assert.deepEqual(mixStrip(by, 4), ["e1", "b1", "n1", "g1"]);
  assert.deepEqual(mixStrip(by, 6), ["e1", "b1", "n1", "g1", "e2", "g2"]);
});

test("gift price bands", () => {
  assert.ok(inBand(24.99, "under25"));
  assert.ok(inBand(25, "25to50"));
  assert.ok(inBand(50, "over50"));
});

test("holiday tracking sources", async () => {
  const { parseAttribution } = await import("../lib/discover-events");
  assert.deepEqual(parseAttribution("holiday:home"), { surface: "holiday", view: "home" });
  assert.deepEqual(parseAttribution("holiday:guide"), { surface: "holiday", view: "guide" });
  assert.deepEqual(parseAttribution("holiday:nog"), { surface: "holiday", view: "nog" });
  assert.equal(parseAttribution("holiday:santa"), null);
  assert.equal(parseAttribution("holiday:"), null);
});
