import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORY_GROUPS, categoryFilterLabel, groupBySlug, groupCategories, groupOf, subcategoryLabel } from "../lib/categories";
import { SHORTCUTS, shortcutHref } from "../lib/browse";

// Every DABS category in the catalog on 2026-09-24.
const categories: string[] = JSON.parse(readFileSync(new URL("./fixtures/dabs-categories.json", import.meta.url), "utf8"));

test("every DABS category lands in a named group (none fall through to Other)", () => {
  const other = categories.filter((c) => groupOf(c)?.slug === "other");
  assert.deepEqual(other, []);
});

test("labels are unambiguous inside each group", () => {
  for (const { group, items } of groupCategories(categories)) {
    const labels = items.map((i) => i.label.toLowerCase());
    assert.equal(new Set(labels).size, labels.length, `duplicate label in ${group.label}: ${labels}`);
    for (const l of labels) assert.ok(l !== "imported" && l !== "domestic" && l !== "misc", `${group.label}: bare "${l}"`);
  }
  assert.equal(subcategoryLabel("VODKA - IMPORTED"), "Imported vodka");
  assert.equal(subcategoryLabel("FRENCH RED - BORDEAUX"), "French · Bordeaux");
  assert.equal(subcategoryLabel("RED VARIETAL - CABERNET"), "Cabernet");
  assert.equal(categoryFilterLabel("RUM - MISC"), "Other rum");
  assert.equal(categoryFilterLabel("SPANISH WHITE"), "White wine · Spanish");
});

test("homepage shortcuts and existing ?category= links still resolve", () => {
  for (const s of SHORTCUTS) {
    if (!s.category) continue;
    assert.ok(categories.includes(s.category), `${s.label} uses a real category`);
    assert.ok(groupOf(s.category), `${s.label} has a group`);
    const url = new URL(shortcutHref(s), "https://utahdrops.com");
    assert.equal(url.searchParams.get("category"), s.category, "shortcut URLs are unchanged");
  }
});

test("group slugs are unique and round-trip", () => {
  const slugs = CATEGORY_GROUPS.map((g) => g.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const g of CATEGORY_GROUPS) assert.equal(groupBySlug(g.slug), g);
  assert.equal(groupBySlug("nope"), null);
  assert.equal(groupBySlug(undefined), null);
});
