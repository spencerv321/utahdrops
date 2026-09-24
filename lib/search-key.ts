/**
 * Search normalization shared by stored product names and typed queries.
 *
 * products.search_key is generated in Postgres by public.search_key(name)
 * (migration 20260926000001); searchKey() below is its exact TypeScript mirror,
 * checked against the database by scripts/search-check.ts. Change both together.
 *
 *   BLANTON'S GOLD      → "blanton gold"      (apostrophe dropped, alias)
 *   E.H. TAYLOR RYE     → "eh taylor rye"     (initials joined)
 *   BLANTON SNGL BRRL   → "blanton single barrel" (DABS abbreviations)
 *   WELLER 12YR         → "weller 12 yr"      (numbers split off words)
 *
 * Only explicit, unambiguous abbreviations and aliases are mapped. Nothing
 * strips a trailing "s" in general, and sizes, ages and vintages stay as
 * separate tokens, so distinct bottles never collapse into one.
 */
export const SEARCH_ALIASES: Record<string, string> = {
  // DABS abbreviations → the word people type
  sngl: "single",
  sgl: "single",
  brrl: "barrel",
  brl: "barrel",
  bbl: "barrel",
  brbn: "bourbon",
  bbn: "bourbon",
  whsky: "whiskey",
  whisky: "whiskey",
  yrs: "yr",
  year: "yr",
  years: "yr",
  rsv: "reserve",
  rsrv: "reserve",
  blnc: "blanc",
  sauv: "sauvignon",
  cab: "cabernet",
  chard: "chardonnay",
  slct: "select",
  blnd: "blend",
  dbl: "double",
  dble: "double",
  ltd: "limited",
  edtn: "edition",
  prf: "proof",
  teq: "tequila",
  spcl: "special",
  zin: "zinfandel",
  repo: "reposado",
  liq: "liqueur",
  orig: "original",
  btch: "batch",
  // Brand spellings: DABS lists the standard bottle as "BLANTON", people type "Blanton's"
  blantons: "blanton",
};

/** Normalized search text for a product name or a query. Mirror of SQL public.search_key(). */
export function searchKey(text: string | null | undefined): string {
  const s = (text ?? "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    // periods only survive inside numbers ("1.75"); "E.H." → "e h"
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .trim()
    // runs of single letters are initials: "e h taylor" → "eh taylor"
    .replace(/\b([a-z]) (?=[a-z]\b)/g, "$1");
  if (!s) return "";
  return s
    .split(" ")
    .map((w) => SEARCH_ALIASES[w] ?? w)
    .join(" ");
}

export interface QueryToken {
  /** Any of these (as a substring of search_key) satisfies the token. */
  alts: string[];
  /** The typed word, normalized, for matching DABS category names. */
  raw: string;
}

/**
 * Tokens for a typed query. A possessive the visitor typed ("Weller's") also
 * matches the bare word, since DABS writes some brands without the "'s".
 */
export function queryTokens(q: string | undefined, max = 8): QueryToken[] {
  const text = (q ?? "").slice(0, 200);
  const stems = new Set(
    [...text.toLowerCase().matchAll(/([a-z0-9]+)['’]s\b/g)].map((m) => searchKey(m[1]))
  );
  const words = searchKey(text).split(" ").filter(Boolean);
  const tokens: QueryToken[] = [];
  for (let i = 0; i < words.length && tokens.length < max; i++) {
    const w = words[i];
    // "12 year old" → "12 yr": DABS never spells out "old" after an age.
    if (w === "old" && words[i - 1] === "yr") continue;
    const alts = [w];
    if (w.endsWith("s") && stems.has(w.slice(0, -1))) alts.push(w.slice(0, -1));
    const raw = w;
    if (!tokens.some((t) => t.raw === raw)) tokens.push({ alts, raw });
  }
  return tokens;
}

/** Postgres ARE fragment matching any alternative of a token (tokens are [a-z0-9. ]). */
export function tokenPattern(t: QueryToken): string {
  return `(?:${t.alts.map((a) => a.replace(/\./g, "\\.")).join("|")})`;
}
