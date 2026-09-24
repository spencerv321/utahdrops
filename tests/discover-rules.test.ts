import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVER,
  mixPreview,
  nearState,
  parseSource,
  parseView,
  rankView,
  reasonFor,
  type DiscoverItem,
} from "../lib/discover-rules";

const NOW = Date.parse("2026-09-24T18:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000);

function item(csc: string, over: Partial<DiscoverItem> = {}): DiscoverItem {
  return {
    csc,
    name: `BOTTLE ${csc} 750ML`,
    category: "WHISKEY - BOURBON & TENNESSEE",
    sizeMl: 750,
    price: 50,
    isSpa: false,
    status: "1",
    storeQty: 10,
    statewideAt: hoursAgo(2),
    storeCheckedAt: null,
    tier: null,
    rarityHeadline: null,
    near: null,
    ...over,
  };
}

test("nearby is claimed only from fresh positive store checks", () => {
  const fresh = item("1", { near: { stores: 2, units: 5, checkedAt: hoursAgo(3) }, storeCheckedAt: hoursAgo(3) });
  assert.equal(nearState(fresh, true, NOW).kind, "near");
  // Positive rows older than the 24h window are not a nearby claim.
  const stale = item("2", { near: { stores: 2, units: 5, checkedAt: hoursAgo(30) }, storeCheckedAt: hoursAgo(30) });
  assert.equal(nearState(stale, true, NOW).kind, "unknown");
  // Checked recently with nothing nearby: a real "none near", with its check time.
  const none = item("3", { storeCheckedAt: hoursAgo(5) });
  assert.deepEqual(nearState(none, true, NOW), { kind: "not-near", checkedAt: hoursAgo(5) });
  // Never checked (or only failed attempts, which don't set storeCheckedAt): unknown, not zero.
  assert.equal(nearState(item("4"), true, NOW).kind, "unknown");
  // No area picked: no nearby claim at all.
  assert.equal(nearState(fresh, false, NOW).kind, "none-selected");
});

test("nearby only keeps just fresh, positive local observations", () => {
  const items = [
    item("1", { near: { stores: 1, units: 2, checkedAt: hoursAgo(2) }, storeCheckedAt: hoursAgo(2) }),
    item("2", { storeCheckedAt: hoursAgo(2) }),
    item("3", { near: { stores: 3, units: 9, checkedAt: hoursAgo(DISCOVER.nearbyMaxAgeHours + 1) } }),
    item("4"),
  ];
  const out = rankView(items, "scarce", { hasArea: true, nearbyOnly: true, now: NOW });
  assert.deepEqual(out.map((i) => i.csc), ["1"]);
});

test("scarce order: nearby first with an area, then tier, then fresher check, then code; stable", () => {
  const items = [
    item("5", { tier: "scarce", storeCheckedAt: hoursAgo(1) }),
    item("4", { tier: "unicorn" }),
    item("3", { tier: "rare", storeCheckedAt: hoursAgo(10) }),
    item("2", { tier: "rare", storeCheckedAt: hoursAgo(1) }),
    item("1", { tier: "scarce", near: { stores: 1, units: 1, checkedAt: hoursAgo(1) }, storeCheckedAt: hoursAgo(1) }),
  ];
  const statewide = rankView(items, "scarce", { hasArea: false, now: NOW }).map((i) => i.csc);
  assert.deepEqual(statewide, ["4", "2", "3", "1", "5"]);
  const nearby = rankView(items, "scarce", { hasArea: true, now: NOW }).map((i) => i.csc);
  assert.deepEqual(nearby, ["1", "4", "2", "3", "5"]);
  // Input order doesn't matter.
  assert.deepEqual(rankView([...items].reverse(), "scarce", { hasArea: true, now: NOW }).map((i) => i.csc), nearby);
});

test("price order by size of reduction; back order by most recent return", () => {
  const drops = [
    item("1", { price: 45, oldPrice: 50, dropAt: hoursAgo(5) }),
    item("2", { price: 30, oldPrice: 50, dropAt: hoursAgo(50) }),
    item("3", { price: 40, oldPrice: 50, dropAt: hoursAgo(1) }),
  ];
  assert.deepEqual(rankView(drops, "price", { hasArea: false, now: NOW }).map((i) => i.csc), ["2", "3", "1"]);
  const back = [
    item("1", { backAt: hoursAgo(48), outSince: hoursAgo(24 * 60) }),
    item("2", { backAt: hoursAgo(5), outSince: hoursAgo(24 * 40) }),
  ];
  assert.deepEqual(rankView(back, "back", { hasArea: false, now: NOW }).map((i) => i.csc), ["2", "1"]);
});

test("duplicates are dropped within a list", () => {
  const out = rankView([item("1", { tier: "rare" }), item("1", { tier: "rare" }), item("2", { tier: "scarce" })], "scarce", {
    hasArea: false,
    now: NOW,
  });
  assert.deepEqual(out.map((i) => i.csc), ["1", "2"]);
});

test("homepage preview: distinct bottles, nearby first, doesn't force every view", () => {
  const near = { stores: 1, units: 1, checkedAt: hoursAgo(1) };
  const picks = mixPreview(
    {
      scarce: [item("1", { tier: "rare" }), item("2", { tier: "scarce", near, storeCheckedAt: hoursAgo(1) })],
      back: [],
      price: [item("2", { price: 30, oldPrice: 50 }), item("3", { price: 40, oldPrice: 50 })],
    },
    { hasArea: true, now: NOW }
  );
  assert.deepEqual(
    picks.map((p) => `${p.view}:${p.item.csc}`),
    ["scarce:2", "scarce:1", "price:3"]
  );
  assert.equal(new Set(picks.map((p) => p.item.csc)).size, picks.length);
  assert.deepEqual(mixPreview({ scarce: [], back: [], price: [] }, { hasArea: false, now: NOW }), []);
});

test("reasons state the qualifying fact", () => {
  assert.match(
    reasonFor("price", item("1", { price: 40, oldPrice: 50, dropAt: new Date("2026-09-20T18:00:00Z") })),
    /^Down 20% from \$50\.00 \(seen Sep 20\)$/
  );
  assert.match(
    reasonFor("back", item("1", { outSince: new Date("2026-08-01T12:00:00Z"), backAt: new Date("2026-09-20T12:00:00Z") })),
    /^First observed back Sep 20, after 50\+ days out of stock$/
  );
  assert.equal(reasonFor("scarce", item("1", { rarityHeadline: "Hard to find" })), "Hard to find");
});

test("view and source parsing", () => {
  assert.equal(parseView("price"), "price");
  assert.equal(parseView("anything"), "scarce");
  assert.deepEqual(parseSource("home:back"), { surface: "home", view: "back" });
  assert.equal(parseSource("discover:everything"), null);
  assert.equal(parseSource(undefined), null);
});
