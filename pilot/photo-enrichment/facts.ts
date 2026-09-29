/**
 * Photo/enrichment pilot, fact track: one row per individual claim, each with
 * its source URL, the exact supporting text and what kind of evidence it is.
 *
 *   npx tsx pilot/photo-enrichment/facts.ts
 *
 * Source types (kept apart on purpose):
 *   dabs       what DABS lists (name, size, category, detail-page text)
 *   producer   the producer/brand's own page
 *   other      importer, retailer, state store, trade press
 *   inference  read from a name or style (e.g. "Sauvignon Blanc" in the name)
 *   unknown    nothing found (written as an explicit row so gaps are counted)
 *
 * Nothing here chooses between sources: when two say different things about
 * the same attribute both rows stay, and the attribute is marked "conflict".
 * A claim only counts as verified when its quote is on a page whose product
 * identity passed review for this listing (data/review.json: page not
 * rejected as another product). Descriptions are not written from these.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseIdentity, productKind } from "./identity";

const DIR = __dirname;
type SourceType = "dabs" | "producer" | "other" | "inference" | "unknown";
export interface Fact {
  csc: string;
  attribute: "producer" | "category" | "region" | "grape_or_grain" | "abv" | "size" | "age" | "vintage" | "tasting_notes";
  value: string;
  source_type: SourceType;
  source_url: string | null;
  quote: string | null;
  evidence: string;
  status: "verified" | "unverified" | "conflict" | "unknown";
}

const ATTRS: Fact["attribute"][] = ["producer", "category", "region", "grape_or_grain", "abv", "size", "age", "vintage", "tasting_notes"];
const GRAPES = ["cabernet sauvignon", "cabernet franc", "merlot", "pinot noir", "pinot grigio", "pinot gris", "chardonnay", "sauvignon blanc", "zinfandel", "syrah", "shiraz", "grenache", "cinsault", "rolle", "vermentino", "glera", "nero d'avola", "pinotage", "sangiovese", "semillon", "meunier", "malbec", "riesling", "mondeuse", "carignan"];
const GRAINS = ["corn", "rye", "wheat", "malted barley", "barley", "agave", "blue weber agave", "grapes", "apples", "sugarcane", "molasses", "hops"];

function main() {
  const dabs = JSON.parse(readFileSync(join(DIR, "data/dabs.json"), "utf8"));
  const cands = JSON.parse(readFileSync(join(DIR, "data/candidates.json"), "utf8"));
  const review = JSON.parse(readFileSync(join(DIR, "data/review.json"), "utf8"));
  const facts: Fact[] = [];
  for (const [csc, d] of Object.entries<Record<string, unknown>>(dabs)) {
    const name = String(d.name);
    const kind = productKind(d.category as string, name);
    const add = (f: Omit<Fact, "csc" | "status"> & { status?: Fact["status"] }) => facts.push({ csc, status: "unverified", ...f });
    // DABS-stated.
    const dabsUrl = `DABS product locator, item ${csc}`;
    const saleSize = parseIdentity(((d.sale_names as string[]) ?? []).join(" ")).sizesMl[0];
    if (!d.size_ml && saleSize) add({ attribute: "size", value: `${saleSize} ml`, source_type: "dabs", source_url: "DABS monthly sales report", quote: ((d.sale_names as string[]) ?? []).join(" | "), evidence: "size on the DABS sales-report line (catalog name was truncated)", status: "verified" });
    if (d.size_ml) add({ attribute: "size", value: `${d.size_ml} ml`, source_type: "dabs", source_url: dabsUrl, quote: name, evidence: "DABS listing size field", status: "verified" });
    if (d.category) add({ attribute: "category", value: String(d.category), source_type: "dabs", source_url: dabsUrl, quote: String(d.category), evidence: "DABS category", status: "verified" });
    if (d.description) add({ attribute: "tasting_notes", value: String(d.description), source_type: "dabs", source_url: dabsUrl, quote: String(d.description), evidence: "DABS detail-page text (supplier-provided, not checked by DABS)", status: "verified" });
    const ni = parseIdentity(name);
    if (ni.ages.length) add({ attribute: "age", value: `${ni.ages[0]} years`, source_type: "dabs", source_url: dabsUrl, quote: name, evidence: "age in DABS name", status: "verified" });
    if (ni.vintages.length) add({ attribute: "vintage", value: ni.vintages.join("/"), source_type: "dabs", source_url: dabsUrl, quote: name, evidence: "vintage in DABS name", status: "verified" });
    if (ni.proofs.length) add({ attribute: "abv", value: `${ni.proofs[0] / 2}% (${ni.proofs[0]} proof)`, source_type: "dabs", source_url: dabsUrl, quote: name, evidence: "proof in DABS name", status: "verified" });
    // Inference from the name (style level, never a claim about this exact bottle).
    if (kind === "wine") for (const g of GRAPES) if (new RegExp(`\\b${g.split(" ")[0]}`, "i").test(name) && (g.split(" ").length === 1 || new RegExp(g.split(" ")[1].slice(0, 4), "i").test(name)))
      add({ attribute: "grape_or_grain", value: g, source_type: "inference", source_url: null, quote: name, evidence: "grape word in DABS name (varietal wines are typically ≥75% that grape; blend unknown)" });

    // Source pages.
    const rev = review[csc] ?? {};
    for (const [pi, page] of (cands[csc] ?? []).entries()) {
      if (!page.facts && !page.ld_products) continue;
      const verdict = rev.pages?.[pi]; // "same-product" | "other-product" | "family" | undefined
      const st: SourceType = page.source_type === "producer" ? "producer" : "other";
      // Pattern matches are candidates only: a 40-fact spot check found 45% of them wrong (navigation text,
      // recipes, other products on the page). "verified" comes from DABS fields or a hand check (review "fact:").
      const status: Fact["status"] = "unverified";
      const url = page.final_url ?? page.url;
      const pf = page.facts ?? {};
      const note = verdict === "family" ? " (page covers the product family, not this exact listing)" : verdict === "other-product" ? " (page is about another product; kept for audit only)" : "";
      if (verdict === "other-product") continue;
      if (st === "producer" && verdict === "same-product" && page.http_status === 200 && !/one moment|just a moment/i.test(page.title ?? ""))
        add({ attribute: "producer", value: page.org, source_type: "producer", source_url: url, quote: page.title ?? null, evidence: "product page on the producer/brand's own site (brand owner in parentheses is the pilot's note)", status: "verified" });
      for (const q of pf.abv ?? []) {
        const m = q.match(/(\d{1,2}(?:\.\d{1,2})?)\s?%/);
        if (m) add({ attribute: "abv", value: `${m[1]}%`, source_type: st, source_url: url, quote: q, evidence: "stated on page" + note, status });
      }
      for (const q of pf.proof ?? []) {
        const m = q.match(/(\d{2,3}(?:\.\d)?)\s?(?:proof|°)/i);
        if (m && +m[1] >= 20 && +m[1] <= 160) add({ attribute: "abv", value: `${+m[1] / 2}% (${m[1]} proof)`, source_type: st, source_url: url, quote: q, evidence: "stated on page" + note, status });
      }
      for (const q of pf.region ?? []) add({ attribute: "region", value: q.slice(0, 120), source_type: st, source_url: url, quote: q, evidence: "stated on page" + note, status });
      for (const q of [...(pf.grape ?? []), ...(pf.grain ?? [])]) {
        const hit = [...GRAPES, ...GRAINS].filter((g) => q.toLowerCase().includes(g));
        if (hit.length) add({ attribute: "grape_or_grain", value: hit.join(", "), source_type: st, source_url: url, quote: q, evidence: "stated on page" + note, status });
      }
      for (const q of (pf.tasting ?? []).slice(0, 3)) add({ attribute: "tasting_notes", value: q, source_type: st, source_url: url, quote: q, evidence: "stated on page" + note, status });
      for (const q of pf.age ?? []) {
        const m = q.match(/(\d{1,2})\s?(?:-?\s?year|yr|years)/i);
        if (m) add({ attribute: "age", value: `${m[1]} years`, source_type: st, source_url: url, quote: q, evidence: "stated on page" + note, status });
      }
    }
    // Hand-checked facts from review (quote copied from the page during review).
    for (const f of rev.facts ?? []) add({ ...f, status: f.status ?? "verified" });
    // Explicit unknowns so gaps are counted, not hidden.
    for (const a of ATTRS) if (!facts.some((f) => f.csc === csc && f.attribute === a))
      add({ attribute: a, value: "unknown", source_type: "unknown", source_url: null, quote: null, evidence: "no source found in this pilot", status: "unknown" });
  }
  // Conflicts: verified numeric claims that disagree (ABV beyond rounding, different ages or vintages).
  const groups = new Map<string, Fact[]>();
  for (const f of facts) if (f.status === "verified" && ["abv", "age", "vintage"].includes(f.attribute)) groups.set(`${f.csc}|${f.attribute}`, [...(groups.get(`${f.csc}|${f.attribute}`) ?? []), f]);
  for (const list of groups.values()) {
    const nums = list.map((f) => parseFloat(f.value));
    if (Math.max(...nums) - Math.min(...nums) > (list[0].attribute === "abv" ? 0.3 : 0)) for (const f of list) f.status = "conflict";
  }
  writeFileSync(join(DIR, "data/facts.json"), JSON.stringify(facts, null, 1));
  const summary: Record<string, Record<string, number>> = {};
  for (const f of facts) {
    const k = f.attribute;
    summary[k] ??= {};
    const key = f.status === "unknown" ? "unknown" : `${f.source_type}:${f.status}`;
    summary[k][key] = (summary[k][key] ?? 0) + 1;
  }
  console.log(JSON.stringify(summary, null, 1));
}

if (require.main === module) main();
