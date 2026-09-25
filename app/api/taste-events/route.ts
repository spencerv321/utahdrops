import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { releaseIdleConnections } from "@/lib/db-release";
import { isBot } from "@/lib/analytics";

/**
 * Taste-search beacon (components/taste-track.tsx): what was shown, clicked
 * or rated. Always 204; analytics never surfaces an error.
 */
const Body = z.object({
  // Watch clicks and completed watches go to discover_events (source
  // "taste:<mode>"), which also follows signed-out watches through sign-in.
  kind: z.enum(["shown", "click", "feedback"]),
  mode: z.enum(["typed", "guided", "followup"]).nullish(),
  visitor: z.string().regex(/^[\w-]{8,64}$/).nullish(),
  request: z.record(z.string(), z.unknown()).nullish(),
  csc: z.string().regex(/^\d{6}$/).nullish(),
  rank: z.number().int().min(0).max(20).nullish(),
  results: z.number().int().min(0).max(100).nullish(),
  useful: z.boolean().nullish(),
});

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  releaseIdleConnections();
  if (isBot(req.headers.get("user-agent") ?? "")) return NO_CONTENT();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NO_CONTENT();
  const b = parsed.data;
  // Keep the stored request small: the structured chips, nothing else.
  const request = b.request && JSON.stringify(b.request).length <= 1000 ? b.request : null;
  try {
    await sql`
      insert into taste_events (kind, mode, visitor_id, request, csc, rank, results, useful)
      values (${b.kind}, ${b.mode ?? null}, ${b.visitor ?? null}, ${request ? sql.json(request as never) : null},
              ${b.csc ?? null}, ${b.rank ?? null}, ${b.results ?? null}, ${b.useful ?? null})`;
  } catch (err) {
    console.error("[taste-events] insert failed", err instanceof Error ? err.message : err);
  }
  return NO_CONTENT();
}
