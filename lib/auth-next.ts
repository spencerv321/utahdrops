/**
 * Where /auth/confirm sends someone after an email link. `next` arrives in
 * one of three shapes, depending on the Supabase email template
 * (docs/auth-email-templates.md):
 *   "/watch/confirm?intent=…"                         (emailRedirectTo's own ?next=)
 *   "https://utahdrops.com/auth/confirm?next=%2F…"    (template passes {{ .RedirectTo }} as next)
 *   "https://utahdrops.com"                           (Supabase fell back to the Site URL)
 * Only same-site destinations survive; anything else is "/".
 */
export function resolveNext(raw: string | null | undefined, origins: string[], depth = 0): string {
  if (!raw) return "/";
  if (raw.startsWith("/")) {
    if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
    return unwrap(new URL(raw, "http://x"), raw, origins, depth);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "/";
  }
  if (!origins.includes(url.origin)) return "/";
  return unwrap(url, `${url.pathname}${url.search}${url.hash}`, origins, depth);
}

/** A destination that is itself /auth/confirm?next=… points at its own next (once). */
function unwrap(url: URL, path: string, origins: string[], depth: number): string {
  if (url.pathname !== "/auth/confirm") return path || "/";
  return depth === 0 ? resolveNext(url.searchParams.get("next"), origins, 1) : "/";
}
