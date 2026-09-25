import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { releaseIdleConnections } from "@/lib/db-release";
import { isBot } from "@/lib/analytics";
import { CHECK_NOW } from "@/lib/config";
import { clientIp, withinLimit } from "@/lib/rate-limit";
import { DabsBusyError } from "@/lib/dabs/client";
import { fetchProductDetail } from "@/lib/dabs/detail";
import { logStoreCheck, persistDetail } from "@/lib/jobs/store-inventory";

export const maxDuration = 30;

/**
 * "Check DABS now": one live store-by-store check of one bottle, for a
 * visitor deciding whether to drive. POST only, same-origin, never from a
 * page render, so crawlers can't trigger it. Every DABS request takes a slot
 * from the shared pacer (lib/dabs/client.ts), so this never raises the
 * overall rate; the limits below (CHECK_NOW) bound how much of it visitors
 * take. A check under CHECK_NOW.reuseMinutes old is reused.
 *
 * Answers { status } with one of: checked, recent, busy, limited, capacity,
 * unavailable, failed, not_found.
 */
type Status = "checked" | "recent" | "busy" | "limited" | "capacity" | "unavailable" | "failed" | "not_found";

const reply = (status: Status, extra: Record<string, unknown> = {}, code = 200) =>
  NextResponse.json({ status, ...extra }, { status: code, headers: { "Cache-Control": "no-store" } });

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (req.headers.get("host") ?? req.nextUrl.host);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ csc: string }> }) {
  releaseIdleConnections();
  const { csc } = await params;
  if (!/^\d{6}$/.test(csc)) return reply("not_found", {}, 404);
  if (isBot(req.headers.get("user-agent") ?? "") || !sameOrigin(req)) return reply("limited", {}, 403);

  const [product] = await sql<{ store_checked_at: Date | null; delisted_at: Date | null }[]>`
    select store_checked_at, delisted_at from products where csc = ${csc}`;
  if (!product || product.delisted_at) return reply("not_found", {}, 404);

  if (product.store_checked_at && Date.now() - product.store_checked_at.getTime() < CHECK_NOW.reuseMinutes * 60_000) {
    return reply("recent", { checkedAt: product.store_checked_at });
  }

  // Circuit breaker: DABS failing for visitors lately -> don't pile on.
  const [{ failures }] = await sql<{ failures: number }[]>`
    select count(*)::int as failures from store_checks
    where source = 'on_demand' and not ok and created_at > now() - interval '10 minutes'`.catch(() => [{ failures: 0 }]);
  if (failures >= CHECK_NOW.breakerFailures) return reply("unavailable", {}, 503);

  if (!(await withinLimit(`check:ip:${clientIp(req.headers)}`, CHECK_NOW.perIpPerHour, 3600))) {
    return reply("limited", {}, 429);
  }
  // One check per bottle at a time: a second visitor waits for the first's result.
  if (!(await withinLimit(`check:csc:${csc}`, 1, 30))) return reply("busy");
  if (!(await withinLimit("check:day", CHECK_NOW.dailyCap, 86400))) return reply("capacity", {}, 429);

  const t0 = Date.now();
  try {
    const detail = await fetchProductDetail(csc, {
      quick: { timeoutMs: CHECK_NOW.timeoutMs, maxWaitMs: CHECK_NOW.maxWaitMs },
    });
    const ms = Date.now() - t0;
    const outcome = await persistDetail(detail);
    await logStoreCheck(csc, "on_demand", ms, { ok: true, outcome });
    return reply("checked", { checkedAt: new Date(), changedStores: outcome.changedStores });
  } catch (err) {
    if (err instanceof DabsBusyError) return reply("busy");
    const message = err instanceof Error ? err.message : String(err);
    await logStoreCheck(csc, "on_demand", Date.now() - t0, { ok: false, error: message });
    return reply("failed", {}, 502);
  }
}
