import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

/**
 * Supabase's transaction-mode pooler (port 6543) is opt-in via
 * DB_TRANSACTION_POOLER=1. On Vercel it left connections stuck until the
 * database's 2-minute statement timeout, hanging every page queued behind
 * them, while the session-mode pooler (5432, what the jobs use) never has.
 * Session mode used to run out of connections (EMAXCONNSESSION) when idle
 * connections lingered; they now close after 2s (see idle_timeout below).
 */
export function resolveDatabaseUrl(url: string, onVercel: boolean): string {
  if (!onVercel || process.env.DB_TRANSACTION_POOLER !== "1") return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".pooler.supabase.com") && u.port === "5432") {
      u.port = "6543";
      return u.toString();
    }
  } catch {
    // not a URL we understand — use as-is
  }
  return url;
}

const onVercel = Boolean(process.env.VERCEL);

/**
 * Direct Postgres connection (bypasses RLS — server code only).
 * Locally this is the Supabase CLI stack; in production the Supabase pooler URL.
 * Serverless instances keep a small pool.
 */
export const sql =
  globalThis.__sql ??
  postgres(resolveDatabaseUrl(process.env.DATABASE_URL!, onVercel), {
    max: Number(process.env.DB_POOL_MAX ?? (onVercel ? 3 : 10)),
    // Vercel freezes the function between requests, and a connection left
    // open while frozen dies silently: the next page's queries then wait on it
    // forever (the "pages never load" bug). So close idle connections fast;
    // releaseIdleConnections() keeps the function awake long enough to do it.
    idle_timeout: onVercel ? 2 : 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    prepare: false, // required for Supabase transaction-mode pooling
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
