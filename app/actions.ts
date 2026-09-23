"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { MAX_HOME_STORES } from "@/lib/config";

/** Watchlisted SKUs get scrape priority, so keep one account from hogging it. */
const MAX_WATCHLIST = 50;

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const Signup = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  segment: z.enum(["consumer", "bar_restaurant", "supplier", "other"]).default("consumer"),
});

/**
 * Records who signed up and which segment they're in (the demand-validation
 * instrument). The client then sends a magic link so the address gets real
 * alerts rather than sitting in a list nothing reads.
 */
export async function signUpForEmails(formData: FormData) {
  const parsed = Signup.safeParse({
    email: formData.get("email"),
    segment: formData.get("segment") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const { email, segment } = parsed.data;
  await sql`
    insert into email_signups (email, segment) values (${email}, ${segment})
    on conflict (email) do update set segment = excluded.segment`;
  return { ok: true, email };
}

const Csc = z.string().regex(/^\d{6}$/);

export async function toggleWatch(csc: string, watched: boolean) {
  const user = await currentUser();
  if (!user) return { ok: false, error: "not_signed_in" };
  const parsed = Csc.safeParse(csc);
  if (!parsed.success || typeof watched !== "boolean") return { ok: false, error: "bad_request" };

  if (watched) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from watchlist where user_id = ${user.id}`;
    if (n >= MAX_WATCHLIST) return { ok: false, error: "watchlist_full" };
    const inserted = await sql`
      insert into watchlist (user_id, csc)
      select ${user.id}, csc from products where csc = ${parsed.data}
      on conflict do nothing
      returning 1`;
    if (inserted.length === 0) {
      const exists = await sql`select 1 from products where csc = ${parsed.data}`;
      if (exists.length === 0) return { ok: false, error: "not_found" };
    }
  } else {
    await sql`delete from watchlist where user_id = ${user.id} and csc = ${parsed.data}`;
  }
  revalidatePath(`/product/${parsed.data}`);
  revalidatePath("/watchlist");
  return { ok: true };
}

const Prefs = z.object({
  watchlistEmail: z.boolean().optional(),
  allocatedEmail: z.boolean().optional(),
});

export async function setAlertPrefs(prefs: { watchlistEmail?: boolean; allocatedEmail?: boolean }) {
  const user = await currentUser();
  if (!user) return { ok: false, error: "not_signed_in" };
  const parsed = Prefs.safeParse(prefs);
  if (!parsed.success) return { ok: false, error: "bad_request" };
  const { watchlistEmail, allocatedEmail } = parsed.data;

  await sql`
    insert into alert_prefs (user_id, watchlist_email, allocated_email)
    values (${user.id}, ${watchlistEmail ?? true}, ${allocatedEmail ?? false})
    on conflict (user_id) do update set
      watchlist_email = coalesce(${watchlistEmail ?? null}, alert_prefs.watchlist_email),
      allocated_email = coalesce(${allocatedEmail ?? null}, alert_prefs.allocated_email),
      updated_at = now()`;
  revalidatePath("/watchlist");
  return { ok: true };
}

const StoreIds = z.array(z.number().int().positive()).max(MAX_HOME_STORES);

/** Replace the user's home stores (used for "back at my store" alerts). */
export async function setHomeStores(storeIds: number[]) {
  const user = await currentUser();
  if (!user) return { ok: false, error: "not_signed_in" };
  const parsed = StoreIds.safeParse([...new Set(storeIds)]);
  if (!parsed.success) return { ok: false, error: "bad_request" };

  await sql.begin(async (tx) => {
    await tx`delete from user_stores where user_id = ${user.id}`;
    if (parsed.data.length > 0) {
      await tx`
        insert into user_stores (user_id, store_id)
        select ${user.id}, id from stores where id = any(${parsed.data}::int[])`;
    }
  });
  revalidatePath("/watchlist");
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
