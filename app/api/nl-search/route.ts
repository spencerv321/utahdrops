import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQuery } from "@/lib/nl/parse";
import { runNlSearch } from "@/lib/nl/search";

export const maxDuration = 30;

const Body = z.object({
  query: z.string().min(2).max(300),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const body = Body.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const parsed = await parseQuery(body.data.query);
  if (!parsed) {
    // No API key or low-confidence parse → caller falls back to plain FTS
    return NextResponse.json({ fallback: true });
  }

  const coords =
    body.data.lat != null && body.data.lng != null
      ? { lat: body.data.lat, lng: body.data.lng }
      : null;

  const result = await runNlSearch(parsed, coords);
  return NextResponse.json(result);
}
