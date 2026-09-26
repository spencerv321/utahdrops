import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/config";
import { resolveDestination } from "@/lib/auth-next";

/**
 * Every email link lands here (docs/auth-email-templates.md).
 *   ?token_hash=…&type=email   token-hash template: verified server-side, so
 *                              it works in any browser or device
 *   ?code=…                    Supabase's default link (PKCE): completes only
 *                              in the browser that asked for it
 * The destination is `to=` (base64url path) or the template's
 * `next={{ .RedirectTo }}`; only same-site destinations are followed, as
 * canonical paths (lib/auth-next.ts).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = resolveDestination(searchParams, [origin, new URL(SITE_URL).origin]);

  const code = searchParams.get("code");

  const supabase = await createClient();
  // Checked first: a failed verification can clear the current session.
  const { data: current } = await supabase.auth.getUser();
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    // A brand-new account gets Supabase's "Confirm signup" email, whose link
    // comes back here with ?code= instead of a token_hash. Without this,
    // first-time sign-ups were confirmed but never signed in.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  // A used or expired link opened in a browser that's already signed in (the
  // email tapped twice): carry on instead of asking for a new link. The
  // destination re-checks who is signed in (/watch/confirm is email-bound).
  if (current.user) return NextResponse.redirect(new URL(next, request.url));
  // A ?code= link that failed was most likely opened in another browser or device.
  const reason = code && !tokenHash ? "link-browser" : "link";
  return NextResponse.redirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, request.url));
}
