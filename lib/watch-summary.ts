import type { Nearby } from "@/lib/queries";
import { exceedsStatewide, noneStatewideSince } from "@/lib/store-freshness";

/**
 * The signed-in homepage line: how many watched bottles are in stock, and how
 * many of those a store near the visitor's area had. Pure (tests in
 * tests/watch-summary.test.ts).
 *
 * Only positive local claims: a bottle counts as near when a store check
 * (under STORE_DATA_MAX_AGE_HOURS, as getNearby returns) found it and no newer
 * statewide count disproves it. The oldest of those checks is shown with the
 * count. Zero near is never claimed here (that needs a < 24h check for every
 * bottle); the line just leaves the local part out.
 */
export interface WatchSummary {
  total: number;
  inStock: number;
  near: { bottles: number; checkedAt: Date } | null;
}

export function watchSummary(
  watched: { csc: string; in_stock: boolean }[],
  nearby: Map<string, Nearby> | undefined
): WatchSummary {
  let bottles = 0;
  let oldest: Date | null = null;
  for (const w of watched) {
    const n = nearby?.get(w.csc);
    if (!n || n.stores <= 0) continue;
    if (noneStatewideSince(n.statewide, n.checkedAt) || exceedsStatewide(n.units, n.statewide, n.checkedAt)) continue;
    bottles++;
    const at = new Date(n.checkedAt);
    if (!oldest || at < oldest) oldest = at;
  }
  return {
    total: watched.length,
    inStock: watched.filter((w) => w.in_stock).length,
    near: bottles > 0 && oldest ? { bottles, checkedAt: oldest } : null,
  };
}
