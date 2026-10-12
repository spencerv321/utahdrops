import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KIND_ORDER, MAKERS, MAKERS_CHECKED, MAKER_SOURCES, citedSources, makerForProduct, regionOf, sourceFor } from "../lib/makers";
import { vendorCode } from "../lib/dabs/xlsx";

// Makers rule (same as Utah 101): every fact comes from a listed source, no
// guessing. These checks keep data/makers.json honest and complete.

const claimsOf = (m: (typeof MAKERS)[number]) => [m.summary, ...m.makes, ...m.visit, ...m.toGo, ...m.locals];
const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T12:00:00Z").getTime() <= Date.now();

test("every DABS Proudly Utah listing has a page (83 listings, October 2026)", () => {
  const listings = MAKERS.flatMap((m) => m.dabs);
  assert.equal(listings.length, 83);
  const byKind = Object.fromEntries(KIND_ORDER.map((k) => [k, listings.filter((d) => d.kind === k).length]));
  assert.deepEqual(byKind, { brewery: 42, distillery: 22, winery: 12, cidery: 7 });
  for (const m of MAKERS) {
    for (const d of m.dabs) assert.ok(m.kinds.includes(d.kind), `${m.slug}: listing kind ${d.kind} not in kinds`);
  }
});

test("slugs are unique and URL-safe; every maker has a region and a place", () => {
  const slugs = MAKERS.map((m) => m.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const m of MAKERS) {
    assert.match(m.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(m.places.length > 0, `${m.slug} has no place`);
    assert.ok(regionOf(m), `${m.slug}: no region for ${m.places[0]?.city}`);
  }
});

test("every claim cites at least one source, and every source id resolves", () => {
  for (const m of MAKERS) {
    for (const c of claimsOf(m)) {
      assert.ok(c.t.trim().length > 0, `${m.slug}: empty claim`);
      assert.ok(c.s.length > 0, `${m.slug}: uncited claim "${c.t}"`);
      for (const id of c.s) assert.ok(sourceFor(m, id), `${m.slug}: unknown source ${id}`);
    }
  }
});

test("every maker-specific source is cited, and source URLs look right", () => {
  for (const m of MAKERS) {
    const cited = new Set(claimsOf(m).flatMap((c) => c.s));
    for (const id of Object.keys(m.sources)) {
      assert.ok(cited.has(id), `${m.slug} lists ${id} but never cites it`);
      assert.ok(!(id in MAKER_SOURCES), `${m.slug}: ${id} shadows a shared source`);
    }
    for (const { id, source } of citedSources(m)) {
      assert.match(source.url, /^https?:\/\/[^\s]+$/, `${m.slug}: bad url for ${id}`);
      assert.ok(source.title && source.publisher, `${m.slug}: ${id} needs a title and publisher`);
    }
  }
});

test("every shared source is used by some maker or by every page", () => {
  const used = new Set(MAKERS.flatMap((m) => citedSources(m).map((s) => s.id)));
  for (const id of Object.keys(MAKER_SOURCES)) assert.ok(used.has(id), `${id} is unused`);
});

test("owner notes are credited and dated; checked date is real", () => {
  assert.ok(isoDate(MAKERS_CHECKED));
  for (const m of MAKERS) {
    for (const n of m.notes) {
      assert.ok(n.text.trim() && n.by.trim(), `${m.slug}: note needs text and a byline`);
      assert.ok(isoDate(n.date), `${m.slug}: note date ${n.date}`);
    }
  }
});

test("catalog matchers are uppercase prefixes and digit vendor codes, owned by one maker", () => {
  const seen = new Map<string, string>();
  for (const m of MAKERS) {
    for (const p of m.catalog.prefixes ?? []) {
      assert.equal(p, p.toUpperCase(), `${m.slug}: prefix "${p}" must be uppercase (DABS names are)`);
      assert.ok(p.length >= 3, `${m.slug}: prefix "${p}" too short`);
    }
    for (const v of m.catalog.vendors ?? []) {
      assert.match(v, /^[1-9]\d*$/, `${m.slug}: vendor code ${v}`);
      assert.ok(!seen.has(v), `vendor ${v} on ${seen.get(v)} and ${m.slug}`);
      seen.set(v, m.slug);
    }
  }
});

test("makerForProduct matches by vendor code or prefix, and honors excludes", () => {
  assert.equal(makerForProduct({ csc: "1", name: "EPIC LOS LOCOS LAGER 355 ml", vendor_code: null })?.slug, "epic-brewing");
  assert.equal(makerForProduct({ csc: "1", name: "CANARY COCKTAILS PALOMA", vendor_code: "2150" })?.slug, "beehive-distilling");
  assert.equal(makerForProduct({ csc: "950329", name: "ALPINE BEER CO. DUET 355ml", vendor_code: null }), undefined);
  assert.equal(makerForProduct({ csc: "1", name: "PROPER NO. TWELVE 1750ml", vendor_code: null }), undefined);
  assert.equal(makerForProduct({ csc: "1", name: "BUFFALO TRACE 750ml", vendor_code: "1234" }), undefined);
});

test("vendorCode normalizes DABS Vendor Cd values", () => {
  assert.equal(vendorCode("001788"), "1788");
  assert.equal(vendorCode("VC0000200479"), "200479");
  assert.equal(vendorCode(null, "EPIC BREWING COMPANY, LLC (001788)"), "1788");
  assert.equal(vendorCode("", "BEWILDER BREWING COMPANY"), null);
});

test("makers not on Proudly Utah carry real DABS manufacturing licenses", () => {
  const csv = readFileSync(join(__dirname, "../data/licensees/dabs-licensees-2026-10-12.csv"), "utf8");
  for (const m of MAKERS.filter((x) => x.dabs.length === 0)) {
    const licenses = m.licenses ?? [];
    assert.ok(licenses.some((l) => l.type.startsWith("Manufacturing")), `${m.slug}: needs a manufacturing license`);
    for (const l of licenses) {
      const row = csv.split("\n").find((r) => r.startsWith(`${l.number},`));
      assert.ok(row?.includes(`,${l.type},`) && row.includes(l.since), `${m.slug}: ${l.number} doesn't match the license snapshot`);
      assert.ok(isoDate(l.since), `${m.slug}: ${l.number} since ${l.since}`);
    }
  }
  for (const m of MAKERS.filter((x) => x.dabs.length > 0)) assert.ok(!m.licenses, `${m.slug}: listed makers don't need licenses`);
});
