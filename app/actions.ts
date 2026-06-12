"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function signUpForEmails(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const segment = String(formData.get("segment") ?? "consumer");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!["consumer", "bar_restaurant", "supplier", "other"].includes(segment)) {
    return { ok: false, error: "Pick a segment." };
  }
  await sql`
    insert into email_signups (email, segment) values (${email}, ${segment})
    on conflict (email) do update set segment = excluded.segment`;
  return { ok: true };
}

export async function toggleWatch(csc: string, watched: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  if (watched) {
    await sql`
      insert into watchlist (user_id, csc) values (${user.id}, ${csc})
      on conflict do nothing`;
  } else {
    await sql`delete from watchlist where user_id = ${user.id} and csc = ${csc}`;
  }
  revalidatePath(`/product/${csc}`);
  revalidatePath("/watchlist");
  return { ok: true };
}

export async function setAlertPrefs(prefs: { watchlistEmail?: boolean; allocatedEmail?: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  await sql`
    insert into alert_prefs (user_id, watchlist_email, allocated_email)
    values (${user.id}, ${prefs.watchlistEmail ?? true}, ${prefs.allocatedEmail ?? false})
    on conflict (user_id) do update set
      watchlist_email = coalesce(${prefs.watchlistEmail ?? null}, alert_prefs.watchlist_email),
      allocated_email = coalesce(${prefs.allocatedEmail ?? null}, alert_prefs.allocated_email),
      updated_at = now()`;
  revalidatePath("/watchlist");
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
