import { sql } from "@/lib/db";
import { parseSource } from "@/lib/discover-rules";
import { isAdmin } from "@/lib/admin";

export type DiscoverEventKind = "click" | "watch_click" | "watch_request" | "watch_added" | "useful_yes" | "useful_no";

/**
 * One row in discover_events. `source` is "discover:<view>" or "home:<view>";
 * anything else records nothing, and admins aren't counted (as in
 * page_events). Analytics never fails the caller.
 */
export async function recordDiscoverEvent(
  kind: DiscoverEventKind,
  source: unknown,
  e: { csc?: string | null; visitorId?: string | null; user?: { id: string; email?: string | null } | null }
): Promise<void> {
  const s = parseSource(source);
  if (!s || isAdmin(e.user ? { email: e.user.email ?? undefined } : null)) return;
  try {
    await sql`
      insert into discover_events (kind, surface, view, csc, visitor_id, user_id)
      values (${kind}, ${s.surface}, ${s.view}, ${e.csc ?? null}, ${e.visitorId ?? null}, ${e.user?.id ?? null})`;
  } catch (err) {
    console.error("[discover] event insert failed", err instanceof Error ? err.message : err);
  }
}
