import { test } from "node:test";
import assert from "node:assert/strict";
import { localAnswer, wantsLiveCheck, type LocalStore } from "../lib/local-availability";

const NOW = Date.parse("2026-09-27T18:00:00Z");
const h = (hours: number) => new Date(NOW - hours * 3600_000);

const PARK_CITY = { label: "Park City", lat: 40.6461, lng: -111.498 };
const ST_GEORGE = { label: "St. George", lat: 37.0965, lng: -113.5684 };

const store = (id: number, lat: number, lng: number, qty: number): LocalStore => ({
  store_id: id,
  name: `STORE ${id}`,
  city: null,
  address: null,
  phone: null,
  lat,
  lng,
  qty,
});
// ~1 mi from Park City; ~25 mi away in Salt Lake City.
const parkCity = (qty: number) => store(1, 40.66, -111.5, qty);
const slc = (qty: number) => store(2, 40.7608, -111.891, qty);

const base = {
  area: PARK_CITY,
  statewide: { qty: 40, at: h(1) },
  delisted: false,
  drawing: false,
  now: NOW,
};

test("no area chosen: no local claim", () => {
  const a = localAnswer({ ...base, area: null, stores: [parkCity(5)], checkedAt: h(2) });
  assert.equal(a.kind, "no-area");
});

test("fresh positive near the area, with the nearest stocked store", () => {
  const a = localAnswer({ ...base, stores: [slc(9), parkCity(5)], checkedAt: h(3) });
  assert.equal(a.kind, "fresh-positive");
  if (a.kind !== "fresh-positive") return;
  assert.equal(a.stores, 1);
  assert.equal(a.units, 5);
  assert.equal(a.nearest.store_id, 1);
  assert.equal(wantsLiveCheck(a), false);
});

test("a positive count 1-7 days old is last known, not now, and wants a live check", () => {
  const a = localAnswer({ ...base, statewide: { qty: 40, at: h(1) }, stores: [parkCity(5)], checkedAt: h(50) });
  assert.equal(a.kind, "stale-positive");
  assert.equal(wantsLiveCheck(a), true);
});

test("fresh zero near the area names stock elsewhere; never from an old check", () => {
  const fresh = localAnswer({ ...base, stores: [slc(9), parkCity(0)], checkedAt: h(3) });
  assert.equal(fresh.kind, "fresh-zero");
  if (fresh.kind === "fresh-zero") assert.equal(fresh.elsewhere?.store_id, 2);
  // Same data checked 30h ago: can't rule Park City out.
  const old = localAnswer({ ...base, stores: [slc(9), parkCity(0)], checkedAt: h(30) });
  assert.equal(old.kind, "unknown");
  assert.equal(wantsLiveCheck(old), true);
});

test("never checked, or checked over 7 days ago: unknown, not zero", () => {
  assert.equal(localAnswer({ ...base, stores: [], checkedAt: null }).kind, "unknown");
  assert.equal(localAnswer({ ...base, stores: [parkCity(5)], checkedAt: h(24 * 8) }).kind, "unknown");
});

test("statewide zero from a newer catalog pass wins, with or without an area", () => {
  const stores = [parkCity(5)];
  const statewide = { qty: 0, at: h(1) };
  assert.equal(localAnswer({ ...base, statewide, stores, checkedAt: h(3) }).kind, "statewide-zero");
  assert.equal(localAnswer({ ...base, area: null, statewide, stores, checkedAt: h(3) }).kind, "statewide-zero");
});

test("a store check newer than a statewide zero that found stock is believed", () => {
  const a = localAnswer({ ...base, statewide: { qty: 0, at: h(5) }, stores: [parkCity(2)], checkedAt: h(1) });
  assert.equal(a.kind, "fresh-positive");
});

test("nearby counts a newer statewide count rules out are out of date", () => {
  const a = localAnswer({ ...base, statewide: { qty: 3, at: h(1) }, stores: [parkCity(5)], checkedAt: h(4) });
  assert.equal(a.kind, "disproved");
  assert.equal(wantsLiveCheck(a), true);
});

test("delisted bottles make no stock claim; drawing releases are flagged", () => {
  const a = localAnswer({ ...base, delisted: true, drawing: true, stores: [parkCity(5)], checkedAt: h(1) });
  assert.deepEqual(a, { kind: "delisted", drawing: true });
});

test("the area decides nearness, not where the bottle is stocked", () => {
  const a = localAnswer({ ...base, area: ST_GEORGE, stores: [parkCity(5), slc(9)], checkedAt: h(2) });
  assert.equal(a.kind, "fresh-zero");
});
