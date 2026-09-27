import { test } from "node:test";
import assert from "node:assert/strict";
import { keywordResultsShown, searchListKey } from "../lib/search-list";

const SLC = { label: "Salt Lake City", lat: 40.7608, lng: -111.891 };

test("same list, same key (param order and blank params don't matter)", () => {
  assert.equal(
    searchListKey("search:exact", { q: "gin", sort: "price_asc", page: undefined }, SLC, 12),
    searchListKey("search:exact", { sort: "price_asc", q: " gin ", instock: "" }, SLC, 12)
  );
});

test("equal-count changes to filters, sort, page or area are new lists", () => {
  const base = searchListKey("search:exact", { q: "gin" }, SLC, 12);
  for (const other of [
    searchListKey("search:exact", { q: "gin", sort: "price_asc" }, SLC, 12),
    searchListKey("search:exact", { q: "gin", instock: "1" }, SLC, 12),
    searchListKey("search:exact", { q: "gin", group: "gin", category: "GIN - IMPORTED" }, SLC, 12),
    searchListKey("search:exact", { q: "gin", page: "2" }, SLC, 12),
    searchListKey("search:exact", { q: "gin" }, { label: "Provo", lat: 40.2338, lng: -111.6585 }, 12),
    searchListKey("search:exact", { q: "gin" }, null, 12),
  ]) {
    assert.notEqual(other, base);
  }
});

test("filter-only browsing lists are told apart by their filters", () => {
  assert.notEqual(
    searchListKey("search:browse", { group: "vodka" }, null, 400),
    searchListKey("search:browse", { group: "vodka", max: "20" }, null, 400)
  );
});

test("a repeated query that now has a different count is a new list", () => {
  assert.notEqual(searchListKey("search:exact", { q: "gin" }, null, 0), searchListKey("search:exact", { q: "gin" }, null, 12));
});

test("two different geolocations labelled \"Near you\" are different lists", () => {
  const a = searchListKey("search:exact", { q: "gin" }, { label: "Near you", lat: 40.76, lng: -111.89 }, 12);
  const b = searchListKey("search:exact", { q: "gin" }, { label: "Near you", lat: 37.1, lng: -113.57 }, 12);
  assert.notEqual(a, b);
  assert.equal(a, searchListKey("search:exact", { q: "gin" }, { label: "Near you", lat: 40.76, lng: -111.89 }, 12));
});

test("a list only counts as shown when the keyword Results section is on screen", () => {
  // Ordinary search: matches, or a visible "Nothing on the shelf matches that".
  assert.equal(keywordResultsShown({ taste: false, q: "gin", total: 12, ask: false }), true);
  assert.equal(keywordResultsShown({ taste: false, q: "zzqq", total: 0, ask: false }), true, "visible zero-result list");
  // AI answer with no keyword matches: the section is hidden, nothing was displayed.
  assert.equal(keywordResultsShown({ taste: false, q: "peaty scotch under 60", total: 0, ask: true }), false);
  // AI answer alongside keyword matches: the list is shown.
  assert.equal(keywordResultsShown({ taste: false, q: "peaty scotch", total: 5, ask: true }), true);
  // Taste picks with no keyword matches: only the recommendations are shown.
  assert.equal(keywordResultsShown({ taste: true, q: "white not too dry", total: 0, ask: false }), false);
  // Taste picks plus keyword matches ("All matches for your words").
  assert.equal(keywordResultsShown({ taste: true, q: "riesling", total: 9, ask: false }), true);
  // Guided taste picks without words: a browse link replaces the list.
  assert.equal(keywordResultsShown({ taste: true, q: "", total: 300, ask: false }), false);
});
