import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQuery } from "@/lib/nl/parse";
import { runNlSearch } from "@/lib/nl/search";
import { clientIp, withinLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

/** Each query is one paid Claude call — cap per visitor and per day. */
const PER_IP_LIMIT = 20; // per 10 minutes
const DAILY_LIMIT = Number(process.env.NL_DAILY_LIMIT ?? 3000);

const Body = z.object({
  query: z.string().trim().min(2).max(300),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const body = Body.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Over the limit, degrade to plain keyword search rather than erroring.
  const allowed =
    (await withinLimit(`nl:ip:${clientIp(request.headers)}`, PER_IP_LIMIT, 600)) &&
    (await withinLimit("nl:day", DAILY_LIMIT, 86400));
  if (!allowed) {
    return NextResponse.json({ fallback: true, reason: "rate_limited" }, { status: 429 });
  }

  const parsed = await parseQuery(body.data.query);
  if (!parsed) {
    // No API key or low-confidence parse → caller falls back to plain search
    return NextResponse.json({ fallback: true });
  }

  const coords =
    body.data.lat != null && body.data.lng != null
      ? { lat: body.data.lat, lng: body.data.lng }
      : null;

  const result = await runNlSearch(parsed, coords);
  return NextResponse.json(result);
}
