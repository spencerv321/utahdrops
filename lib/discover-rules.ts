/**
 * "Worth a look" (/discover): discovery rules, kept apart from the SQL
 * (lib/discover.ts) so ordering, mixing and labels are testable without a
 * database. These are discovery rules only; they never change a rarity tier.
 *
 * Every threshold lives in DISCOVER. Don't loosen one to fill the page: if
 * few bottles qualify, the page shows few.
 */
export const DISCOVER = {
  /** Statewide stock must come from a catalog pass this recent (products.last_seen). */
  statewideMaxAgeHours: 24,
  /**
   * "Nearby" claims need a successful store check this recent. Stricter than
   * the site-wide 7-day cutoff (STORE_DATA_MAX_AGE_HOURS) because this page
   * tells people where to go.
   */
  nearbyMaxAgeHours: 24,
  /** Scarce view: published tiers (or manual overrides) at or above Scarce. */
  tiers: ["unicorn", "rare", "scarce"] as const,
  back: {
    /** Out of stock statewide for at least this long, observed. */
    absenceDays: 30,
    /** …and first observed back within this many days. */
    returnedWithinDays: 14,
    /**
     * Longest allowed gap between successful catalog passes during the
     * absence. A longer gap (an outage) means we didn't watch it: not a
     * confirmed absence.
     */
    maxCoverageGapHours: 48,
  },
  price: {
    /** A drop counts only if it is at least this share of the previous price… */
    minPct: 0.1,
    /** …and at least this many dollars. */
    minDollars: 3,
    /** Observed within this many days. */
    withinDays: 30,
    /** The previous price must have held at least this long (no one-pass glitches). */
    prevMinDays: 7,
  },
  /** Results shown per view before "Show more", and the most "Show more" reaches. */
  pageSize: 12,
  maxResults: 60,
  /** Homepage preview. */
  previewSize: 3,
} as const;

export type DiscoverView = "scarce" | "back" | "price";
export const VIEWS: { key: DiscoverView; label: string; blurb: string }[] = [
  {
    key: "scarce",
    label: "Scarce bottles in stores",
    blurb: "Rated Scarce, Rare or Unicorn by our availability rating, and reported in stores now.",
  },
  {
    key: "back",
    label: "Back after a while",
    blurb: `Out of stock statewide for ${DISCOVER.back.absenceDays}+ days while we were watching, and back in stores now.`,
  },
  {
    key: "price",
    label: "Price drops",
    blurb: `At least ${Math.round(DISCOVER.price.minPct * 100)}% and $${DISCOVER.price.minDollars} below the previous DABS price, seen in the last ${DISCOVER.price.withinDays} days.`,
  },
];

export function parseView(v: string | undefined): DiscoverView {
  return v === "back" || v === "price" ? v : "scarce";
}

export type Surface = "discover" | "home";

/** Watch/click attribution carried through sign-in, e.g. "discover:price". */
export function parseSource(v: unknown): { surface: Surface; view: DiscoverView } | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(discover|home):(scarce|back|price)$/);
  return m ? { surface: m[1] as Surface, view: m[2] as DiscoverView } : null;
}

export type Tier = "unicorn" | "rare" | "scarce" | "uncommon" | "everyday";
const TIER_RANK: Record<string, number> = { unicorn: 0, rare: 1, scarce: 2, uncommon: 3, everyday: 4 };

export interface DiscoverItem {
  csc: string;
  name: string;
  category: string | null;
  sizeMl: number | null;
  price: number;
  isSpa: boolean;
  status: string | null;
  storeQty: number;
  /** Last catalog pass that saw it (statewide observation). */
  statewideAt: Date;
  /** Last successful store-by-store check (never an attempt). */
  storeCheckedAt: Date | null;
  /** Published tier after manual overrides; null = no badge. */
  tier: Tier | null;
  rarityHeadline: string | null;
  /** Only with an area: stores within range with fresh positive stock. */
  near: { stores: number; units: number; checkedAt: Date } | null;
  /** Back view: first seen out, and first observed back. */
  outSince?: Date;
  backAt?: Date;
  /** Price view. */
  oldPrice?: number;
  dropAt?: Date;
}

export type NearState =
  | { kind: "none-selected" }
  | { kind: "near"; stores: number; units: number; checkedAt: Date }
  | { kind: "not-near"; checkedAt: Date }
  | { kind: "unknown" };

/**
 * What we can honestly say about stock near the visitor. Positive only from
 * fresh successful store checks; "not near" only when the whole product was
 * checked successfully within the window; otherwise unknown (never "none").
 */
export function nearState(item: DiscoverItem, hasArea: boolean, now = Date.now()): NearState {
  if (!hasArea) return { kind: "none-selected" };
  const windowMs = DISCOVER.nearbyMaxAgeHours * 3600_000;
  if (item.near && item.near.stores > 0 && now - item.near.checkedAt.getTime() <= windowMs) {
    return { kind: "near", ...item.near };
  }
  if (item.storeCheckedAt && now - item.storeCheckedAt.getTime() <= windowMs) {
    return { kind: "not-near", checkedAt: item.storeCheckedAt };
  }
  return { kind: "unknown" };
}

