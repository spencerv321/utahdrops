import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNext } from "../lib/auth-next";

const O = ["https://utahdrops.com"];
const intent = "/watch/confirm?intent=0f8fad5b-d9cb-469f-a165-70867728950e";
const redirectTo = `https://utahdrops.com/auth/confirm?next=${encodeURIComponent(intent)}`;

test("plain same-site paths pass through", () => {
  assert.equal(resolveNext(intent, O), intent);
  assert.equal(resolveNext("/watchlist?welcome=1", O), "/watchlist?welcome=1");
  assert.equal(resolveNext(null, O), "/");
});

test("{{ .RedirectTo }} as next keeps the intended destination", () => {
  // As the email renders it (encoded) and as a browser may hand it over (decoded once).
  const viaEncoded = new URL(`https://utahdrops.com/auth/confirm?token_hash=x&type=email&next=${encodeURIComponent(redirectTo)}`);
  assert.equal(resolveNext(viaEncoded.searchParams.get("next"), O), intent);
  const viaRaw = new URL(`https://utahdrops.com/auth/confirm?token_hash=x&type=email&next=${redirectTo}`);
  assert.equal(resolveNext(viaRaw.searchParams.get("next"), O), intent);
});

test("Site URL fallback lands on the home page", () => {
  assert.equal(resolveNext("https://utahdrops.com", O), "/");
  assert.equal(resolveNext("https://utahdrops.com/", O), "/");
});

test("other sites and tricks go home", () => {
  for (const bad of [
    "https://evil.com/watch/confirm",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "https://utahdrops.com.evil.com/x",
    "https://utahdrops.com/auth/confirm?next=https%3A%2F%2Fevil.com",
    "https://utahdrops.com/auth/confirm?next=%2Fauth%2Fconfirm%3Fnext%3D%252Fwatchlist",
    "not a url",
  ]) {
    assert.equal(resolveNext(bad, O), "/", bad);
  }
});
