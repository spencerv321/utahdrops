import { sql } from "@/lib/db";
import { MAX_HOME_STORES, MAX_WATCHLIST } from "@/lib/config";

/**
 * "Watch this bottle" for signed-out visitors. The request (bottle, optional
 * store, email) is saved before the sign-in email goes out; the email link
 * carries only its random id. After the visitor verifies, the watch is added
 * once, for the account with that email, within INTENT_TTL_HOURS.
 *
 * Applying is idempotent: a repeated callback reports the same watch and never
 * removes anything. Ordinary sign-ins carry no intent, so they add nothing.
 */
export const INTENT_TTL_HOURS = 24;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isIntentId = (id: unknown): id is string => typeof id === "string" && UUID.test(id);

export type IntentStatus = "added" | "already" | "expired" | "mismatch" | "full" | "not_found";
export type StoreStatus = "added" | "already" | "full" | null;

export interface IntentResult {
  status: IntentStatus;
  csc: string | null;
  storeId: number | null;
  store: StoreStatus;
}

/** Save a watch request. Caller validates the email and rate limits. */
export async function createWatchIntent(email: string, csc: string, storeId: number | null): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    insert into watch_intents (email, csc, store_id)
    select ${email.toLowerCase()}, p.csc, s.id
    from products p
    left join stores s on s.id = ${storeId}
    where p.csc = ${csc} and (${storeId}::int is null or s.id is not null)
    returning id`;
  // Keep the table small: requests are only useful for a day.
  if (Math.random() < 0.05) {
    await sql`delete from watch_intents where created_at < now() - interval '14 days'`;
  }
  return rows[0]?.id ?? null;
}

/** The bottle and store a request was for (to re-offer it after a failed link). */
export async function peekWatchIntent(id: string): Promise<{ csc: string; storeId: number | null } | null> {
  if (!isIntentId(id)) return null;
  const rows = await sql<{ csc: string; store_id: number | null }[]>`
    select csc, store_id from watch_intents
    where id = ${id} and created_at > now() - make_interval(hours => ${INTENT_TTL_HOURS})`;
  return rows[0] ? { csc: rows[0].csc, storeId: rows[0].store_id } : null;
}

/** Add the requested watch (and store) for this signed-in user. */
export async function applyWatchIntent(id: string, user: { id: string; email?: string | null }): Promise<IntentResult> {
  const none: IntentResult = { status: "not_found", csc: null, storeId: null, store: null };
  if (!isIntentId(id)) return none;

  return sql.begin(async (tx) => {
    const [intent] = await tx<
      { csc: string; store_id: number | null; email: string; applied_user: string | null; expired: boolean }[]
    >`
      select csc, store_id, email, applied_user,
             created_at < now() - make_interval(hours => ${INTENT_TTL_HOURS}) as expired
      from watch_intents where id = ${id}
      for update`;
    if (!intent) return none;
    const base = { csc: intent.csc, storeId: intent.store_id };

    if (!user.email || intent.email !== user.email.toLowerCase()) return { ...base, status: "mismatch", store: null };
    // Already applied for this account: report the current state, change nothing.
    if (intent.applied_user) {
      if (intent.applied_user !== user.id) return { ...base, status: "mismatch", store: null };
      const [w] = await tx`select 1 from watchlist where user_id = ${user.id} and csc = ${intent.csc}`;
      return { ...base, status: w ? "already" : "not_found", store: null };
    }
    if (intent.expired) return { ...base, status: "expired", store: null };

    const [{ n, has }] = await tx<{ n: number; has: boolean }[]>`
      select count(*)::int as n, bool_or(csc = ${intent.csc}) as has
      from watchlist where user_id = ${user.id}`;
    let status: IntentStatus;
    if (has) status = "already";
    else if (n >= MAX_WATCHLIST) status = "full";
    else {
      await tx`insert into watchlist (user_id, csc) values (${user.id}, ${intent.csc}) on conflict do nothing`;
      status = "added";
    }

    let store: StoreStatus = null;
    if (intent.store_id != null && status !== "full") {
      const mine = await tx<{ store_id: number }[]>`select store_id from user_stores where user_id = ${user.id}`;
      if (mine.some((s) => s.store_id === intent.store_id)) store = "already";
      else if (mine.length >= MAX_HOME_STORES) store = "full";
      else {
        await tx`insert into user_stores (user_id, store_id) values (${user.id}, ${intent.store_id}) on conflict do nothing`;
        store = "added";
      }
    }

    if (status !== "full") {
      await tx`update watch_intents set applied_at = now(), applied_user = ${user.id} where id = ${id}`;
    }
    return { ...base, status, store };
  });
}