const t = (d: Date | null | undefined) => (d ? d.getTime() : 0);

/**
 * Deterministic order within a view: verified nearby first (with an area),
 * then the view's own signal, then fresher evidence, then the product code.
 */
export function compareItems(view: DiscoverView, hasArea: boolean, now = Date.now()) {
  return (a: DiscoverItem, b: DiscoverItem): number => {
    if (hasArea) {
      const na = nearState(a, true, now).kind === "near" ? 0 : 1;
      const nb = nearState(b, true, now).kind === "near" ? 0 : 1;
      if (na !== nb) return na - nb;
    }
    let d = 0;
    if (view === "scarce") d = (TIER_RANK[a.tier ?? ""] ?? 9) - (TIER_RANK[b.tier ?? ""] ?? 9);
    else if (view === "back") d = t(b.backAt) - t(a.backAt) || t(a.outSince) - t(b.outSince);
    else d = dropPct(b) - dropPct(a) || t(b.dropAt) - t(a.dropAt);
    if (d) return d;
    d = t(b.storeCheckedAt) - t(a.storeCheckedAt) || t(b.statewideAt) - t(a.statewideAt);
    if (d) return d;
    return a.csc < b.csc ? -1 : a.csc > b.csc ? 1 : 0;
  };
}

export function dropPct(i: DiscoverItem): number {
  return i.oldPrice && i.oldPrice > 0 ? (i.oldPrice - i.price) / i.oldPrice : 0;
}

/** Order, drop duplicates (first wins), and apply "Nearby only". */
export function rankView(
  items: DiscoverItem[],
  view: DiscoverView,
  opts: { hasArea: boolean; nearbyOnly?: boolean; now?: number }
): DiscoverItem[] {
  const now = opts.now ?? Date.now();
  const seen = new Set<string>();
  return [...items]
    .sort(compareItems(view, opts.hasArea, now))
    .filter((i) => {
      if (seen.has(i.csc)) return false;
      seen.add(i.csc);
      return !opts.nearbyOnly || nearState(i, opts.hasArea, now).kind === "near";
    });
}

/**
 * Homepage preview: up to `size` different bottles. Verified nearby results
 * first, taking views in turn (scarce, back, price); then the rest in turn.
 * A view with nothing qualifying simply contributes nothing.
 */
export function mixPreview(
  lists: Partial<Record<DiscoverView, DiscoverItem[]>>,
  opts: { hasArea: boolean; size?: number; now?: number }
): { view: DiscoverView; item: DiscoverItem }[] {
  const size = opts.size ?? DISCOVER.previewSize;
  const now = opts.now ?? Date.now();
  const order: DiscoverView[] = ["scarce", "back", "price"];
  const ranked = Object.fromEntries(
    order.map((v) => [v, rankView(lists[v] ?? [], v, { hasArea: opts.hasArea, now })])
  ) as Record<DiscoverView, DiscoverItem[]>;
  const out: { view: DiscoverView; item: DiscoverItem }[] = [];
  const taken = new Set<string>();
  const passes = opts.hasArea
    ? [(i: DiscoverItem) => nearState(i, true, now).kind === "near", () => true]
    : [() => true];
  for (const ok of passes) {
    const cursor: Record<DiscoverView, number> = { scarce: 0, back: 0, price: 0 };
    let progressed = true;
    while (out.length < size && progressed) {
      progressed = false;
      for (const v of order) {
        if (out.length >= size) break;
        const list = ranked[v];
        while (cursor[v] < list.length) {
          const item = list[cursor[v]++];
          if (taken.has(item.csc) || !ok(item)) continue;
          taken.add(item.csc);
          out.push({ view: v, item });
          progressed = true;
          break;
        }
      }
    }
  }
  return out;
}

const MT = "America/Denver";
export function shortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: MT });
}

/** The one-line reason a bottle is on the list, for a given view. */
export function reasonFor(view: DiscoverView, i: DiscoverItem): string {
  if (view === "scarce") return i.rarityHeadline ?? "Rated scarce";
  if (view === "back") {
    const days = i.outSince && i.backAt ? Math.floor((i.backAt.getTime() - i.outSince.getTime()) / 86400_000) : null;
    return `First observed back ${i.backAt ? shortDay(i.backAt) : ""}${days ? `, after ${days}+ days out of stock` : ""}`;
  }
  const pct = Math.round(dropPct(i) * 100);
  return `Down ${pct}% from $${(i.oldPrice ?? 0).toFixed(2)} (seen ${i.dropAt ? shortDay(i.dropAt) : ""})`;
}

export const VIEW_KICKER: Record<DiscoverView, string> = {
  scarce: "In stores now",
  back: "Back in stores",
  price: "Price drop",
};
