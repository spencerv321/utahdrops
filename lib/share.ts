/**
 * Share links (components/share-button.tsx). A shared link carries
 * `?ref=share`, which the page tracker records as utm_source, so visits from
 * text messages and AirDrop (no referrer) still show up as shared-link visits.
 * Pure, so tests can cover it.
 */
export const SHARE_REF = "share";

/** Pages with a share button; stored as discover_events.view under surface "share". */
export type ShareSurface = "product" | "discover";

/**
 * The address to share: the current page with tracking params from the
 * sharer's own visit (an alert email's utm tags, an earlier ref) swapped for
 * ref=share. Other params (search filters) are kept.
 */
export function shareUrl(href: string): string {
  const url = new URL(href);
  for (const key of [...url.searchParams.keys()]) {
    if (key === "ref" || key.startsWith("utm_")) url.searchParams.delete(key);
  }
  url.searchParams.set("ref", SHARE_REF);
  url.hash = "";
  return url.toString();
}
