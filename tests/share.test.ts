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
  assert.equal(parseAttribution("share:admin"), null);
});
