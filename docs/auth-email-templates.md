# Sign-in emails that work in any browser

_Prepared 2026-09-26, revised after the owner inspected hosted Supabase the
same day. Change nothing in Supabase until PR #39 is deployed._

## Where things stand (owner-inspected, 2026-09-26)

| Template | Link today | Works in another browser/device? |
|---|---|---|
| **Magic Link** (every sign-in after the first) | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` | **Yes.** It's a token-hash link, checked on our server (`verifyOtp`) |
| **Confirm signup** (first email to a new address) | `{{ .ConfirmationURL }}` (Supabase default) | **No.** It returns `/auth/confirm?code=…`, which only completes in the browser that asked for it |

So only **first-time** sign-ups are browser-bound. That's why the owner's
Sep 24 test (a new `+test` address, opened in another browser) failed, while
returning sign-ins have worked.

## The change: one template (after PR #39 is live)

**Confirm signup:** use the same link form as the hosted Magic Link template
(already proven in production):

```html
<h2>Finish signing in to Utah Drops</h2>
<p>Tap below to confirm {{ .Email }} and sign in. If you asked to watch a bottle, you'll be watching it as soon as the page opens.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm and sign in</a></p>
<p>The link works once, for an hour, on any phone or computer.</p>
<p>Didn't ask for this? Ignore this email; nothing happens.</p>
```

Subject: `Your Utah Drops sign-in link` (replaces "Confirm your email
address", which reads like phishing).

**Magic Link:** keep the link exactly as it is. Changing the copy to match is
optional:

```html
<h2>Sign in to Utah Drops</h2>
<p>Tap below to sign in as {{ .Email }}. If you asked to watch a bottle, you'll be watching it as soon as the page opens.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>The link works once, for an hour, on any phone or computer.</p>
<p>Didn't ask for this? Ignore this email; nothing happens.</p>
```

### Why deploy first

PR #39 changes what `{{ .RedirectTo }}` contains: the destination now travels
as `…/auth/confirm?to=<base64url path>` instead of a nested
`?next=%2F…` (`lib/auth-next.ts`). The base64url alphabet (`A–Z a–z 0–9 - _`)
means the same thing whether the template inserts it raw or escaped. The old
nested form broke on a second decode: `/search?q=gin&sort=price_asc` became
`/search?q=gin` (Codex review, finding 1).

`/auth/confirm` keeps accepting every form, so nothing breaks during the
switch:
- `?to=…&code=…`: the default link after deploy
- `?to=…&token_hash=…`: the Magic Link form above after deploy
- `?next=/path&…`: links emailed before the deploy, including today's Magic Link
- `?token_hash=…&next={{ .RedirectTo }}`: the alternative template form from the
  first draft of this doc (not needed now)

`tests/auth-next.test.ts` runs 10 destinations through each of these forms:
several parameters, `%26`, `%25`, `+`, non-ASCII text, fragments, and the
watch and welcome paths.

## What stays the same (verified in code and tests)

| Property | Where | Evidence |
|---|---|---|
| Destination kept exactly, whichever link form | `lib/auth-next.ts`, `app/auth/confirm/route.ts` | `tests/auth-next.test.ts` |
| Only same-site destinations, returned as canonical paths | `safePath` | Adversarial cases: tab/newline/CR, backslashes, `//`, `https:host`, `javascript:`, percent-encoded controls |
| Watch is **email-bound**: only the account whose email made the request gets it | `lib/watch-intent.ts` `applyWatchIntent` (unchanged) | `tests/db/watch-intent.test.ts` |
| **Idempotent**: replaying a link never duplicates or removes a watch, and an old link doesn't re-add one you removed | same | same (11 tests) |
| Request expires after 24h and adds nothing | same | same |
| Attribution survives confirmation; `watch_added` written once, only for a new watch | `watch_intents.source` → `recordDiscoverEvent` | same |

### Security note: a weakness `main` already has (not introduced by this PR)

`main`'s `/auth/confirm` checked `next` with a string prefix test
(`startsWith("/")`, not `//`, not `/\`). A value such as `/<TAB>/example.com`
or `/<LF>/example.com` passes that test, and browsers strip tabs and
newlines, so `new URL(next, "https://utahdrops.com")` resolves to
`https://example.com/`. That's an open redirect after sign-in. Codex found it
and it was reproduced locally only (no live probing). PR #39 fixes it by
parsing against our origin first, checking the parsed origin and returning
the canonical path. It stays open on `main` until #39 deploys.

## Configuration: verified vs. assumed

**Verified:**
- Magic Link template = `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
  (owner, dashboard, 2026-09-26).
- Confirm signup template = `{{ .ConfirmationURL }}` (owner, same day).
- `emailRedirectTo` values under `https://utahdrops.com/auth/confirm` are
  honored. The Sep 24 test landed on `/watch/confirm?intent=…`, and returning
  users' Magic Links, which start with `{{ .RedirectTo }}`, work.
- First-time same-browser sign-in worked on Sep 25 (`report.yml` → `auth`).

**Assumed; check when editing:**
1. **Redirect URLs** allow `https://utahdrops.com/auth/confirm` with any query
   (e.g. `https://utahdrops.com/**`). If a value isn't allowed, Supabase puts
   the Site URL in `{{ .RedirectTo }}`, and this link form becomes
   `https://utahdrops.com&token_hash=…`, which doesn't work. The Magic Link
   template already has this dependency and works today.
2. `type=email` confirms a new sign-up through `verifyOtp` (Supabase's
   server-side auth guide uses it for Confirm signup). The checklist below
   proves it.
3. Email OTP expiry is 3600 s ("works for an hour").

**Known risk (not new):** mail scanners that open links first use up the
one-time link. If `auth` shows confirmed-but-never-signed-in accounts after
the change, add a "Tap to continue" step.

## End-to-end check (owner, `+test` addresses only; no real users)

Use a fresh `yourname+testN@gmail.com` for each first-time case. `+test`
accounts get real watches but are left out of analytics, and so is every
browser they've used.

**After #39 is deployed, before the template edit:**
1. [ ] Returning user, other browser: an existing `+test` address, Watch on a
   product, open the Magic Link email in a *different* browser → watching.
   This proves the hosted Magic Link form with the new `to=` destination.
2. [ ] First-time, same browser: a new address → Confirm signup email (still
   the default link) → watching.

**After the Confirm signup edit:**

3. [ ] First-time, other device: request on the laptop, open on the phone →
   the phone is signed in and watching.
4. [ ] "Also at my store": the store is added as a home store (max 3), and
   the watch too.
5. [ ] Replay: tap the same email link again, in both browsers. Still exactly
   one watch; nothing removed.
6. [ ] Replay after unwatching: remove it on `/watchlist`, tap the old link →
   **not** re-added.
7. [ ] Wrong account: open a *used* link in a browser signed in as your main
   account → the product page names both addresses and adds nothing.
8. [ ] Expired: a link older than 1h → "Links work once and expire after an
   hour", with the bottle choice kept.
9. [ ] Plain sign-in from
   `/login?next=%2Fsearch%3Fq%3Dgin%2526tonic%26sort%3Dprice_asc` lands on
   exactly `/search?q=gin%26tonic&sort=price_asc`. The footer signup lands on
   `/watchlist?welcome=1`.

**Then confirm in the data (read-only):**
- `report.yml` → `auth`: each new `+test` account is confirmed and signed in,
  with no second link.
- `report.yml` → `funnel`: `watch_intents` rows with `test_address = true`
  are applied; no `discover_events` from those browsers.
