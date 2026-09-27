/**
 * Identity of one displayed search result list, for the "shown" beacon
 * (components/search-track.tsx): the words, every filter, sort and page in
 * the URL, and the visitor's area (label and coordinates, which change
 * ordering and nearby counts).
 * Any change is a new list and is reported again, even with the same number
 * of matches; the same list re-rendered (back button, refresh of state) is not.
 * Never stored: only used client-side to decide whether to send.
 */
export function searchListKey(
  source: string,
  params: Record<string, string | string[] | undefined>,
  area: { label: string; lat: number; lng: number } | null | undefined,
  results: number
): string {
  const pairs = Object.entries(params)
    .flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : typeof v === "string" ? [[k, v]] : []))
    .map(([k, v]) => [k, k === "q" ? v.trim() : v] as const)
    .filter(([, v]) => v !== "")
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1));
  // Coordinates too: two different geolocations are both labelled "Near you".
  const place = area ? [area.label, area.lat, area.lng] : null;
  return JSON.stringify([source, pairs, place, results]);
}

/**
 * Whether /search shows the ordinary keyword Results section (and so whether
 * its list counts as shown). Taste picks without words replace it with a
 * browse link; taste picks or AI answers with no keyword matches hide it, so a
 * zero there was never displayed. Without taste or AI, a zero-result list is
 * shown ("Nothing on the shelf matches that") and counts.
 */
export function keywordResultsShown(v: { taste: boolean; q: string; total: number; ask: boolean }): boolean {
  if (v.taste && !v.q) return false;
  return v.taste ? v.total > 0 : v.total > 0 || !v.ask;
}
