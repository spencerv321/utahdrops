/**
 * Photo/enrichment pilot: combine the DABS listing, each candidate's source
 * page, the measured image and the human review into one classification per
 * candidate and per product.
 *
 *   npx tsx pilot/photo-enrichment/classify.ts
 *
 * Inputs: data/{sample,dabs,candidates,images,review}.json
 * Output: data/results.json (staging only; nothing reads it outside pilot/)
 *
 * review.json is written by the person looking at the pictures:
 *   { "<csc>": {
 *       "pages":  { "<page index>": "same-product" | "family" | "other-product" },
 *       "images": { "<sha256>": { "visual": "matches" | "family-only" | "wrong", "usable": true, "notes": "…" } },
 *       "notes": "…", "caught": "plausible wrong bottle that was rejected, and why" } }
 * An image with no review entry is "not-inspected" and can't be better than possible.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classify, compareIdentity, imageCollisions, nameWords, parseIdentity, productKind, type Classification } from "./identity";

const DIR = __dirname;
const read = (f: string) => JSON.parse(readFileSync(join(DIR, "data", f), "utf8"));
interface Result {
  csc: string; dabs_name: string; size_ml: number | null; kind: string;
  classification: Classification | "none"; chosen: string | null; notes: string | null;
  candidates: { sha256: string; dup_group?: string; classification: Classification }[];
  [k: string]: unknown;
}
const RANK: Record<Classification, number> = { exact: 3, representative: 2, possible: 1, reject: 0 };
const PERMISSION_WORDS = /(may|are free to|free to|permission to)\s+(be\s+)?(use|used|download|reproduce)|for (editorial|press|media) use|press (kit|images)|media (kit|library|assets)|brand assets|trade (tools|resources)/i;

function main() {
  const sample = read("sample.json").products as { csc: string; group: string; kind: string; reason: string }[];
  const dabs = read("dabs.json");
  const cands = read("candidates.json");
  const images = read("images.json");
  const review = read("review.json");
  const results: Result[] = [];
  for (const s of sample) {
    const d = dabs[s.csc];
    const allSaleNames: string[] = [...new Set<string>((d.sale_names ?? []).map((n: string) => n.replace(/\s*\d+(\.\d+)?\s*(ml|l|m)?$/i, "").trim()))];
    // A rename that only adds or drops a category word ("MALIBU PINK" → "MALIBU RUM PINK") is the same item;
    // different vintages, flavors or expressions on one code are reuse.
    const itemKey = (n: string) => nameWords(n).filter((w) => !["rum", "vodka", "whiskey", "bourbon", "tequila", "gin", "wine", "liqueur"].includes(w)).sort().join(" ");
    const saleNames = [...new Map(allSaleNames.map((n) => [itemKey(n), n])).values()];
    // DABS truncates names at ~40 chars; take the size from the sales report when the catalog lost it.
    const sizeMl: number | null = d.size_ml ?? parseIdentity((d.sale_names ?? []).join(" ")).sizesMl[0] ?? null;
    const listing = { csc: s.csc, name: d.name, sizeMl, kind: productKind(d.category, d.name), saleNames: saleNames.length > 1 ? saleNames : undefined };
    const rev = review[s.csc] ?? {};
    const out = [];
    const seen = new Set<string>();
    for (const [pi, page] of (cands[s.csc] ?? []).entries()) {
      const pageVerdict: string | undefined = rev.pages?.[pi];
      const rawName: string = page.ld_products?.[0]?.name || page.h1 || page.og_title || page.title || "";
      // Producer sites title products without the brand ("Sauvignon Blanc" on kimcrawfordwines.com): the site is the brand.
      const sourceName = page.source_type === "producer" && !rawName.toLowerCase().includes(String(page.org).toLowerCase().split(/[\s(]/)[0]) ? `${page.org} ${rawName}` : rawName;
      const urlWords = decodeURIComponent(new URL(page.final_url ?? page.url).pathname).replace(/[-_/]+/g, " ");
      const idText = [page.title, page.h1, page.og_title, ...(page.ld_products ?? []).map((p: { name?: string; size?: string }) => `${p.name ?? ""} ${p.size ?? ""}`), urlWords].filter(Boolean).join(" | ");
      const singleSizePage = parseIdentity(idText).sizesMl.length === 1;
      const rightsText: string[] = page.facts?.rights ?? [];
      const permission = rightsText.some((t) => PERMISSION_WORDS.test(t)) ? "stated (see quote)" : "unknown: no permission stated";
      for (const im of page.images ?? []) {
        if (!im.sha256 || seen.has(im.sha256)) continue;
        seen.add(im.sha256);
        const meas = images[im.sha256] ?? {};
        const r = rev.images?.[im.sha256];
        const cmp = compareIdentity(listing, sourceName, idText, singleSizePage);
        const bigEnough = (meas.width ?? 0) >= 150 && (meas.height ?? 0) >= 150 && Math.max(meas.width ?? 0, meas.height ?? 0) >= 400; // card-size rule: long side ≥ 400 px, short side ≥ 150 px
        const j = classify({
          comparison: cmp,
          visual: r?.visual ?? "not-inspected",
          brandConfirmed: pageVerdict === "same-product" || pageVerdict === "family",
          expressionConfirmed: pageVerdict === "same-product",
          // Size evidence: a single-size page naming DABS's size, or the volume read on the label itself during review.
          sizeConfirmed: (cmp.confirmed.some((c) => c.startsWith("size")) || r?.size_on_label === true) && r?.visual === "matches",
          imageUsable: bigEnough && (r?.usable ?? true) && !meas.error,
          kind: listing.kind,
          reusedCode: saleNames.length > 1,
          nonVintage: !!rev.nv,
        });
        // Counterfactual for the report: what the text rules alone would say if nobody looked at the picture
        // (visual assumed to match, page verdict unknown so brand/expression come from the words only).
        const textOnly = classify({
          comparison: cmp, visual: "matches", brandConfirmed: true,
          expressionConfirmed: !cmp.unconfirmed.some((u) => u.startsWith("DABS words")),
          sizeConfirmed: cmp.confirmed.some((c) => c.startsWith("size")), imageUsable: bigEnough,
          kind: listing.kind, reusedCode: saleNames.length > 1,
        }).cls;
        // A page about another product rejects whatever the words say.
        const cls: Classification = pageVerdict === "other-product" ? "reject" : j.cls;
        const why = pageVerdict === "other-product" ? ["source page is about another product", ...j.why] : j.why;
        out.push({
          sha256: im.sha256, image_url: im.url, via: im.via, alt: im.alt,
          source_page: page.final_url ?? page.url, source_org: page.org, source_type: page.source_type,
          found_by: page.found_by, retrieved_at: page.retrieved_at,
          width: meas.width, height: meas.height, format: meas.format, bytes: meas.bytes, phash: meas.phash, dup_group: meas.dup_group,
          source_name: sourceName, source_identity_text: idText.slice(0, 400), single_size_page: singleSizePage,
          gtins: page.ld_products?.[0]?.gtins ?? [], stated: { sizes: parseIdentity(idText).sizesMl, proofs: parseIdentity(idText).proofs, vintages: parseIdentity(sourceName).vintages },
          permission, rights_quotes: rightsText.slice(0, 3), terms_links: page.terms_links ?? [],
          page_verdict: pageVerdict ?? "not reviewed", visual: r?.visual ?? "not-inspected", review_notes: r?.notes ?? null, size_on_label: !!r?.size_on_label,
          comparison: cmp, classification: cls, why, text_only: textOnly,
        });
      }
    }
    out.sort((a, b) => RANK[b.classification] - RANK[a.classification] || (a.source_type === "producer" ? -1 : 0) - (b.source_type === "producer" ? -1 : 0) || (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
    const best = out[0];
    const cls: Classification | "none" = best && best.classification !== "reject" ? best.classification : "none";
    results.push({
      csc: s.csc, dabs_name: d.name, category: d.category, kind: listing.kind, size_ml: sizeMl, group: s.group, selection_reason: s.reason,
      sale_names: allSaleNames, reused_code: saleNames.length > 1, dabs_description: d.description,
      pages: (cands[s.csc] ?? []).map((p: Record<string, unknown>, i: number) => ({ url: p.url, org: p.org, source_type: p.source_type, found_by: p.found_by, http_status: p.http_status, note: p.note, verdict: rev.pages?.[i] ?? "not reviewed", title: p.title })),
      classification: cls, chosen: cls === "none" ? null : best.sha256, candidates: out,
      notes: rev.notes ?? null, caught: rev.caught ?? null, non_vintage_evidence: rev.nv ?? null,
    });
  }
  // Same picture accepted for two different listings → both drop to possible.
  const accepted = results.filter((r) => r.classification === "exact" || r.classification === "representative")
    .map((r) => ({ csc: r.csc, name: r.dabs_name, sizeMl: r.size_ml, hash: r.candidates.find((c) => c.sha256 === r.chosen)!.dup_group ?? r.chosen! }));
  const collisions = imageCollisions(accepted);
  for (const c of collisions) for (const csc of c.cscs) {
    const r = results.find((x) => x.csc === csc)!;
    r.classification = "possible";
    r.notes = `${r.notes ? r.notes + " " : ""}Image collision with ${c.cscs.find((x) => x !== csc)} (${c.why}).`;
  }
  writeFileSync(join(DIR, "data/results.json"), JSON.stringify({ generated_at: new Date().toISOString(), collisions, products: results }, null, 1));
  const count = (f: (r: (typeof results)[number]) => string) => results.reduce<Record<string, number>>((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {});
  console.log("overall", count((r) => r.classification));
  console.log("by kind", count((r) => `${r.kind}:${r.classification}`));
  console.log("collisions", collisions);
}

if (require.main === module) main();
