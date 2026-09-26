import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmRedirect, decodeDest, encodeDest, resolveDestination, safePath } from "../lib/auth-next";

const SITE = "https://utahdrops.com";
const O = [SITE];

/** How the link reaches /auth/confirm, for a given emailRedirectTo. */
const routes = {
  // Supabase's default link: verify, then redirect to RedirectTo with &code= appended.
  defaultLink: (redirectTo: string) => new URL(`${redirectTo}&code=abc123`),
  // The hosted Magic Link template as found on 2026-09-26 (owner-inspected):
  // {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email
  magicLinkTemplate: (redirectTo: string) => new URL(`${redirectTo}&token_hash=h&type=email`),
  // Token-hash template, {{ .RedirectTo }} inserted as-is.
  templateRaw: (redirectTo: string) => new URL(`${SITE}/auth/confirm?token_hash=h&type=email&next=${redirectTo}`),
  // Token-hash template, {{ .RedirectTo }} percent-encoded by the template engine.
  templateEscaped: (redirectTo: string) =>
    new URL(`${SITE}/auth/confirm?token_hash=h&type=email&next=${encodeURIComponent(redirectTo)}`),
};

const DESTINATIONS = [
  "/watch/confirm?intent=0f8fad5b-d9cb-469f-a165-70867728950e",
  "/watchlist?welcome=1",
  "/",
  "/search?q=gin&sort=price_asc",
  "/search?q=gin%26tonic",
  "/search?q=gin%26tonic&sort=price_asc&page=2",
  "/search?q=100%25%20agave&max=40",
  "/search?q=a%2Bb+c",
  "/product/012345#stores",
  "/search?q=a%C3%B1ejo&group=tequila#results",
];

test("every destination survives every link form unchanged", () => {
  for (const dest of DESTINATIONS) {
    const redirectTo = confirmRedirect(SITE, dest);
    for (const [name, route] of Object.entries(routes)) {
      assert.equal(resolveDestination(route(redirectTo).searchParams, O), dest, `${name}: ${dest}`);
    }
  }
});

test("the encoded destination uses only URL-safe characters", () => {
  for (const dest of DESTINATIONS) {
    assert.match(encodeDest(dest), /^[A-Za-z0-9_-]+$/);
    assert.equal(decodeDest(encodeDest(dest)), dest);
  }
  assert.equal(decodeDest("not base64!"), null);
  assert.equal(decodeDest(""), null);
});

test("Site URL fallback ({{ .RedirectTo }} = Site URL) lands on /", () => {
  for (const r of [SITE, `${SITE}/`]) {
    assert.equal(resolveDestination(routes.templateRaw(r).searchParams, O), "/");
    assert.equal(resolveDestination(routes.templateEscaped(r).searchParams, O), "/");
  }
});

test("links sent before the to= form still work (next=<encoded path>), incl. the hosted Magic Link form", () => {
  for (const dest of ["/watch/confirm?intent=0f8fad5b-d9cb-469f-a165-70867728950e", "/watchlist?welcome=1", "/search?q=gin&sort=price_asc"]) {
    const legacy = `${SITE}/auth/confirm?next=${encodeURIComponent(dest)}`;
    assert.equal(resolveDestination(new URL(`${legacy}&code=abc`).searchParams, O), dest);
    assert.equal(resolveDestination(routes.magicLinkTemplate(legacy).searchParams, O), dest);
  }
});

// Inherited from main (the old startsWith("/") check in /auth/confirm): values
// the browser normalizes into another host. Fixed by parsing before checking.
const OFFSITE = [
  "/\t/example.com",
  "/\n/example.com",
  "/\r\n/example.com",
  "\t//example.com",
  "/\\example.com",
  "\\\\example.com",
  "//example.com",
  "///example.com",
  "https://example.com/watchlist",
  "https:example.com",
  "https://utahdrops.com.example.com/x",
  "https://user@example.com",
  "javascript:alert(1)",
  "data:text/html,hi",
  "http://utahdrops.com/x", // wrong scheme = different origin
];

test("offsite and control-character destinations resolve to /", () => {
  for (const bad of OFFSITE) {
    const path = safePath(bad, O);
    assert.equal(new URL(path, SITE).origin, SITE, JSON.stringify(bad));
    assert.ok(path === "/" || path.startsWith("/") && !path.startsWith("//"), JSON.stringify(bad));
  }
});

test("…through every entry point, including percent-encoded controls", () => {
  const encoded = ["%2F%09%2Fexample.com", "%2F%0A%2Fexample.com", "%2F%5Cexample.com", "%2F%2Fexample.com"];
  for (const e of encoded) {
    const params = new URL(`${SITE}/auth/confirm?code=x&next=${e}`).searchParams;
    assert.equal(new URL(resolveDestination(params, O), SITE).origin, SITE, e);
  }
  for (const bad of OFFSITE) {
    const viaTo = new URL(`${SITE}/auth/confirm?to=${encodeDest(bad)}`).searchParams;
    assert.equal(new URL(resolveDestination(viaTo, O), SITE).origin, SITE, `to: ${JSON.stringify(bad)}`);
    const wrapped = confirmRedirect(SITE, bad);
    const viaTemplate = routes.templateEscaped(wrapped).searchParams;
    assert.equal(new URL(resolveDestination(viaTemplate, O), SITE).origin, SITE, `template: ${JSON.stringify(bad)}`);
  }
  // A destination that is another /auth/confirm is not followed again.
  const loop = confirmRedirect(SITE, confirmRedirect(SITE, "/watchlist").replace(SITE, ""));
  assert.equal(resolveDestination(new URL(loop).searchParams, O), "/");
  // Offsite RedirectTo in the template.
  const evil = routes.templateEscaped(`https://example.com/auth/confirm?to=${encodeDest("/watchlist")}`);
  assert.equal(resolveDestination(evil.searchParams, O), "/");
});

test("safe paths come back canonical", () => {
  assert.equal(safePath("/search?q=gin&sort=price_asc", O), "/search?q=gin&sort=price_asc");
  assert.equal(safePath(`${SITE}/product/1#x`, O), "/product/1#x");
  assert.equal(safePath("/a/../watchlist", O), "/watchlist");
  assert.equal(safePath(null, O), "/");
});
