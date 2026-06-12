import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

/**
 * Direct Postgres connection (bypasses RLS — server code only).
 * Locally this is the Supabase CLI stack; in production the Supabase pooler URL.
 */
export const sql =
  globalThis.__sql ??
  postgres(process.env.DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
    prepare: false, // required for Supabase transaction-mode pooling
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
