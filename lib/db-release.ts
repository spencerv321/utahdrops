import { after } from "next/server";

/**
 * Call once per request (the root layout does). After the response is sent,
 * stay awake past the pool's 2s idle_timeout so its connections close cleanly
 * before Vercel freezes the instance; see lib/db.ts.
 */
export function releaseIdleConnections() {
  if (!process.env.VERCEL) return;
  after(() => new Promise<void>((resolve) => setTimeout(resolve, 2_500)));
}
