import { NEARBY_MILES, type Area } from "@/lib/area";
import { isFreshStoreCheck } from "@/lib/config";
import { canClaimNone, exceedsStatewide, noneStatewideSince, type Stamp, type Statewide } from "@/lib/store-freshness";

/**
 * The product page's one-glance local answer: is this bottle on a shelf near
 * the visitor's chosen area, and how sure can we be? Pure (tests in
 * tests/local-availability.test.ts). Claim rules come from
 * lib/store-freshness.ts and STORE_DATA_MAX_AGE_HOURS:
 *
 *   no-area          no area chosen; only statewide facts are shown
 *   delisted         DABS doesn't list it (drawing releases say so); no stock claims
 *   statewide-zero   the latest catalog pass shows none on any store shelf, and
 *                    no newer store check says otherwise
 *   fresh-positive   stock near the area in a store check under a day old
 *   stale-positive   stock near the area in a check 1-7 days old: last known, not now
 *   fresh-zero       none near the area in a check under a day old
 *   disproved        nearby counts a newer statewide count rules out
 *   unknown          never checked store by store, the check is over 7 days old,
 *                    or none nearby in a check too old to rule stores out
 *
 * A zero is only ever claimed from a fresh check or a newer statewide count;
 * "unknown" is never shown as none.
 */

export interface LocalStore {
  store_id: number;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  qty: number;
}

export interface StoreHit extends LocalStore {
  miles: number;
}

export type LocalAnswer =
  | { kind: "no-area" }
  | { kind: "delisted"; drawing: boolean }
  | { kind: "statewide-zero"; statewideAt: Stamp }
  | { kind: "fresh-positive" | "stale-positive"; stores: number; units: number; checkedAt: Date; nearest: StoreHit }
  | { kind: "fresh-zero"; checkedAt: Date; elsewhere: StoreHit | null }
  | { kind: "disproved"; checkedAt: Date }
  | { kind: "unknown"; checkedAt: Date | null };

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function localAnswer(input: {
  area: Area | null;
  stores: LocalStore[];
  /** Latest successful store-by-store check (one DABS page covers every store). */
  checkedAt: Stamp;
  statewide: Statewide;
  delisted: boolean;
  drawing: boolean;
  now?: number;
}): LocalAnswer {
  const { area, stores, statewide } = input;
  const now = input.now ?? Date.now();
  const checkedAt = input.checkedAt ? new Date(input.checkedAt) : null;

  if (input.delisted) return { kind: "delisted", drawing: input.drawing };

  // A statewide zero is a local zero too, unless a newer store check found stock.
  const statewideZero = (statewide.qty ?? 0) <= 0;
  const storeNewer = checkedAt != null && statewide.at != null && checkedAt.getTime() > new Date(statewide.at).getTime();
  const newerStock = storeNewer && stores.some((s) => s.qty > 0);
  if (statewideZero && !newerStock && statewide.at) return { kind: "statewide-zero", statewideAt: statewide.at };

  if (!area) return { kind: "no-area" };
  if (!checkedAt || !isFreshStoreCheck(checkedAt, now)) return { kind: "unknown", checkedAt };

  const withMiles = stores
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({ ...s, miles: milesBetween(area, { lat: s.lat!, lng: s.lng! }) }))
    .sort((a, b) => a.miles - b.miles);
  const stocked = withMiles.filter((s) => s.qty > 0);
  const near = stocked.filter((s) => s.miles <= NEARBY_MILES);
  const units = near.reduce((a, s) => a + s.qty, 0);

  if (near.length > 0) {
    // The whole state has fewer than these stores had (or none): out of date.
    if (noneStatewideSince(statewide, checkedAt) || exceedsStatewide(units, statewide, checkedAt)) {
      return { kind: "disproved", checkedAt };
    }
    const kind = canClaimNone(checkedAt, now) ? "fresh-positive" : "stale-positive";
    return { kind, stores: near.length, units, checkedAt, nearest: near[0] };
  }
  if (canClaimNone(checkedAt, now)) {
    const elsewhere = stocked.find((s) => !exceedsStatewide(s.qty, statewide, checkedAt)) ?? null;
    return { kind: "fresh-zero", checkedAt, elsewhere };
  }
  return { kind: "unknown", checkedAt };
}

/** Does this answer need a fresher store check to be useful ("Check DABS now")? */
export function wantsLiveCheck(a: LocalAnswer): boolean {
  return a.kind === "stale-positive" || a.kind === "unknown" || a.kind === "disproved";
}
