/**
 * Matches an allocated-drop store address (typed by DABS on the drop list,
 * e.g. "865 W. Antelope Dr, Syracuse 84075") to a store in our table (from
 * DABS's product pages, e.g. "865 W ANTELOPE DR"). The two lists spell the
 * same place differently: "Road" vs "RD", "West" vs "W", "4TH N" vs "400 N",
 * a missing suffix ("1160 Patterson") or periods.
 *
 * 1. Same normalized street address, or the same with the street suffix dropped.
 * 2. Otherwise the only store on that street (name without house number) in
 *    that city, e.g. "280 W Harris Ave, SLC" → #41 at 300 W Harris Ave.
 * No match is better than a wrong one: anything ambiguous stays unmatched.
 */
export interface StoreAddress {
  id: number;
  address: string | null;
  city: string | null;
}

const WORDS: Record<string, string> = {
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  ROAD: "RD", AVENUE: "AVE", AV: "AVE", STREET: "ST", DRIVE: "DR", LANE: "LN", BOULEVARD: "BLVD",
  CENTER: "CTR", CANYON: "CYN", PARKWAY: "PKWY", CIRCLE: "CIR", COURT: "CT", HIGHWAY: "HWY",
};
const SUFFIXES = new Set(["RD", "AVE", "ST", "DR", "LN", "BLVD", "CTR", "PKWY", "CIR", "CT", "WAY", "HWY"]);
const CITY_ALIASES: Record<string, string> = { SLC: "SALT LAKE CITY", "ST GEORGE": "SAINT GEORGE" };

/** Street address tokens: upper case, no punctuation or suite, standard abbreviations, "4TH N" → "400 N". */
export function streetTokens(address: string): string[] {
  const s = address
    .toUpperCase()
    .replace(/\s+-\s+.*$/, "") // " - STE 1", " - #103"
    .replace(/,?\s*\b(SUITE|STE|UNIT|PO BOX)\b.*$/, "")
    .replace(/[.,#]/g, " ");
  const tokens = s.split(/\s+/).filter(Boolean).map((t) => WORDS[t] ?? t);
  // Utah grid: "4TH NORTH" is 400 N. Only before a direction, so "12TH ST" stays.
  return tokens.map((t, i) => {
    const m = t.match(/^(\d+)(ST|ND|RD|TH)$/);
    return m && /^[NSEW]$/.test(tokens[i + 1] ?? "") ? String(Number(m[1]) * 100) : t;
  });
}

const withoutSuffix = (t: string[]) => (t.length > 2 && SUFFIXES.has(t[t.length - 1]) ? t.slice(0, -1) : t);

export function normalizeCity(city: string | null | undefined): string {
  const c = (city ?? "").toUpperCase().replace(/[.,]/g, " ").replace(/\b\d{5}\b/g, "").replace(/\s+/g, " ").trim();
  return CITY_ALIASES[c] ?? c;
}

/** "865 W. Antelope Dr, Syracuse 84075" → street "865 W. Antelope Dr", city "Syracuse". */
export function splitDropAddress(text: string): { street: string; city: string } {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts.slice(1).map((p) => normalizeCity(p)).find(Boolean) ?? "";
  return { street: parts[0] ?? "", city };
}

export function matchDropStore(text: string, stores: StoreAddress[]): number | null {
  const { street, city } = splitDropAddress(text);
  if (!street) return null;
  const want = streetTokens(street);
  const key = (t: string[]) => t.join(" ");
  const usable = stores.filter((s) => s.address);

  for (const form of [(t: string[]) => t, withoutSuffix]) {
    const hits = usable.filter((s) => key(form(streetTokens(s.address!))) === key(form(want)));
    if (hits.length === 1) return hits[0].id;
    if (hits.length > 1) {
      const inCity = hits.filter((s) => normalizeCity(s.city) === city);
      return inCity.length === 1 ? inCity[0].id : null;
    }
  }

  // Same street name (no house number), same city, one store only.
  if (!city || !/^\d+$/.test(want[0] ?? "")) return null;
  const name = key(withoutSuffix(want).slice(1));
  const sameStreet = usable.filter((s) => {
    const t = streetTokens(s.address!);
    return /^\d+$/.test(t[0] ?? "") && key(withoutSuffix(t).slice(1)) === name && normalizeCity(s.city) === city;
  });
  return sameStreet.length === 1 ? sameStreet[0].id : null;
}
