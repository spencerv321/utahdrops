/**
 * "Start somewhere": honest browsing shortcuts for people who don't know the
 * bottle they want. Each is a plain filter on real DABS categories and prices
 * (no popularity or recommendation claims), linked to /search.
 */
export interface Shortcut {
  label: string;
  category?: string;
  max?: number;
  sale?: boolean;
}

export const SHORTCUTS: Shortcut[] = [
  { label: "Bourbon under $40", category: "WHISKEY - BOURBON & TENNESSEE", max: 40 },
  { label: "Sauvignon blanc under $20", category: "WHITE VARIETAL - SAUVIGNON BLANC", max: 20 },
  { label: "Red blends under $15", category: "RED GENERIC - RED TABLE & PROPRIETARY", max: 15 },
  { label: "Reposado & añejo tequila", category: "TEQUILA - REPOSADO & ANEJO" },
  { label: "Single malt scotch", category: "WHISKEY - SCOTCH SINGLE MALT" },
  { label: "Prosecco", category: "SPARKLING WINE - PROSECCO" },
  { label: "On sale this month", sale: true },
];

export function shortcutHref(s: Shortcut): string {
  const p = new URLSearchParams({ instock: "1" });
  if (s.category) p.set("category", s.category);
  if (s.max) p.set("max", String(s.max));
  if (s.sale) p.set("sale", "1");
  return `/search?${p.toString()}`;
}
