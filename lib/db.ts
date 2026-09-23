import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

/**
 * On Vercel, many short-lived instances each open their own pool, which
 * exhausted Supabase's session-mode pooler (EMAXCONNSESSION). Its
 * transaction-mode pooler on the same host (port 6543) multiplexes instead,
 * so switch to it automatically. Jobs in the Actions runner (one long process)
 * keep the URL as given.
 */
export function resolveDatabaseUrl(url: string, onVercel: boolean): string {
  if (!onVercel) return url;
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
    idle_timeout: 20,
    prepare: false, // required for Supabase transaction-mode pooling
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
