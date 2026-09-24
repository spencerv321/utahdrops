import { test } from "node:test";
import assert from "node:assert/strict";
import { storeCapacity } from "../lib/jobs/store-capacity";

// Production on 2026-09-24: 5,411 in stock, 38 watched, 2.3 s/SKU, ~1% failures.
const base = { inStock: 5411, watched: 38, secondsPerSku: 2.3, failureRate: 0.01, watchRecheckHours: 3, watchShare: 0.4, timeBudgetMinutes: 25, delayJitterHours: 6 };

test("old schedule (4 runs × 300) can't cycle in-stock bottles inside a 3-day target", () => {
  const r = storeCapacity({ ...base, runsPerDay: 4, budget: 300 });
  assert.ok(r.rotationDays > 4.5, `${r.rotationDays} days`);
});

test("new schedule (6 runs × 400) cycles within 3 days and meets the watched target", () => {
  const r = storeCapacity({ ...base, runsPerDay: 6, budget: 400 });
  assert.ok(r.rotationDays <= 3, `${r.rotationDays} days`);
  assert.ok(r.watchedWorstHours <= 12, `${r.watchedWorstHours}h even with GitHub's worst observed delay`);
  assert.ok(r.minutesPerRun < 25, `${r.minutesPerRun} min`);
});

test("slow DABS is capped by the time budget, not the job timeout", () => {
  const r = storeCapacity({ ...base, runsPerDay: 6, budget: 400, secondsPerSku: 5 });
  assert.equal(r.attemptsPerRun, 300);
  assert.ok(r.minutesPerRun <= 25);
});

test("watched share bounds how much a large watchlist can take", () => {
  const r = storeCapacity({ ...base, runsPerDay: 6, budget: 400, watched: 5000 });
  assert.equal(r.watchedChecksPerDay, 6 * 160);
  assert.ok(r.rotationChecksPerDay > 0, "ordinary bottles still progress");
});

test("a re-check threshold at or above the run spacing can skip a run", () => {
  const r = storeCapacity({ ...base, runsPerDay: 6, budget: 400, watchRecheckHours: 4 });
  assert.ok(r.watchedWorstHours > 12);
});
