import { test } from "node:test";
import assert from "node:assert/strict";
import { shareUrl } from "../lib/share";
import { sourceOf, SOURCE_KIND } from "../lib/analytics";
import { parseAttribution } from "../lib/discover-events";

test("shareUrl tags the link and drops the sharer's own tracking", () => {
  assert.equal(shareUrl("https://utahdrops.com/product/012345"), "https://utahdrops.com/product/012345?ref=share");
  assert.equal(
    shareUrl("https://utahdrops.com/product/012345?utm_source=email&utm_medium=alert&ref=x#stores"),
    "https://utahdrops.com/product/012345?ref=share"
  );
  assert.equal(shareUrl("https://utahdrops.com/search?q=bourbon&sort=price"), "https://utahdrops.com/search?q=bourbon&sort=price&ref=share");
});

test("shared-link visits get their own source and channel", () => {
  assert.equal(sourceOf(null, "share"), "Shared link");
  assert.equal(SOURCE_KIND["Shared link"], "Shared");
});

test("share events are attributed; unknown share pages are not", () => {
  assert.deepEqual(parseAttribution("share:product"), { surface: "share", view: "product" });
  assert.deepEqual(parseAttribution("share:discover"), { surface: "share", view: "discover" });
  assert.deepEqual(parseAttribution("share:holidays"), { surface: "share", view: "holidays" });
  assert.deepEqual(parseAttribution("share:year"), { surface: "share", view: "year" });
  assert.deepEqual(parseAttribution("share:year-peak-month"), { surface: "share", view: "year-peak-month" });
  assert.equal(parseAttribution("share:admin"), null);
  assert.equal(parseAttribution("share:year-Bad Slug"), null);
});

test("Year in Bottles actions are attributed", () => {
  assert.deepEqual(parseAttribution("year:banner"), { surface: "year", view: "banner" });
  assert.deepEqual(parseAttribution("year:card-the-hunt"), { surface: "year", view: "card-the-hunt" });
  assert.deepEqual(parseAttribution("year:drops"), { surface: "year", view: "drops" });
  assert.equal(parseAttribution("year:anything"), null);
});
