import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEGATIVE_CLAIM_MAX_AGE_HOURS,
  canClaimNone,
  exceedsStatewide,
  noneStatewideSince,
} from "../lib/store-freshness";
import { DISCOVER } from "../lib/discover-rules";

const now = Date.parse("2026-09-25T18:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3600_000);

test("negative claims use the same 24h standard as Worth a look", () => {
  assert.equal(NEGATIVE_CLAIM_MAX_AGE_HOURS, DISCOVER.nearbyMaxAgeHours);
  assert.equal(NEGATIVE_CLAIM_MAX_AGE_HOURS, 24);
});

test("'none here' only from a check under a day old", () => {
  assert.equal(canClaimNone(hoursAgo(5), now), true);
  assert.equal(canClaimNone(hoursAgo(24), now), true);
  assert.equal(canClaimNone(hoursAgo(25), now), false);
  assert.equal(canClaimNone(hoursAgo(24 * 6), now), false);
  assert.equal(canClaimNone(null, now), false, "never checked is unknown, not none");
  assert.equal(canClaimNone(hoursAgo(1).toISOString(), now), true, "ISO strings from client props");
});

test("a later statewide zero disproves older positive store counts", () => {
  const checked = hoursAgo(30);
  assert.equal(noneStatewideSince({ qty: 0, at: hoursAgo(3) }, checked), true);
  assert.equal(noneStatewideSince({ qty: null, at: hoursAgo(3) }, checked), true);
  assert.equal(noneStatewideSince({ qty: 14, at: hoursAgo(3) }, checked), false);
});

test("a statewide count older than the store check can't contradict it", () => {
  const checked = hoursAgo(2);
  assert.equal(noneStatewideSince({ qty: 0, at: hoursAgo(6) }, checked), false);
  assert.equal(exceedsStatewide(20, { qty: 14, at: hoursAgo(6) }, checked), false);
});

test("a store can't hold more than the whole state does now", () => {
  const checked = hoursAgo(30);
  const statewide = { qty: 14, at: hoursAgo(3) };
  assert.equal(exceedsStatewide(20, statewide, checked), true);
  assert.equal(exceedsStatewide(14, statewide, checked), false, "equal is possible (every bottle at one store)");
  assert.equal(exceedsStatewide(3, statewide, checked), false, "lower is not proof of anything either way");
  assert.equal(exceedsStatewide(0, statewide, checked), false, "zeros are never 'out of date' stock");
});

test("missing timestamps never disprove anything", () => {
  assert.equal(noneStatewideSince({ qty: 0, at: null }, hoursAgo(1)), false);
  assert.equal(exceedsStatewide(5, { qty: 1, at: hoursAgo(1) }, null), false);
});
