import { displayName } from "@/lib/format";

/**
 * A two-level view over DABS's ~200 flat categories for the search filter:
 * a broad type first ("Vodka", "Red wine"), then the DABS categories inside it
 * with labels that make sense on their own ("Imported", "French · Bordeaux").
 * Pure mapping: DABS category strings (and ?category= URLs) are unchanged.
 */
export interface CategoryGroup {
  slug: string;
  label: string;
  /** Matches the part of a DABS category before " - ". */
  test: (head: string) => boolean;
  /** Heads that go without saying inside this group ("VODKA - IMPORTED" → "Imported vodka"). */
  implied?: string[];
  /** Appended to generic sub-labels ("Imported" → "Imported vodka"). */
  noun?: string;
}

const is = (...heads: string[]) => (h: string) => heads.includes(h);

// Order matters: the first group that matches wins, and it's the menu order.
export const CATEGORY_GROUPS: CategoryGroup[] = [
  { slug: "whiskey", label: "Whiskey", test: is("WHISKEY"), implied: ["WHISKEY"], noun: "whiskey" },
  { slug: "vodka", label: "Vodka", test: is("VODKA"), implied: ["VODKA"], noun: "vodka" },
  { slug: "tequila", label: "Tequila & mezcal", test: is("TEQUILA"), implied: ["TEQUILA"], noun: "tequila" },
  { slug: "rum", label: "Rum", test: is("RUM"), implied: ["RUM"], noun: "rum" },
  { slug: "gin", label: "Gin", test: is("GIN"), implied: ["GIN"], noun: "gin" },
  { slug: "brandy", label: "Brandy & cognac", test: is("BRANDY"), implied: ["BRANDY"], noun: "brandy" },
  { slug: "liqueurs", label: "Liqueurs & schnapps", test: is("LIQUEURS", "SCHNAPPS"), implied: ["LIQUEURS"], noun: "liqueurs" },
  { slug: "red-wine", label: "Red wine", test: (h) => /\bRED\b/.test(h) && !/ALLOCATED|OFFER/.test(h) },
  { slug: "white-wine", label: "White wine", test: (h) => /\bWHITE\b/.test(h) },
  { slug: "rose", label: "Rosé & blush", test: is("ROSE WINE", "BLUSH WINE") },
  { slug: "sparkling", label: "Sparkling wine", test: is("SPARKLING WINE"), implied: ["SPARKLING WINE"], noun: "sparkling" },
  {
    slug: "fortified",
    label: "Port, sherry & dessert wine",
    test: is("PORT", "SHERRY", "MADEIRA", "MADIERA", "MARSALA", "LATE HARVEST", "VERMOUTH"),
  },
  { slug: "other-wine", label: "Sake, orange & fruit wine", test: is("SAKE", "ORANGE WINE", "WINE") },
  {
    slug: "beer",
    label: "Beer",
    test: (h) => ["ALE", "LAGER", "BEER", "DOMESTIC BEER", "IMPORTED BEER"].includes(h),
    implied: ["BEER"],
    noun: "beer",
  },
  { slug: "cider", label: "Cider & malt drinks", test: is("CIDER", "FLAVORED MALT BEVERAGES"), implied: ["CIDER"], noun: "cider" },
  { slug: "premixed", label: "Premixed cocktails", test: is("PREMIXED"), implied: ["PREMIXED"] },
  { slug: "gift-sets", label: "Gift sets", test: is("GIFT SETS"), implied: ["GIFT SETS"] },
  {
    slug: "offers",
    label: "Offers & allocated",
    test: is("ALLOCATED SPIRIT", "ALLOCATED WINE", "ALLOCATED BEER", "SPIRIT OFFER", "WINE OFFER", "BEER OFFER"),
  },
  { slug: "special-orders", label: "Special orders", test: is("SPECIAL ORDERS"), implied: ["SPECIAL ORDERS"] },
  { slug: "other", label: "Other", test: () => true },
];

