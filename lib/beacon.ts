/**
 * Browser-side helpers for first-party analytics (components/page-tracker.tsx,
 * app/api/events). No cookies: a random visitor id in localStorage.
 */
export const VISITOR_KEY = "ud_vid";
/**
 * Set in a browser once an admin or test account has used it
 * (components/analytics.tsx), so its later signed-out visits and taps aren't
 * counted either. Clearing site data resets it.
 */
export const NO_TRACK_KEY = "ud_notrack";

/** The random visitor id page views use, or null if storage is blocked. */
export function visitorId(): string | null {
  try {
    return localStorage.getItem(VISITOR_KEY);
  } catch {
    return null;
  }
}

/** True in a browser an admin or test account has used. */
export function trackingOff(): boolean {
  try {
    return localStorage.getItem(NO_TRACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markUntracked() {
  try {
    localStorage.setItem(NO_TRACK_KEY, "1");
  } catch {
    // storage blocked: nothing to remember
  }
}

/**
 * The attribution a watch tap should carry, or undefined in an untracked
 * browser (so nothing downstream, including a confirmed watch, is counted).
 */
export function trackedSource(source: string | undefined): string | undefined {
  return source && !trackingOff() ? source : undefined;
}

export type DiscoverAction = "shown" | "click" | "watch_click" | "useful_yes" | "useful_no";

/**
 * Record an action on a result list or product page (see discover_events).
 * `extra` carries search context: 1-based rank, total results, the words.
 * Never throws.
 */
export function sendDiscoverEvent(
  kind: DiscoverAction,
  source: string,
  csc?: string | null,
  extra?: { rank?: number; results?: number; query?: string }
) {
  const visitor = visitorId();
  if (!visitor || trackingOff()) return;
  const body = JSON.stringify({ action: { kind, source, csc: csc ?? null, ...extra }, visitor });
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(
    () => {}
  );
}
