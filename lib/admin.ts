import type { User } from "@supabase/supabase-js";

/**
 * Admins are listed by email in ADMIN_EMAILS (comma-, semicolon- or
 * space-separated; stray quotes are ignored). They sign in with the normal
 * magic link. No list configured means nobody is an admin.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .replace(/^\s*ADMIN_EMAILS\s*=/i, "")
    .split(/[\s,;]+/)
    .map((e) => e.replace(/["'<>]/g, "").trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isAdmin(user: Pick<User, "email"> | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email) && adminEmails().includes(email!);
}

/**
 * Owner test addresses ("name+test@…", "name+test2@…") behave like real
 * accounts everywhere except analytics, where they would read as visitors.
 */
export function isTestEmail(email: string | null | undefined): boolean {
  return /\+test[^@]*@/i.test(email ?? "");
}

/** Admins and test accounts: left out of page views and discover_events. */
export function isUntracked(user: Pick<User, "email"> | null | undefined): boolean {
  return isAdmin(user) || isTestEmail(user?.email);
}
