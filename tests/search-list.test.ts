import { test } from "node:test";
import assert from "node:assert/strict";
import { searchListKey } from "../lib/search-list";

const SLC = { label: "Salt Lake City" };

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
    searchListKey("search:exact", { q: "gin" }, { label: "Provo" }, 12),
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
