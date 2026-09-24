export function formatPrice(price: string | number | null | undefined): string {
  if (price == null || price === "") return "—";
  const n = typeof price === "string" ? parseFloat(price) : price;
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function formatQty(qty: number | null | undefined): string {
  if (qty == null) return "—";
  return qty.toLocaleString("en-US");
}

export function formatSize(sizeMl: number | null | undefined): string {
  if (!sizeMl) return "";
  if (sizeMl >= 1000) return `${(sizeMl / 1000).toFixed(sizeMl % 1000 === 0 ? 0 : 2)}L`;
  return `${sizeMl}ml`;
}

export function formatAsOf(date: Date | string | null | undefined): string {
  if (!date) return "no data yet";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 90) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Title-case DABS ALL-CAPS product names for display. */
export function displayName(name: string): string {
  return name
    .toLowerCase()
    // Capitalize word starts, but not after an apostrophe ("Maker's", not "Maker'S")
    .replace(/(^|[^a-z0-9'’])([a-z])/g, (_, pre, c) => pre + c.toUpperCase())
    // …except name prefixes like D'Usse, O'Neil
    .replace(/(^|[^A-Za-z])([DO])(['’])([a-z])/g, (_, pre, l, q, c) => pre + l + q + c.toUpperCase())
    .replace(/\b(\d+)\s?Ml\b/gi, "$1ml")
    .replace(/\b(\d+(?:\.\d+)?)\s?l\b/gi, "$1L")
    .replace(/\b(Ipa|Dipa|Rtd|Esb|Nv)\b/g, (w) => w.toUpperCase())
    .replace(/\bDble\b/g, "Double")
    .replace(/\bVsop\b/g, "VSOP")
    .replace(/\bXo\b/g, "XO");
}

/**
 * DABS store names look like "STATE STORE # 12" with the city in its own
 * column (older rows: "STORE 41 BOUNTIFUL"). People know stores by place, so
 * lead with that and keep the number as a hint.
 */
export function storeLabel(name: string, city?: string | null): { title: string; number: string | null } {
  const m = name.match(/^(?:STATE\s+)?STORE\s*#?\s*(\d+)\s*[-–—]?\s*(.*)$/i);
  const place = (m ? m[2] : name).trim() || city || "";
  return {
    title: place ? displayName(place) : `Store ${m?.[1] ?? ""}`.trim(),
    number: m ? m[1] : null,
  };
}

/**
 * Consumer-facing bottle name. DABS appends the size ("… 750ml", sometimes cut
 * off at 40 characters as "… 750m" or "… 75"); when we have the size as data,
 * drop that suffix and show the size separately. Nothing else is rewritten:
 * abbreviations and truncations stay as DABS wrote them.
 */
export function productTitle(name: string | null, sizeMl?: number | null): string {
  let n = (name ?? "").trim();
  if (sizeMl) {
    const size = String(sizeMl >= 1000 && sizeMl % 1000 === 0 ? sizeMl / 1000 : sizeMl);
    const units = "(?:ml|m|l|ltr|liter)?";
    // full or truncated size at the end, e.g. "750ml", "750 ml", "1.75L", "750m", "75"
    const full = new RegExp(`\\s*\\b(?:${sizeMl}|${size}|${(sizeMl / 1000).toString()})\\s?${units}\\.?$`, "i");
    const partial = new RegExp(`\\s+(\\d{1,4})\\s?(?:ml|m)?$`, "i");
    if (full.test(n)) n = n.replace(full, "");
    else {
      const m = n.match(partial);
      if (m && String(sizeMl).startsWith(m[1]) && n.length >= 38) n = n.replace(partial, "");
    }
  }
  return displayName(n).replace(/\s{2,}/g, " ").trim();
}

// DABS groups that read better in plain words for newcomers.
const GROUP_NAMES: Record<string, string> = {
  "RED VARIETAL": "Red wine",
  "RED GENERIC": "Red wine",
  "WHITE VARIETAL": "White wine",
  "WHITE GENERIC": "White wine",
  "ROSE WINE": "Rosé",
  "BLUSH WINE": "Blush wine",
  "SPECIAL ORDERS": "Special order",
};

/** "WHISKEY - BOURBON & TENNESSEE" → "Whiskey · Bourbon & Tennessee". */
export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "";
  const [group, ...rest] = category.split(/\s+-\s+/);
  const head = GROUP_NAMES[group.toUpperCase()] ?? displayName(group);
  const tail = rest.join(" · ");
  return tail ? `${head} · ${displayName(tail)}` : head;
}

export type ProductKind = "can" | "wine" | "spirit";

/** Rough kind for the fallback glyph and unit word. Category first, then size. */
export function productKind(category: string | null | undefined, sizeMl?: number | null): ProductKind {
  const c = (category ?? "").toUpperCase();
  if (/BEER|ALE\b|LAGER|CIDER|MALT BEVERAGE|PREMIXED|COOLER|SELTZER/.test(c)) return "can";
  if (/WINE|VARIETAL|GENERIC|RED\b|WHITE\b|ROSE|BLUSH|PORT|SHERRY|MADEIRA|MADIERA|MARSALA|VERMOUTH|SANGRIA|LATE HARVEST|CHAMPAGNE|PROSECCO|SPARKLING|BORDEAUX|BURGUNDY|RHONE|RIOJA|TUSCANY|PIEDMONT|MALBEC/.test(c))
    return "wine";
  if (sizeMl && (sizeMl === 355 || sizeMl === 473 || sizeMl === 330)) return "can";
  return "spirit";
}

/** "bottles" for wine and spirits, neutral "units" for beer, cans and RTDs. */
export function unitWord(category: string | null | undefined, sizeMl: number | null | undefined, n = 2): string {
  const word = productKind(category, sizeMl) === "can" ? "unit" : "bottle";
  return n === 1 ? word : `${word}s`;
}

/** "750 ml", "1.75 L". */
export function sizeLabel(sizeMl: number | null | undefined): string {
  if (!sizeMl) return "";
  if (sizeMl >= 1000) return `${(sizeMl / 1000).toFixed(sizeMl % 1000 === 0 ? 0 : 2).replace(/0$/, "")} L`;
  return `${sizeMl} ml`;
}

const MT = "America/Denver";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: MT });

/** "today at 2:10 PM", "yesterday at 9:05 PM", "Aug 4 at 4:50 PM" (Mountain Time). */
export function whenLabel(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: MT });
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400_000));
  const key = dayKey(d);
  if (key === today) return `today at ${time}`;
  if (key === yesterday) return `yesterday at ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: MT })} at ${time}`;
}

/** Compact age of a store check: "12m ago", "5h ago", or "Sep 21". */
export function checkedAgo(date: Date | string, now = Date.now()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const mins = Math.max(0, Math.round((now - d.getTime()) / 60_000));
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: MT });
}

/** Group label for a day of activity: "Today", "Yesterday", "Mon, Sep 21". */
export function dayLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const key = dayKey(d);
  if (key === dayKey(new Date())) return "Today";
  if (key === dayKey(new Date(Date.now() - 86400_000))) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: MT });
}

export { dayKey };

/**
 * DABS's listing status in plain words. This is how DABS lists a product, not
 * whether it's on a shelf: keep it visually separate from availability.
 * General listings need no note.
 */
export function listingNote(status: string | null | undefined): string | null {
  switch (status) {
    case "A":
      return "Allocated listing";
    case "L":
    case "P":
      return "Limited listing";
    case "D":
      return "Clearance: being discontinued";
    case "X":
      return "Discontinued";
    case "T":
      return "Trial listing";
    case "U":
      return "Leaving soon";
    case "S":
      return "Special order only";
    case "N":
      return "Unavailable";
    default:
      return null;
  }
}

/** Size in ml parsed from the end of a DABS name ("… 750ML", "… 1.75L"), for rows with no size column. */
export function sizeFromName(name: string | null): number | null {
  const m = (name ?? "").trim().match(/(\d+(?:\.\d+)?)\s?(ml|l)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase() === "l" ? Math.round(n * 1000) : Math.round(n);
}
