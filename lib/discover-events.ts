import { sql } from "@/lib/db";
import { parseSource } from "@/lib/discover-rules";
import { isUntracked } from "@/lib/admin";

/**
 * Attribution sources that record events: "Worth a look" ("discover:price",
 * "home:back"), taste picks ("taste:typed" | "taste:guided" |
 * "taste:followup", stored as surface "taste" with the mode as view), search
 * result lists ("search:exact" | "search:rough" | "search:browse") and the
 * product page's Watch button ("product:page").
 */
export function parseAttribution(v: unknown): { surface: string; view: string } | null {
  const d = parseSource(v);
  if (d) return d;
  if (typeof v !== "string") return null;
  const m =
    v.match(/^(taste):(typed|guided|followup)$/) ?? v.match(/^(search):(exact|rough|browse)$/) ?? v.match(/^(product):(page)$/);
  return m ? { surface: m[1], view: m[2] } : null;
}

export type DiscoverEventKind =
  | "shown"
  | "click"
  | "watch_click"
  | "watch_request"
  | "watch_added"
  | "useful_yes"
  | "useful_no";

/** Search context on search events: 1-based rank of a clicked result, total matches, the words. */
export interface SearchContext {
  rank?: number | null;
  results?: number | null;
  query?: string | null;
}

/**
 * One row in discover_events. `source` is one of parseAttribution's forms;
 * anything else records nothing. Admins and test accounts aren't counted (as
 * in page_events). Watch taps, email requests and confirmed watches stay
 * separate kinds; only `watch_added` means a watch exists. Analytics never
 * fails the caller.
 */
export async function recordDiscoverEvent(
  kind: DiscoverEventKind,
  source: unknown,
  e: { csc?: string | null; visitorId?: string | null; user?: { id: string; email?: string | null } | null } & SearchContext
): Promise<void> {
  const s = parseAttribution(source);
  if (!s || isUntracked(e.user ? { email: e.user.email ?? undefined } : null)) return;
  try {
    await sql`
      insert into discover_events (kind, surface, view, csc, visitor_id, user_id, rank, results, query)
      values (${kind}, ${s.surface}, ${s.view}, ${e.csc ?? null}, ${e.visitorId ?? null}, ${e.user?.id ?? null},
              ${e.rank ?? null}, ${e.results ?? null}, ${e.query?.trim().slice(0, 200) || null})`;
  } catch (err) {
    console.error("[discover] event insert failed", err instanceof Error ? err.message : err);
  }
}
