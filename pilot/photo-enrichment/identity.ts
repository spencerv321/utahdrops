/**
 * Photo/enrichment pilot: identity rules. Pure functions; tests in
 * tests/photo-pilot-identity.test.ts.
 *
 * The questions are kept apart on purpose (brand/product, expression, size and
 * package, proof/vintage, image quality, permission), and a hard conflict on
 * any of them rejects a candidate whatever else looks right. Nothing here
 * turns "the right product family" into "this exact listing".
 */
import { groupOf } from "../../lib/categories";
import { searchKey } from "../../lib/search-key";

export type Kind = "spirits" | "wine" | "beer" | "other";

/** Spirits / wine / beer / other (cider, malt drinks, premixed, sake). */
export function productKind(category: string | null | undefined, name = ""): Kind {
  const c = (category ?? "").toUpperCase();
  const slug = groupOf(c)?.slug;
  if (/SAKE/.test(c)) return "other";
  if (["red-wine", "white-wine", "rose", "sparkling", "fortified", "other-wine"].includes(slug ?? "")) return "wine";
  if (slug === "beer") return "beer";
  if (["cider", "premixed"].includes(slug ?? "")) return "other";
  if (/WINE/.test(c)) return "wine";
  if (/BEER/.test(c)) return "beer";
  if (/SPIRIT|LIQUEUR/.test(c)) return "spirits";
  if (["whiskey", "vodka", "tequila", "rum", "gin", "brandy", "liqueurs"].includes(slug ?? "")) return "spirits";
  if (/\bCANS?\b|\bIPA\b|\bALE\b|LAGER/.test(name.toUpperCase())) return "beer";
  return "other";
}

export interface Identity {
  sizesMl: number[];
  ages: number[];
  proofs: number[];
  vintages: number[];
  container: "can" | "bottle" | null;
  packCount: number | null;
  giftSet: boolean;
  gtins: string[];
}

const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Two-digit DABS vintages ('19) → 2019; four digits kept when plausible. */
function vintages(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/'\s?(\d{2})(?:\/(\d{2}))?\b/g)) {
    out.push(2000 + +m[1]);
    if (m[2]) out.push(2000 + +m[2]);
  }
  for (const m of text.matchAll(/(?<![\d.$])((?:19[5-9]|20[0-3])\d)(?![\d.%])/g)) {
    const y = +m[1];
    // "Est. 1870", "since 1795", "founded in" are dates, not vintages.
    const before = text.slice(Math.max(0, (m.index ?? 0) - 18), m.index).toLowerCase();
    if (/(est\.?|established|since|founded|founded in|in|©|copyright)\s*$/.test(before)) continue;
    if (y <= new Date().getFullYear()) out.push(y);
  }
  return uniq(out);
}

/** Sizes stated in text, in ml (750ml, 75cl, 1.75L, 1.75 liter, 12 oz, 50 ml). */
export function sizesIn(text: string): number[] {
  const out: number[] = [];
  const t = text.toLowerCase();
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s?(ml|mls|milliliters?|millilitres?|m)\b/g)) out.push(Math.round(+m[1]));
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s?cl\b/g)) out.push(Math.round(+m[1] * 10));
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s?(l|lt|ltr|liters?|litres?)\b/g)) out.push(Math.round(+m[1] * 1000));
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s?(?:fl\.?\s?)?oz\b/g)) out.push(ozToMl(+m[1]));
  return uniq(out.filter((x) => x >= 30 && x <= 20000));
}
const ozToMl = (oz: number) => {
  const std: Record<number, number> = { 12: 355, 16: 473, 19.2: 568, 25.4: 750, 8.4: 250, 11.2: 330, 22: 650, 25: 750, 6.8: 200, 1.7: 50, 12.7: 375, 16.9: 500 };
  return std[oz] ?? Math.round(oz * 29.5735);
};

