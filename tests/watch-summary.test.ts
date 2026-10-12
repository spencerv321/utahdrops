import { test } from "node:test";
import assert from "node:assert/strict";
import { watchSummary } from "../lib/watch-summary";
import type { Nearby } from "../lib/queries";

const now = Date.parse("2026-10-11T18:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3600_000);
const near = (stores: number, units: number, checked: number, statewide: number | null, statewideAt: number): Nearby => ({
  stores,
  units,
  checkedAt: hoursAgo(checked),
  statewide: { qty: statewide, at: hoursAgo(statewideAt) },
});

test("counts watched and in-stock bottles", () => {
  const s = watchSummary(
    [
      { csc: "1", in_stock: true },
      { csc: "2", in_stock: false },
      { csc: "3", in_stock: true },
    ],
    undefined
  );
  assert.deepEqual(s, { total: 3, inStock: 2, near: null });
});

test("near counts only positive store checks, with the oldest check time", () => {
  const s = watchSummary(
    [
      { csc: "1", in_stock: true },
      { csc: "2", in_stock: true },
      { csc: "3", in_stock: true },
    ],
    new Map([
      ["1", near(2, 6, 5, 40, 10)],
      ["2", near(1, 3, 30, 12, 40)],
      ["3", near(0, 0, 2, 9, 10)],
    ])
  );
  assert.equal(s.near?.bottles, 2);
  assert.equal(s.near?.checkedAt.getTime(), hoursAgo(30).getTime());
});

test("a newer statewide count disproves a nearby count", () => {
  const s = watchSummary(
    [
      { csc: "1", in_stock: false },
      { csc: "2", in_stock: true },
    ],
    new Map([
      ["1", near(1, 2, 30, 0, 3)], // none statewide since the check
      ["2", near(2, 9, 30, 4, 3)], // more nearby than the state now has
    ])
  );
  assert.equal(s.near, null);
});

test("no nearby stock means no local claim, never 'none near'", () => {
  const s = watchSummary([{ csc: "1", in_stock: true }], new Map([["1", near(0, 0, 2, 5, 10)]]));
  assert.equal(s.near, null);
});
