/**
 * Browser-side helpers for first-party analytics (components/page-tracker.tsx,
 * app/api/events). No cookies: a random visitor id in localStorage.
 */
export const VISITOR_KEY = "ud_vid";

/** The random visitor id page views use, or null if storage is blocked. */
export function visitorId(): string | null {
  try {
    return localStorage.getItem(VISITOR_KEY);
  } catch {
    return null;
  }
}

export type DiscoverAction = "click" | "watch_click" | "useful_yes" | "useful_no";

/** Record an action on a "Worth a look" result (see discover_events). Never throws. */
export function sendDiscoverEvent(kind: DiscoverAction, source: string, csc?: string | null) {
  const visitor = visitorId();
  if (!visitor) return;
  const body = JSON.stringify({ action: { kind, source, csc: csc ?? null }, visitor });
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(
    () => {}
  );
}
