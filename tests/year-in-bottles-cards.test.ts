import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCards,
  compact,
  displayNameOf,
  EDITIONS,
  getEdition,
  money,
  onHome,
  signedPct,
  windowLabel,
  type YearEdition,
} from "../lib/year-in-bottles-cards";

const s2026 = EDITIONS["2026"];
const clone = (s: YearEdition): YearEdition => JSON.parse(JSON.stringify(s));

test("the 2026 deck builds, with every card complete and unique", () => {
  const cards = buildCards(s2026);
  assert.deepEqual(
    cards.map((c) => c.slug),
    ["total", "mix", "number-one", "riser", "peak-month", "seasons", "homegrown", "the-hunt", "splurge"]
  );
  for (const c of cards) {
    assert.ok(c.kicker && c.body && c.foot && c.ogLine, `${c.slug} is missing copy`);
    assert.ok(c.big || c.headline, `${c.slug} has neither a figure nor a headline`);
    assert.match(c.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  }
});

test("card figures come from the snapshot", () => {
  const cards = Object.fromEntries(buildCards(s2026).map((c) => [c.slug, c]));
  assert.equal(cards.total.big, compact(s2026.totals.units));
  assert.equal(cards.total.foot, `${money(s2026.totals.dollars)} in sales`);
  assert.equal(cards.riser.big, signedPct(s2026.yoy!.kinds[0].dollarChange!));
  assert.equal(cards["peak-month"].big, money(s2026.peakMonth.dollars));
  assert.equal(cards["the-hunt"].big, s2026.allocated.units.toLocaleString("en-US"));
  assert.equal(cards["number-one"].headline, displayNameOf(s2026.top.familiesByDollars[0].title));
  assert.equal(windowLabel(s2026), "Oct 2025 – Sep 2026");
});

test("copy stays within the rules: no live claims, nothing per person, no raw DABS names", () => {
  const text = JSON.stringify(buildCards(s2026));
  assert.doesNotMatch(text, /right now|per (person|capita|adult|resident)|you drink|drinkers/i);
  assert.doesNotMatch(text, /\bTitos\b|\bDrc\b|\bYr\b/);
});

test("a claim that stops holding fails the build instead of printing", () => {
  const s = clone(s2026);
  s.top.familiesByDollars[1] = { ...s.top.familiesByDollars[1], dollars: s.top.familiesByDollars[0].dollars * 0.9 };
  assert.throws(() => buildCards(s), /at least twice the runner-up/);

  const t = clone(s2026);
  t.yoy!.kinds = t.yoy!.kinds.map((k) => ({ ...k, dollarChange: 0.05 }));
  assert.throws(() => buildCards(t), /every other kind dipped/);
});

test("bottle names need a reviewed display name", () => {
  assert.throws(() => displayNameOf("Some Raw Dabs Name"), /no reviewed display name/);
  const s = clone(s2026);
  s.splurge[0] = { ...s.splurge[0], title: "Unreviewed Bottle" };
  assert.throws(() => buildCards(s), /Unreviewed Bottle/);
});

test("homepage pointer shows only in its window; unknown editions don't exist", () => {
  assert.equal(onHome("2026-11-23"), false);
  assert.equal(onHome("2026-12-15"), true);
  assert.equal(onHome("2027-01-31"), true);
  assert.equal(onHome("2027-02-01"), false);
  assert.equal(getEdition("1999"), null);
});

test("the client deck doesn't bundle the snapshot", () => {
  const src = readFileSync(join(process.cwd(), "components/year-deck.tsx"), "utf8");
  assert.doesNotMatch(src, /import \{[^}]*\} from "@\/lib\/year-in-bottles-cards"/);
  assert.match(src, /import type \{ YearCard \} from "@\/lib\/year-in-bottles-cards"/);
});

test("site banner runs from launch through mid-January", async () => {
  const { onBanner } = await import("../lib/year-in-bottles-paths");
  assert.equal(onBanner("2026-11-23"), false);
  assert.equal(onBanner("2026-11-24"), true);
  assert.equal(onBanner("2027-01-15"), true);
  assert.equal(onBanner("2027-01-16"), false);
});
