import { sql } from "@/lib/db";

/**
 * Fixed-window counter in Postgres (no extra service). Returns true while the
 * key is within `limit` hits for the current window.
 */
export async function withinLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [{ count }] = await sql<{ count: number }[]>`
    insert into rate_limits (key, window_start, count)
    values (
      ${key},
      to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}),
      1
    )
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  // Occasionally sweep old windows so the table stays tiny.
  if (Math.random() < 0.01) {
    await sql`delete from rate_limits where window_start < now() - interval '2 days'`;
  }
  return count <= limit;
}

/** Client IP as seen by Vercel's proxy (first X-Forwarded-For hop). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
