import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { applyWatchIntent, isIntentId } from "@/lib/watch-intent";

/**
 * Where a "watch this bottle" sign-in link lands after /auth/confirm has
 * signed the visitor in: add the watch they asked for, then show it on the
 * product page. Safe to hit again (nothing is toggled or duplicated).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("intent");
  if (!isIntentId(id)) return NextResponse.redirect(new URL("/watchlist", request.url));

  const user = await getCurrentUser();
  if (!user) {
    // Not signed in (link opened elsewhere, or the session didn't stick): offer a fresh link.
    const next = `/watch/confirm?intent=${id}`;
    return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, request.url));
  }

  const result = await applyWatchIntent(id, user).catch((err) => {
    console.error("watch intent failed", err);
    return null;
  });
  if (!result?.csc) {
    return NextResponse.redirect(new URL("/watchlist?watch=failed", request.url));
  }
  revalidatePath("/watchlist");
  const params = new URLSearchParams({ watch: result.status });
  if (result.store) params.set("store", result.store);
  // Opened in a browser signed in as someone else: the page names both addresses.
  if (result.status === "mismatch") params.set("intent", id);
  return NextResponse.redirect(new URL(`/product/${result.csc}?${params}`, request.url));
}