const head = (category: string) => category.split(/\s+-\s+/)[0].trim().toUpperCase();

export function groupOf(category: string | null | undefined): CategoryGroup | null {
  if (!category) return null;
  return CATEGORY_GROUPS.find((g) => g.test(head(category))) ?? null;
}

export function groupBySlug(slug: string | null | undefined): CategoryGroup | null {
  return CATEGORY_GROUPS.find((g) => g.slug === slug) ?? null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const GENERIC = new Set(["Imported", "Domestic", "Basic", "Flavored", "Other", "Generic"]);

function tidy(text: string): string {
  return displayName(text)
    .replace(/\bMisc\b/g, "Other")
    .replace(/\bDoc\b/g, "DOC")
    .replace(/\bAoc\b/g, "AOC")
    .replace(/\bBa, Tba\b/g, "BA, TBA")
    .replace(/\bAnd\b/g, "&")
    .replace(/\bDsd\b/g, "Small packages")
    .replace(/\bRose\b/g, "Rosé")
    .replace(/\bPortugese\b/g, "Portuguese")
    .replace(/\bMadiera\b/g, "Madeira")
    .replace(/\s*-\s+|\s+-\s*/g, " – ");
}

// Wine regions and styles: "FRENCH RED" → "French", "RED VARIETAL" → (just the grape).
function wineLead(h: string): string {
  const lead = h.replace(/\b(RED|WHITE)\b/g, "").replace(/\s+/g, " ").trim();
  if (lead === "VARIETAL") return "";
  if (lead === "GENERIC") return "Blends";
  if (lead === "SMALL PACKAGE WINE") return "Small packages";
  return tidy(lead);
}

/** Label for a DABS category inside its group: "Imported vodka", "French · Bordeaux", "Cabernet". */
export function subcategoryLabel(category: string): string {
  const group = groupOf(category);
  const [h0, ...rest] = category.split(/\s+-\s+/);
  const h = h0.trim().toUpperCase();
  let tail = rest.length ? tidy(rest.join(" - ")) : "";
  if (group && group.implied?.includes(h)) {
    if (!tail) return cap(group.noun ?? tidy(h));
    return group.noun && GENERIC.has(tail.split(" ")[0]) && tail.split(" ").length === 1 ? `${tail} ${group.noun}` : tail;
  }
  if (group?.slug === "red-wine" || group?.slug === "white-wine") {
    const lead = wineLead(h);
    if (lead === "Small packages") tail = "";
    if (!lead) return tail === "Other" ? "Other grapes" : tail;
    return tail ? `${lead} · ${tail}` : lead;
  }
  const lead = tidy(h)
    .replace(/^Rosé Wine$/, "Rosé")
    .replace(/^Blush Wine$/, "Blush")
    .replace(/^Orange Wine$/, "Orange wine")
    .replace(/^Wine$/, "Wine");
  return tail ? `${lead} · ${tail}` : lead;
}

/** Full label for a filter pill: "Red wine · French · Bordeaux", "Imported vodka". */
export function categoryFilterLabel(category: string): string {
  const group = groupOf(category);
  const sub = subcategoryLabel(category);
  if (!group || group.slug === "other") return sub;
  if (group.noun && sub.toLowerCase().includes(group.noun)) return sub;
  return `${group.label} · ${sub}`;
}

/** Categories grouped for the picker, groups in menu order, subcategories A→Z by label. */
export function groupCategories(categories: string[]): { group: CategoryGroup; items: { value: string; label: string }[] }[] {
  const byGroup = new Map<string, { value: string; label: string }[]>();
  for (const c of categories) {
    const g = groupOf(c);
    if (!g) continue;
    byGroup.set(g.slug, [...(byGroup.get(g.slug) ?? []), { value: c, label: subcategoryLabel(c) }]);
  }
  return CATEGORY_GROUPS.filter((g) => byGroup.has(g.slug)).map((group) => ({
    group,
    items: byGroup.get(group.slug)!.sort((a, b) => a.label.localeCompare(b.label)),
  }));
}
