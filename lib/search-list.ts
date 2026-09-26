/**
 * Identity of one displayed search result list, for the "shown" beacon
 * (components/search-track.tsx): the words, every filter, sort and page in
 * the URL, and the visitor's area (which changes ordering and nearby counts).
 * Any change is a new list and is reported again, even with the same number
 * of matches; the same list re-rendered (back button, refresh of state) is not.
 * Never stored: only used client-side to decide whether to send.
 */
export function searchListKey(
  source: string,
  params: Record<string, string | string[] | undefined>,
  area: { label: string } | null | undefined,
  results: number
): string {
  const pairs = Object.entries(params)
    .flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : typeof v === "string" ? [[k, v]] : []))
    .map(([k, v]) => [k, k === "q" ? v.trim() : v] as const)
    .filter(([, v]) => v !== "")
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1));
  return JSON.stringify([source, pairs, area?.label ?? null, results]);
}
