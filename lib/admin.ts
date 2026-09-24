import type { User } from "@supabase/supabase-js";

/**
 * Admins are listed by email in ADMIN_EMAILS (comma-separated). They sign in
 * with the normal magic link. No list configured means nobody is an admin.
 */
export function isAdmin(user: Pick<User, "email"> | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}
