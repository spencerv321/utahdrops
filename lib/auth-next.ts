/**
 * Where an email sign-in link lands after /auth/confirm.
 *
 * The destination travels as `to=<base64url of the path>`: only [A-Za-z0-9_-],
 * so it survives Supabase inserting {{ .RedirectTo }} raw or escaped, and any
 * number of decodes. (A nested `next=%2Fsearch%3Fq%3Dgin%26sort%3D…` does not:
 * decoded twice it loses everything after the first `&`.)
 *
 * /auth/confirm accepts, in order:
 *   ?to=…                                     default link (Supabase appends ?code=)
 *   ?next=https://utahdrops.com/auth/confirm?to=…   token-hash template ({{ .RedirectTo }})
 *   ?next=/path                               links sent before the `to=` form
 *   ?next=https://utahdrops.com               Supabase fell back to the Site URL -> "/"
 * Every result goes through safePath: same site only, returned as a canonical path.
 */

const B64URL = /^[A-Za-z0-9_-]{1,2800}$/;

/** base64url of the UTF-8 path. Works in browsers and Node. */
export function encodeDest(path: string): string {
  const bytes = new TextEncoder().encode(path);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDest(v: string | null | undefined): string | null {
  if (!v || !B64URL.test(v)) return null;
  try {
    const bin = atob(v.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** The emailRedirectTo for a sign-in link that should end at `dest` (a same-site path). */
export function confirmRedirect(origin: string, dest: string): string {
  return `${origin}/auth/confirm?to=${encodeDest(dest)}`;
}

/**
 * A same-site destination as a canonical path ("/x?y#z"), or "/" for anything
 * else. The value is parsed as a URL against our own origin first (which
 * strips tabs/newlines and turns backslashes into slashes, exactly as a
 * browser would), then the parsed origin is checked, so "/\t/evil.com" and
 * "/\\evil.com" can't slip past a prefix check.
 */
export function safePath(raw: string | null | undefined, origins: string[]): string {
  if (!raw || origins.length === 0) return "/";
  let url: URL;
  try {
    url = new URL(raw, origins[0]);
  } catch {
    return "/";
  }
  if (!origins.includes(url.origin)) return "/";
  // "//x" as a path would be read as another host when redirected.
  const path = url.pathname.replace(/^\/+/, "/");
  return `${path}${url.search}${url.hash}`;
}

/** Where to go after /auth/confirm, from its query string. */
export function resolveDestination(params: URLSearchParams, origins: string[]): string {
  const to = decodeDest(params.get("to"));
  if (to != null) return finalPath(to, origins);
  return fromNext(params.get("next"), origins);
}

/** `next`: an old-style path, or the template's {{ .RedirectTo }} (our /auth/confirm URL). */
function fromNext(raw: string | null, origins: string[]): string {
  const path = safePath(raw, origins);
  const url = new URL(path, "http://x");
  if (url.pathname !== "/auth/confirm") return path;
  // One level only: the wrapped /auth/confirm's own `to` (or legacy `next` path).
  const to = decodeDest(url.searchParams.get("to"));
  if (to != null) return finalPath(to, origins);
  return finalPath(url.searchParams.get("next"), origins);
}

/** A decoded destination: safe, and never another /auth/confirm (no loops). */
function finalPath(raw: string | null, origins: string[]): string {
  const path = safePath(raw, origins);
  return path.startsWith("/auth/confirm") ? "/" : path;
}