/** Same bottle size, allowing the usual label roundings (750 = 75cl = 25.4 oz; 700 vs 750 is a conflict). */
export function sameSize(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(3, a * 0.012);
}

export function parseIdentity(text: string, sizeMl?: number | null): Identity {
  const up = text.toUpperCase();
  const ages = uniq([...up.matchAll(/\b(\d{1,2})\s?-?\s?(?:YR|YRS|YEARS?|YO|Y\.O\.|AÑOS|ANOS)\b/g)].map((m) => +m[1]).filter((n) => n >= 2 && n <= 60));
  const proofs = uniq([
    ...[...up.matchAll(/\b(\d{2,3}(?:\.\d)?)\s?(?:PF|PROOF|°\s?PROOF)\b/g)].map((m) => +m[1]),
    ...[...up.matchAll(/\b(\d{1,2}(?:\.\d{1,2})?)\s?%\s?(?:ABV|ALC|ALCOHOL|VOL)?/g)].map((m) => Math.round(+m[1] * 20) / 10),
  ].filter((p) => p >= 1 && p <= 200));
  const container = /\bCANS?\b|\bCANNED\b/.test(up) ? "can" : /\bBTLS?\b|\bBOTTLES?\b|\bBOTTLED\b(?! IN BOND)/.test(up) ? "bottle" : null;
  const pack = up.match(/\b(\d{1,2})\s?-?\s?(?:PK|PACK)\b/);
  const gtins = uniq([...text.matchAll(/(?:gtin\d{0,2}|upc|ean|barcode)["':\s]*([0-9]{8,14})/gi)].map((m) => m[1]));
  const sizes = sizesIn(text);
  return {
    sizesMl: uniq([...(sizeMl ? [sizeMl] : []), ...sizes]),
    ages, proofs, vintages: vintages(text), container,
    packCount: pack ? +pack[1] : null,
    giftSet: /\bW\/|\bVAP\b|GIFT|GLASSES|\bSHOT GLASS|\bSET\b/.test(up),
    gtins,
  };
}

/** Words in a name that name an expression; a candidate that adds one DABS lacks is another bottle. */
export const EXPRESSION_WORDS = [
  "barrel proof", "cask strength", "full proof", "single barrel", "small batch", "bottled in bond", "bonded",
  "reserve", "private", "limited", "edition", "special", "select", "double oaked", "toasted", "rye", "wheated",
  "high rye", "port", "sherry", "finished", "anejo", "reposado", "blanco", "plata", "silver",
  "gold", "extra", "xo", "vsop", "vs", "black", "white", "red", "honey", "apple", "fire", "peach", "vanilla",
  "cinnamon", "light", "zero", "hazy", "imperial", "double", "triple", "sour", "nitro", "rose", "brut", "sweet",
  "dry", "organic", "decaf", "blend", "blended", "straight", "bourbon", "whiskey", "vodka", "gin", "rum",
];

/**
 * DABS abbreviations the search aliases don't cover, and explicit name
 * aliases (one bottle, two names). Explicit only, like lib/search-key.ts.
 */
export const IDENTITY_ALIASES: Record<string, string> = {
  str: "straight", prv: "private", chat: "chateau", dipa: "double ipa", pn: "pinot noir", rr: "russian river",
  w: "with", cr: "cream", whsky: "whiskey", tenn: "tennessee", bib: "bottled in bond", ca: "california",
};
export const NAME_ALIASES: [RegExp, string][] = [
  [/\bjack daniels black label\b/, "jack daniels old no 7"],
];
/** Package and filler words checked elsewhere (container, size), not as name words. */
/** Category words a producer page often leaves out of a product title ("Blanton's Original Single Barrel"). */
const GENERIC_WORDS = new Set(["bourbon", "whiskey", "vodka", "tequila", "gin", "rum", "liqueur", "beer", "brandy"]);
const PACKAGE_WORDS = new Set(["can", "cans", "btl", "bottle", "bottles", "pet", "pk", "pack", "vap", "wine", "ml"]);

/** Accents off, then the shared search normalizer ("PATRÓN" → "patron", "Château" → "chateau"). */
export const norm = (t: string) => searchKey(t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

/** The DABS name as comparable words (size removed, abbreviations expanded). */
export function nameWords(name: string): string[] {
  const noSize = name.replace(/\s*\d+(\.\d+)?\s*(ml|l|m)\s*$/i, "");
  let k = norm(noSize).split(" ").map((w) => IDENTITY_ALIASES[w] ?? w).join(" ");
  for (const [re, to] of NAME_ALIASES) k = k.replace(re, to);
  return k.split(" ").filter(Boolean);
}

/** DABS cuts names at ~40 characters ("BRRL PR750ml"): the last word may be a prefix. */
export function looksTruncated(name: string): boolean {
  const noSize = name.replace(/\s*\d+(\.\d+)?\s*(ml|l|m)?\s*$/i, "");
  return noSize.length >= 34 || /[A-Z]\d+(ml|m)?$/i.test(name.trim());
}

export interface Comparison {
  conflicts: string[]; // hard: any one rejects
  confirmed: string[];
  unconfirmed: string[];
}

export interface DabsListing {
  csc: string;
  name: string;
  sizeMl: number | null;
  kind: Kind;
  /** Distinct names this code was sold under (monthly sales); >1 = reused code. */
  saleNames?: string[];
}

/**
 * Compare a DABS listing with what a source says about the item it shows.
 * `sourceName` is the product title on the source; `sourceText` is the
 * title plus nearby facts (size, ABV, vintage lines). `singleSizePage` is
 * true only when the page sells or describes exactly one size.
 */
export function compareIdentity(d: DabsListing, sourceName: string, sourceText: string, singleSizePage: boolean): Comparison {
  const conflicts: string[] = [], confirmed: string[] = [], unconfirmed: string[] = [];
  const di = parseIdentity(d.name, d.sizeMl);
  const si = parseIdentity(`${sourceName} ${sourceText}`);
  const sn = parseIdentity(sourceName);

  // Size and package.
  if (d.sizeMl) {
    const stated = si.sizesMl;
    if (!stated.length) unconfirmed.push("size not stated on source");
    else if (stated.some((s) => sameSize(s, d.sizeMl!))) {
      if (singleSizePage) confirmed.push(`size ${d.sizeMl} ml`);
      else unconfirmed.push(`source lists several sizes (${stated.join(", ")} ml); image size unknown`);
    } else if (singleSizePage) conflicts.push(`size: DABS ${d.sizeMl} ml, source ${stated.join("/")} ml`);
    else unconfirmed.push(`source sizes ${stated.join(", ")} ml don't include ${d.sizeMl} ml`);
  } else unconfirmed.push("DABS size missing");
  if (di.container && si.container && di.container !== si.container) conflicts.push(`package: DABS ${di.container}, source ${si.container}`);
  if (di.packCount && si.packCount && di.packCount !== si.packCount) conflicts.push(`pack: DABS ${di.packCount}-pack, source ${si.packCount}-pack`);
  if (di.giftSet && !si.giftSet) unconfirmed.push("DABS lists a gift set / value-add pack; source shows no set");
  if (!di.giftSet && sn.giftSet) conflicts.push("source is a gift set; DABS is the bottle alone");

  // Age statements.
  if (di.ages.length && sn.ages.length && !sn.ages.some((a) => di.ages.includes(a))) conflicts.push(`age: DABS ${di.ages.join("/")} yr, source ${sn.ages.join("/")} yr`);
  else if (!di.ages.length && sn.ages.length) conflicts.push(`age: source is a ${sn.ages.join("/")}-year expression; DABS name has no age`);
  else if (di.ages.length && !sn.ages.length) unconfirmed.push(`age ${di.ages.join("/")} yr not on source name`);
  else if (di.ages.length) confirmed.push(`age ${di.ages.join("/")} yr`);

  // Proof / ABV.
  if (di.proofs.length && si.proofs.length) {
    if (si.proofs.some((p) => di.proofs.some((q) => Math.abs(p - q) <= 0.6))) confirmed.push(`proof ${di.proofs.join("/")}`);
    else conflicts.push(`proof: DABS ${di.proofs.join("/")}, source ${si.proofs.join("/")}`);
  }

  // Vintage.
  const dv = uniq([...di.vintages, ...(d.saleNames ?? []).flatMap((n) => parseIdentity(n).vintages)]);
  if (di.vintages.length && sn.vintages.length) {
    if (sn.vintages.some((v) => di.vintages.includes(v))) confirmed.push(`vintage ${sn.vintages.filter((v) => di.vintages.includes(v)).join("/")}`);
    else conflicts.push(`vintage: DABS ${di.vintages.join("/")}, source ${sn.vintages.join("/")}`);
  } else if (d.kind === "wine" && sn.vintages.length && !di.vintages.length) {
    unconfirmed.push(`source shows vintage ${sn.vintages.join("/")}; DABS listing names no vintage${dv.length ? ` (code sold as ${dv.join("/")})` : ""}`);
  } else if (d.kind === "wine") unconfirmed.push("vintage not confirmed");

  // Reused code.
  if ((d.saleNames?.length ?? 0) > 1) unconfirmed.push(`DABS code reused for ${d.saleNames!.length} names: ${d.saleNames!.join(" | ")}`);

  // Expression words: present on one side only.
  const words = nameWords(d.name);
  const dw = ` ${words.join(" ")} `;
  const sw = ` ${norm(sourceName)} `;
  // Name words may appear anywhere in the page's identity text (title, heading, structured data).
  const sa = ` ${norm(`${sourceName} ${sourceText}`)} `;
  const generic = ["bourbon", "whiskey", "vodka", "gin", "rum", "straight", "blend", "blended", ...(d.kind === "wine" ? ["red", "white", "rose", "sweet", "dry"] : [])];
  for (const w of EXPRESSION_WORDS) {
    const k = ` ${norm(w)} `;
    const lastPrefix = looksTruncated(d.name) && words.length > 0 && norm(w).split(" ").some((x) => x.startsWith(words[words.length - 1]) && words[words.length - 1].length >= 2);
    if (sw.includes(k) && !dw.includes(k) && !generic.includes(w) && !lastPrefix) conflicts.push(`expression: source says "${w}", DABS name doesn't`);
  }
  const truncated = looksTruncated(d.name);
  const missing = words.filter((w, i) => {
    if (w.length < 2 || /^\d+$/.test(w) || w === "yr" || PACKAGE_WORDS.has(w) || GENERIC_WORDS.has(w)) return false;
    if (sa.includes(` ${w} `) || sa.includes(` ${w}s `)) return false;
    if (truncated && i === words.length - 1 && new RegExp(` ${w}[a-z]*`).test(sa)) return false;
    return true;
  });
  if (missing.length) unconfirmed.push(`DABS words not in source name: ${missing.join(", ")}`);
  else confirmed.push("all DABS name words on source");
  return { conflicts, confirmed, unconfirmed };
}

export type Classification = "exact" | "representative" | "possible" | "reject";

export interface Judgement {
  /** From compareIdentity on the source that carries the image. */
  comparison: Comparison;
  /** A human looked at the pixels (not the page text) and it shows this item. */
  visual: "matches" | "family-only" | "wrong" | "not-inspected";
  /** Label/packaging features checked in the image (e.g. age statement, "Barrel Proof", can). */
  visualNotes?: string;
  brandConfirmed: boolean;
  expressionConfirmed: boolean;
  sizeConfirmed: boolean;
  /** Long side ≥ 400 px and short side ≥ 150 px, not blurred, no watermark or badge overlay, not a lifestyle shot or composite. */
  imageUsable: boolean;
  kind: Kind;
  reusedCode: boolean;
  /** Wine confirmed non-vintage (label shows none and a source says NV / box wine), so there is no vintage to match. */
  nonVintage?: boolean;
}

/**
 * Exact needs every question answered yes with no conflict and a visual
 * check. A score never overrides this: conflicts reject, missing evidence
 * caps at possible, wine without a confirmed vintage caps at representative.
 */
export function classify(judgement: Judgement): { cls: Classification; why: string[] } {
  let j = judgement;
  const why: string[] = [];
  const onlyVintage = j.comparison.conflicts.length > 0 && j.comparison.conflicts.every((c) => c.startsWith("vintage:"));
  // Wine only: another vintage's label can stand in as a clearly labeled representative, never as exact.
  if (onlyVintage && j.kind === "wine" && j.brandConfirmed && j.expressionConfirmed && j.imageUsable && j.visual !== "wrong" && j.visual !== "not-inspected")
    return { cls: "representative", why: ["wine: label of another vintage", ...j.comparison.conflicts] };
  if (j.comparison.conflicts.length) return { cls: "reject", why: j.comparison.conflicts };
  if (j.visual === "wrong") return { cls: "reject", why: ["image shows a different item"] };
  if (!j.brandConfirmed) return { cls: "reject", why: ["brand/product not confirmed"] };
  if (!j.imageUsable) return { cls: "reject", why: ["image not usable at card size"] };
  if (j.visual === "not-inspected") return { cls: "possible", why: ["image not visually inspected"] };
  // A reviewer can't wave away DABS name words the source doesn't carry ("single barrel", "barrel proof").
  const missing = j.comparison.unconfirmed.find((u) => u.startsWith("DABS words not in source name"));
  if (missing) j = { ...j, expressionConfirmed: false };
  if (!j.expressionConfirmed) why.push(missing ?? "expression not confirmed");
  const vintageOk = j.kind !== "wine" || j.nonVintage || j.comparison.confirmed.some((c) => c.startsWith("vintage"));
  if (j.kind === "wine" && !vintageOk && j.expressionConfirmed && j.visual !== "wrong") {
    return { cls: "representative", why: ["wine: label family confirmed, vintage not confirmed", ...(j.sizeConfirmed ? [] : ["size not confirmed"])] };
  }
  if (j.reusedCode) why.push("DABS code reused for several items");
  if (!j.sizeConfirmed) why.push("size not confirmed");
  if (j.visual === "family-only") why.push("image shows the product family, not the exact label");
  if (why.length) return { cls: "possible", why };
  return { cls: "exact", why: ["brand, expression, size confirmed; no conflicts; image inspected"] };
}

/**
 * One picture accepted for two listings that differ in size or name is a
 * collision: at most one of them can be right (e.g. the 750 ml photo on the
 * 1.75 L code). Returns every such pair so both are sent back to review.
 * `hash` is the file hash, or a perceptual-hash bucket for near-duplicates.
 */
export function imageCollisions(accepted: { csc: string; name: string; sizeMl: number | null; hash: string }[]) {
  const byHash = new Map<string, typeof accepted>();
  for (const a of accepted) byHash.set(a.hash, [...(byHash.get(a.hash) ?? []), a]);
  const out: { hash: string; cscs: [string, string]; why: string }[] = [];
  for (const [hash, list] of byHash) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        if (a.csc === b.csc) continue;
        const why = a.sizeMl !== b.sizeMl ? `sizes ${a.sizeMl} vs ${b.sizeMl} ml` : nameWords(a.name).join(" ") !== nameWords(b.name).join(" ") ? "different names" : "same name and size on two codes";
        out.push({ hash, cscs: [a.csc, b.csc], why });
      }
  }
  return out;
}
