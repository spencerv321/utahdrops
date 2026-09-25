import { DISCOVER } from "@/lib/discover-rules";

/**
 * What store-by-store counts can honestly claim, in one place (pure, tested in
 * tests/store-freshness.test.ts).
 *
 * Positive counts are always shown with their check time. A negative claim
 * ("none near you", "not at your store") needs a successful check this
 * recent: the same standard as "Worth a look" (DISCOVER.nearbyMaxAgeHours),
 * because both tell people where not to go.
 *
 * A statewide count from a later catalog pass can disprove an older store
 * count, never confirm it: statewide is the sum over stores, so a store can't
 * hold more than the whole state does now. It can't prove a store unchanged
 * (one store can sell a bottle while another receives one).
 */
export const NEGATIVE_CLAIM_MAX_AGE_HOURS = DISCOVER.nearbyMaxAgeHours;

export type Stamp = Date | string | null | undefined;

const time = (d: Stamp) => (d ? new Date(d).getTime() : NaN);

/** May we say "none here" from a check made at `checkedAt`? */
export function canClaimNone(checkedAt: Stamp, now = Date.now()): boolean {
  const t = time(checkedAt);
  return Number.isFinite(t) && now - t <= NEGATIVE_CLAIM_MAX_AGE_HOURS * 3600_000;
}

export interface Statewide {
  /** Bottles on store shelves statewide in the latest catalog pass. */
  qty: number | null;
  /** When that catalog pass saw it (products.last_seen). */
  at: Stamp;
}

/** Is the statewide count newer than the store check (so it can contradict it)? */
function newer(statewide: Statewide, checkedAt: Stamp): boolean {
  const s = time(statewide.at);
  const c = time(checkedAt);
  return Number.isFinite(s) && Number.isFinite(c) && s > c;
}

/**
 * A later catalog pass shows no bottles on any store shelf: every positive
 * store count from before it is wrong.
 */
export function noneStatewideSince(statewide: Statewide, checkedAt: Stamp): boolean {
  return newer(statewide, checkedAt) && (statewide.qty ?? 0) <= 0;
}

/**
 * A positive store count (or a sum over some stores) that a later statewide
 * count disproves: more than the whole state has now.
 */
export function exceedsStatewide(qty: number, statewide: Statewide, checkedAt: Stamp): boolean {
  return qty > 0 && newer(statewide, checkedAt) && qty > (statewide.qty ?? 0);
}
