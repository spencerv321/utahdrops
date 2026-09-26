# Sign-in emails that work in any browser

_Prepared 2026-09-26. Owner action in the hosted Supabase dashboard; nothing
here has been applied to production._

## Why

Today every sign-in email uses Supabase's default link (`{{ .ConfirmationURL }}`).
With the PKCE flow `@supabase/ssr` uses, that link returns to
`/auth/confirm?code=…`, and the code can only be exchanged in **the browser
that asked for it**. Open the email on your phone after asking on your laptop,
or in a different browser, and nobody gets signed in. For a watch request,
that means the watch is never added. The owner's Sep 24 test hit exactly this.

A token-hash link (`/auth/confirm?token_hash=…&type=email`) is checked on our
server with `verifyOtp`, so it works in any browser or device.
`/auth/confirm` has handled `token_hash` since PR #16. This change makes it
accept the template below too.

## The change (dashboard → Authentication → Emails → Templates)

Change two templates: **Confirm signup** (first email to a new address) and
**Magic Link** (every later sign-in). Leave the others alone. The site doesn't
use Invite, Change email, Reset password or Reauthentication; the invite
job sends its own email.

### Confirm signup

Subject:

```
Your Utah Drops sign-in link
```

Body (source view):

```html
<h2>Finish signing in to Utah Drops</h2>
<p>Tap below to confirm {{ .Email }} and sign in. If you asked to watch a bottle, you'll be watching it as soon as the page opens.</p>
<p><a href="https://utahdrops.com/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm and sign in</a></p>
<p>The link works once, for an hour, on any phone or computer.</p>
<p>Didn't ask for this? Ignore this email; nothing happens.</p>
```

### Magic Link

Subject:

```
Your Utah Drops sign-in link
```

Body:

```html
<h2>Sign in to Utah Drops</h2>
<p>Tap below to sign in as {{ .Email }}. If you asked to watch a bottle, you'll be watching it as soon as the page opens.</p>
<p><a href="https://utahdrops.com/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Sign in</a></p>
<p>The link works once, for an hour, on any phone or computer.</p>
<p>Didn't ask for this? Ignore this email; nothing happens.</p>
```

Notes on the link:
- **`https://utahdrops.com` is written out** instead of `{{ .SiteURL }}`, so a
  wrong Site URL setting can't send people to localhost or a preview.
- **`next={{ .RedirectTo }}` is last.** `RedirectTo` is the full
  `emailRedirectTo` the site sent, e.g.
  `https://utahdrops.com/auth/confirm?next=%2Fwatch%2Fconfirm%3Fintent%3D…`.
  `/auth/confirm` unwraps it back to `/watch/confirm?intent=…`
  (`lib/auth-next.ts`, tested encoded and unencoded). Anything off-site
  becomes `/`.
- `type=email` covers both new and returning addresses (`verifyOtp` type
  `email`), as in Supabase's server-side auth guide.
- The copy drops the generic "Confirm your email address" wording, which
  reads like phishing.

## What stays the same (verified in code and tests)

| Property | Where | Evidence |
|---|---|---|
| Destination kept (watch → `/watch/confirm?intent=…`, footer → `/watchlist?welcome=1`, login → `next`) | `lib/auth-next.ts`, `app/auth/confirm/route.ts` | `tests/auth-next.test.ts` (both template forms, Site-URL fallback, off-site rejected) |
| Watch is **email-bound**: only the account whose email made the request gets it | `lib/watch-intent.ts` `applyWatchIntent` | `tests/db/watch-intent.test.ts` "only the account with the requested email…" |
| **Idempotent**: replaying the link never duplicates or removes a watch | same | "adds the watch and store once; repeated callbacks change nothing" and "replaying a used link after unwatching neither re-adds nor removes anything" |
| Request expires after 24h and adds nothing | same | "expired requests add nothing" |
| Attribution survives confirmation, and `watch_added` is written once, only for a new watch | `watch_intents.source` → `recordDiscoverEvent` | "attribution rides through confirmation…" |
| Old `?code=` links still work in the asking browser, and fail with a clear "open it in the browser you asked from" message elsewhere | `/auth/confirm` → `/login?error=link-browser` | Code review; unchanged path |

## Configuration: verified vs. assumed

**Verified:**
- Production honors `emailRedirectTo` pointing at
  `https://utahdrops.com/auth/confirm?next=…`. The Sep 24 owner test landed on
  `/watch/confirm?intent=…` (STATUS.md), so that URL is on the Redirect URLs
  allow list.
- Account 16 (Sep 25) was confirmed and signed in within the same second on
  its first link, so first-time `?code=` sign-in works in the same browser
  (`report.yml` → `auth`).

**Assumed; check in the dashboard when making the change:**
1. The two templates still use the defaults (`{{ .ConfirmationURL }}`).
   Nothing in the data shows they were changed.
2. **Redirect URLs** includes `https://utahdrops.com/**` (or
   `https://utahdrops.com/auth/confirm**`). If it doesn't, Supabase swaps in
   the Site URL: people still sign in, but land on the home page without the
   watch.
3. **Email OTP expiration** is 3600 s, matching "works for an hour".
4. The project uses Supabase's built-in email sender or a custom SMTP.
   Either way, templates apply the same.
5. The **flow type** stays PKCE (the `@supabase/ssr` default). Token-hash links
   don't depend on it.

**Known risk (not new):** some corporate mail scanners open links before the
person does, which uses up a one-time link. Today's default link has the same
problem. If `report.yml` → `auth` starts showing confirmed-but-never-signed-in
accounts after the change, add a "Tap to continue" step on `/auth/confirm`.

## End-to-end check (owner, `+test` addresses only; no real users)

Use a fresh `yourname+testN@gmail.com` for each first-time case. `+test`
accounts get real watches but are left out of analytics, and so is every
browser they've used.

**Before the template change (baseline):**
1. [ ] First-time, same browser: signed out, tap Watch on a product, then
   "Anywhere in Utah". Open the email in the same browser → product page says
   "You're watching…"; `/watchlist` lists it once.

**After the template change:**

2. [ ] First-time, other device: request on the laptop, open the email on the
   phone → the phone is signed in and shows "You're watching…".
3. [ ] Returning user, other browser: same address, a different bottle. The
   Magic Link email opened in another browser → watching, and the earlier
   watch is still there.
4. [ ] "Also at my store": the store is added as a home store (max 3), and
   the watch too.
5. [ ] Replay: tap the same email link again, in both browsers. Still exactly
   one watch; the page says watching; nothing is removed.
6. [ ] Replay after unwatching: remove the watch on `/watchlist`, tap the old
   link → the watch is **not** re-added and nothing else changes.
7. [ ] Wrong account: open a *used* link in a browser signed in as your main
   account → the product page names both addresses and adds nothing.
8. [ ] Expired: a link older than 1h → "Links work once and expire after an
   hour", and the bottle choice is kept for a fresh link.
9. [ ] Plain sign-in from `/login` and the footer signup still land on their
   pages (`/`, `/watchlist?welcome=1`).

**Then confirm in the data (read-only):**
- `report.yml` → `auth`: each new `+test` account is confirmed and signed in,
  with no second link.
- `report.yml` → `funnel`: `watch_intents` rows for the `+test` addresses
  appear under `test_address = true` as applied. `discover_events` has
  **no** rows from those browsers (they're untracked).
