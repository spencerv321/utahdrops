import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

/**
 * Direct Postgres connection (bypasses RLS — server code only).
 * Locally this is the Supabase CLI stack; in production the Supabase pooler URL.
 *
 * Serverless instances each hold their own pool, so keep it small there (the
 * session-mode pooler caps total clients at its pool_size). Use the
 * transaction-mode pooler URL (port 6543) on Vercel. Jobs in the Actions
 * runner are a single process and can use more.
 */
export const sql =
  globalThis.__sql ??
  postgres(process.env.DATABASE_URL!, {
    max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
    idle_timeout: 20,
    prepare: false, // required for Supabase transaction-mode pooling
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
