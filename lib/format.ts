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
    .replace(/\bIpa\b/g, "IPA")
    .replace(/\bDble\b/g, "Double")
    .replace(/\bVsop\b/g, "VSOP")
    .replace(/\bXo\b/g, "XO");
}

/**
 * DABS store names look like "STORE 41 BOUNTIFUL" (sometimes just "STORE 2").
 * People know stores by place, so lead with that and keep the number as a hint.
 */
export function storeLabel(name: string, city?: string | null): { title: string; number: string | null } {
  const m = name.match(/^STORE\s*#?\s*(\d+)\s*[-–—]?\s*(.*)$/i);
  const place = (m ? m[2] : name).trim() || city || "";
  return {
    title: place ? displayName(place) : `Store ${m?.[1] ?? ""}`.trim(),
    number: m ? m[1] : null,
  };
}
