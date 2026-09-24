import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { releaseIdleConnections } from "@/lib/db-release";
import { SITE_URL } from "@/lib/config";
import { browserOf, deviceOf, isBot, osOf, referrerHost, sourceOf } from "@/lib/analytics";
import { recordDiscoverEvent } from "@/lib/discover-events";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Page-view beacon from components/page-tracker.tsx. Always answers 204:
 * analytics must never surface an error to a visitor.
 */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(2048)
    .transform((s) => s.slice(0, max) || null)
    .nullish();

const Body = z.object({
  path: z.string().startsWith("/").max(512),
  q: text(200),
  visitor: z.string().regex(/^[\w-]{8,64}$/),
  session: z.string().regex(/^[\w-]{8,64}$/),
  user: z.uuid().nullish(),
  landing: z.boolean().default(false),
  referrer: text(2048),
  utm_source: text(100),
  utm_medium: text(100),
  utm_campaign: text(150),
});

/** An action on a "Worth a look" result (lib/beacon.ts sendDiscoverEvent). */
const Action = z.object({
  action: z.object({
    kind: z.enum(["click", "watch_click", "useful_yes", "useful_no"]),
    source: z.string().max(40),
    csc: z.string().regex(/^\d{6}$/).nullish(),
  }),
  visitor: z.string().regex(/^[\w-]{8,64}$/),
});

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

function decode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function header(req: NextRequest, name: string): string | null {
  const v = req.headers.get(name);
  return v ? decode(v).slice(0, 100) : null;
}

export async function POST(req: NextRequest) {
  releaseIdleConnections();
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return NO_CONTENT();

  const json = await req.json().catch(() => null);
  const action = Action.safeParse(json);
  if (action.success) {
    const a = action.data;
    const user = await getCurrentUser().catch(() => null);
    await recordDiscoverEvent(a.action.kind, a.action.source, { csc: a.action.csc, visitorId: a.visitor, user });
    return NO_CONTENT();
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NO_CONTENT();
  const b = parsed.data;
  if (b.path.startsWith("/admin") || b.path.startsWith("/api")) return NO_CONTENT();

  const ownHost = new URL(SITE_URL).hostname;
  // Only the landing view carries a referrer; later views are internal clicks.
  const host = b.landing ? referrerHost(b.referrer, ownHost) : null;
  const utmSource = b.landing ? b.utm_source ?? null : null;
  const csc = b.path.match(/^\/product\/([^/?#]+)/)?.[1] ?? null;

  try {
    await sql`
      insert into page_events (
        path, search_query, csc, visitor_id, session_id, user_id, is_landing,
        referrer_host, source, utm_source, utm_medium, utm_campaign,
        country, region, city, device, browser, os
      ) values (
        ${b.path}, ${b.path === "/search" ? b.q ?? null : null},
        ${csc ? decode(csc).slice(0, 64) : null},
        ${b.visitor}, ${b.session}, ${b.user ?? null}, ${b.landing},
        ${host}, ${b.landing ? sourceOf(host, utmSource) : null}, ${utmSource},
        ${b.landing ? b.utm_medium ?? null : null}, ${b.landing ? b.utm_campaign ?? null : null},
        ${header(req, "x-vercel-ip-country")}, ${header(req, "x-vercel-ip-country-region")},
        ${header(req, "x-vercel-ip-city")},
        ${deviceOf(ua)}, ${browserOf(ua)}, ${osOf(ua)}
      )`;
  } catch (err) {
    console.error("[events] insert failed", err instanceof Error ? err.message : err);
  }
  return NO_CONTENT();
}
