import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { releaseIdleConnections } from "@/lib/db-release";
import { clientIp, withinLimit } from "@/lib/rate-limit";

/**
 * "Does this rating seem wrong?" from the rating card. Stores the note for
 * /admin; the IP is only used for the rate-limit key, never stored.
 */
const Body = z.object({
  csc: z.string().regex(/^\d{6}$/),
  tier: z.enum(["everyday", "uncommon", "scarce", "rare", "unicorn"]).nullable(),
  message: z.string().trim().min(3).max(600),
  visitor: z.string().regex(/^[\w-]{8,64}$/).nullish(),
});

export async function POST(req: NextRequest) {
  releaseIdleConnections();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  if (!(await withinLimit(`rating-feedback:${clientIp(req.headers)}`, 5, 3600))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const b = parsed.data;
  await sql`
    insert into rating_feedback (csc, tier_shown, message, visitor_id)
    values (${b.csc}, ${b.tier}, ${b.message}, ${b.visitor ?? null})`;
  return NextResponse.json({ ok: true });
}
