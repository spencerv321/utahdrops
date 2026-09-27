# Production baseline — 2026-09-26

Snapshot of production as of **2026-09-26 ~20:00 UTC**, before the next round of
product-page and discovery work. Every number below comes from read-only
`report.yml` runs, the public `/api/health` endpoint and GitHub Actions run
history. The figures are aggregates only: no emails, user ids, visitor ids or
raw search text. No emails were sent and no production settings changed.

Sources (`report.yml` input → Actions run number):
`freshness` (#47), `checks` (#48), `auth` (#49), `48` (#50), `searchlog` (#51),
`discover` (#52), `storecoverage` (#54), and `funnel` (#53, a new read-only
mode added with this document, run from its branch).

---

## TL;DR

| Area | State | Blocks UI work? |
|---|---|---|
| Jobs & health | All green. `/api/health` ok; catalog 3×/day; store job healthy after PR #38 | No |
| Watched bottles | 38 of 38 checked within the 12h target; 0 overdue; 0 failing | No |
| Ordinary rotation | Every in-stock product has now been attempted at least once, but **1,748 in-stock products (32%) are still > 7 days old**, so they show as "unknown" | **Yes, for any UI that promises nearby availability** (see §4) |
| Allocated/limited listings | 1,585 in-stock; **2.1% checked within 72h** | **Yes, for discovery** (Scarce view: 0 of 10 confirmed nearby anywhere) |
| Store-check failures | 5 SKUs, all known DABS HTTP 500s, backing off; none watched | No |
| First-time sign-in | Fix is in code; **one** production account since then signed in with its first link. Not yet verified by a planned owner test | Not a blocker; owner test still owed |
| Cross-device email links | **Not working by design** until the owner switches the Supabase email templates to token-hash links. Not done as far as we can tell | Blocks any UI that relies on "tap the email on your phone" |
| Signed-out watch confirmation | Code path is idempotent and email-bound. In production: **2 requests, 0 applied, 0 new watches of any kind since Sep 24**. The only owner test opened the link in another browser, which correctly refused it. Same-browser owner retest still pending | Not a blocker, but the core conversion is unproven |
| Funnel | 37 sessions since Sep 24; 21 searched, 15 then opened a product; **0 confirmed watches**; 0 `/discover` views | No. Traffic is too small to A/B, so treat UI changes as qualitative |
| Funnel analytics gaps | **Product-page Watch taps, where signed-out product-page requests came from, zero-result searches and search-result clicks are not recorded** (§2) | No, but instrument before measuring UI changes |

---

## 1. Store coverage and freshness (after PR #38)

PR #38 merged 2026-09-26 10:06 UTC. It sizes each run from the time since the
last success (~100 SKUs/hour) and also starts the store job when
catalog/health/cron runs finish.

### Store runs, last 7 days (`freshness`)

| | Value |
|---|---|
| Runs | 12 (11 ok, 1 failed, 0 killed, 0 stopped early) |
| The one failure | 2026-09-25 05:17 UTC, before #34–#38, ended after 0.4 min; none since |
| Runs per day | 4.0 (the sizing model assumed 6) |
| Gap between runs | median 5.4h, max 10.2h |
| Speed | 2.34 s per SKU; failure rate 0.9% |
| Successful checks per day | 1,311 (7-day average, mostly before #38) |
| Watched checks per day | 83 |

**Since PR #38 (only two real runs so far):** 11:44 UTC (3.8h gap → 378 SKUs)
and 16:44 UTC (5h gap → 500 SKUs), both with 0 failures, 17–19 min. That is
~90 checks/hour, in line with the ~100/hour design. All 11 store-workflow starts
since the merge succeeded. The `workflow_run` starts that fell inside the 3.5h
guard skipped without making DABS calls, as intended. Two runs is not enough
to confirm ~2,400 checks/day. Re-run `freshness` after Sep 28.

Capacity model fed with the observed numbers: rotation **4.2 days vs the 3-day
target (not met)**; watched worst case 11h vs 12h target (met). The rotation
figure still reflects the 4-runs/day, 400-SKU runs from before #38.

### Watched products

- 38 distinct watched products. **All 38 on target** (successful check < 12h).
- Overdue (no success in 24h): **0**.
- Only 2 watched products are currently in stock with bottles. Most watched
  products are sold-out allocated bottles.

### Failed checks

- `checks`, last 7 days: rotation 1,529 checks, 5 failed (0.3%); watched 149,
  0 failed; "Check DABS now" 6, 0 failed (5 of 6 found changed store counts).
- Products with consecutive failures: **5, all backing off, 0 watched**. Every
  error is DABS's detail page returning HTTP 500 (SKUs 951612, 922646, 921268,
  917370, 031538). This is the known "some SKUs always 500" case.
- Latency: p50 1.76 s, p90 2.09 s (rotation); one 22 s outlier.

### In-stock coverage by age of last successful store check

| Age | 2026-09-24 21:01 (baseline) | 2026-09-26 19:55 |
|---|---:|---:|
| < 1 day | 1,157 | 1,529 |
| 1–3 days (target) | 253 | 1,909 |
| 3–7 days | — | 225 |
| over 7 days (shown as unknown) | 1,833 | **1,748** |
| never | 2,168 | **5** |

`storecoverage`: every in-stock product has now been **attempted** at least
once (`never_attempted` = 0 in every size bucket).

The rotation is oldest-first and treated never-checked as oldest, so it spent
Sep 24–26 on the 2,168 never-checked products. The > 7-day group, last checked
before the Aug 13–14 outage, is next in line. At ~100/hour that is roughly
18–24h of checks, so it should clear by **Sep 27–28**. Confirm with
`freshness`.

### Coverage by segment (in-stock with bottles; % with a successful check within the window)

| Segment | Products | 24h | 72h | Never |
|---|---:|---:|---:|---:|
| All | 5,189 | 27.4% | 61.9% | 0.1% |
| 1000+ bottles | 670 | 23.3% | 86.6% | 0 |
| 200–999 | 2,134 | 37.0% | 82.8% | 0.1% |
| 50–199 | 1,262 | 16.3% | 37.2% | 0.2% |
| 1–49 | 1,123 | 24.0% | 35.4% | 0.1% |
| **Allocated / limited (status A, L)** | **1,585** | **1.2%** | **2.1%** | 0.2% |
| **Rated scarce+** | **10** | **0%** | **40%** | 0 |
| Taste pilot (wine) | 248 | 33.1% | 51.2% | 0 |
| Watched (in stock) | 2 | 100% | 100% | 0 |

Allocated/limited listings are almost entirely in the > 7-day group. The
rotation gives A/L/D a 1-day head start, but that only orders them within a
bucket, so they sit behind the never-checked products. Rated scarce+ products
get **no** head start unless someone watches them.

### Discovery consequence (`discover`)

- Scarce: 10 qualify statewide. 6 of the 10 were last store-checked Aug 13;
  the other 4 on Sep 24.
- **Nearby confirmed (< 24h, 10 mi): 0 of 10 in Salt Lake City, Park City, Provo
  and St. George.** All 10 show "not checked" in every area.
- Price drops: 18 qualify, 16 of them not checked in 24h (1–2 confirmed nearby
  per area).
- Back after a while: 0. The first possible date is **Oct 23** (unbroken
  catalog history starts Sep 23).

### Statewide catalog and alerts

- Catalog passes (48h): 6 of 6 ok, ~35 s each, none suppressed.
- Alert events (48h): price_change 47, out_of_stock 46, status_change 32,
  restock 19, new_product 16. Only 1 was delivered to a watcher, because few
  watched bottles changed.

---

## 2. Search → product → confirmed watch

### What exists today

| Signal | Where | Joinable by |
|---|---|---|
| Page views, incl. `/search?q=` and `/product/<csc>` | `page_events` since 2026-09-24 | session, visitor, signed-in user id |
| Signed-in watch add | `watchlist.created_at` | user id (and csc) |
| Signed-out watch request / applied | `watch_intents` (pruned after 14 days) | csc; `source` + `visitor_id` **only for discover/taste** |
| Discovery/taste click, Watch tap, email request, confirmed watch, "useful" | `discover_events` | visitor id, csc |
| Search text, 30 days | `searchlog` (from `page_events`) | — |

### Baseline numbers

From `funnel` (run #53, window 2026-09-24 00:00 UTC → now; admins excluded
from views):

| Step | Count |
|---|---:|
| Sessions | 37 (35 visitors; 2 signed-in sessions) |
| Landing source | Direct 17, Google 16, Bing / Yahoo / DuckDuckGo 1 each |
| Sessions with a search | 21 |
| …followed by a product view in the same session | **15** (proxy for search → product) |
| Sessions with any product view | 22 (3 landed directly on a product page) |
| `/login` views | 8 (6 sessions) |
| `/discover` views | **0** |
| `discover_events` (clicks, Watch taps, confirmed watches, "useful") | **0** |
| **New watchlist rows (any source)** | **0** |
| Signed-out watch requests (`watch_intents`) | 2, both from product pages, both with a home store |
| …applied (watch confirmed) | **0**. Both expired unapplied |

Views per day (Mountain time): Sep 23 (evening) 7, Sep 24 45, Sep 25 56, Sep 26 49.
Searches per day: 0 / 14 / 27 / 30.

**Confirmed-watch conversion is 0 of 21 search sessions, and 0 of 2
signed-out requests.** The two requests come from 2 different addresses. They
fit the owner's Sep 24 tests (accounts 14 and 15 below were created a minute
apart that evening), but the report doesn't link them, so this isn't
confirmed. Either way, **no real visitor has completed a watch since
analytics began.**

`searchlog`: **53 distinct search queries in 30 days**, and wine searches came
from single visitors. Traffic is very low, so rates below are anecdotes, not
conversion rates.

### What we cannot measure today

1. **Search → product click-through.** No click event exists on search
   results. Proxy: a product view later in the same session. That proxy can't
   tell a click from a direct URL, a back-navigation or an unrelated product
   (no internal referrer is stored).
2. **Watch taps on product pages or search results.** `watch_click` is recorded
   only for discover/taste attributions. A product-page Watch tap, signed in or
   not, leaves no event.
3. **Signed-out product-page watches, end to end.** `watch_intents.source` and
   `visitor_id` are stored only for discover/taste, so a request from a product
   page can't be tied back to the search or view that led to it. Only
   request → applied counts are available.
4. **Which result position was clicked**, the result count, and **zero-result
   searches.** `page_events` stores the query only, not what was shown.
5. **Owner and test accounts in watch counts.** Signed-in admins are excluded
   from `page_events` but not from `watchlist`. The funnel report treats a
   watch as "tracked" only when its user appears in `page_events`. Owner
   `+test` accounts are not admins, so they are counted.
6. **Email-link device/browser switches.** We can see that an account is
   confirmed but never signed in. We can't see why (other browser, other
   device, spam folder).
7. **Watches removed later.** Unwatching deletes the row, so churn isn't
   visible.

Smallest instrumentation that would close 1–3: record `search_click`
(position, query length bucket), and record `watch_click`/`watch_request`/
`watch_added` for surface `product` and `search` through the existing
`discover_events` path. Keep `source` and `visitor_id` on every
`watch_intents` row, not only discover/taste.

---

## 3. Sign-up, email links and watch confirmation

### Accounts (`auth`, anonymised)

| State | Accounts | Created |
|---|---:|---|
| Signed in and confirmed | 7 | Jul 9 – Sep 25 |
| Confirmed, never signed in | 2 | Sep 11, Sep 24 |
| Never confirmed | 7 | Aug 10 – Sep 24 |
| **Total** | **16** (all email provider) | |

- Before the `?code=` fix, every account that got in had a second link sent
  (`recovery_sent_at` set) shortly after confirming: accounts 1–3, 10, 11 and 13
  in the anonymised list.
- **After the fix:** account 16 (2026-09-25 02:51 UTC) was confirmed and
  signed in within the same second, with no second link. This is the first
  production evidence that a first-time email link now signs the person in.
  We can't tell whether this was the owner's test or a real visitor.
- Account 15 (2026-09-24 21:17): confirmed, never signed in. This matches the
  owner's cross-browser watch test in STATUS.md: the link was opened in a
  different browser that was already signed in as the owner's main account.
- Account 14 (2026-09-24 21:16): never confirmed.
- 2 legacy footer signups still have no account. The invite email is built
  and **not sent** (owner said wait).

### Status by behavior

| Behavior | Verified | Pending |
|---|---|---|
| First-time sign-in from the first email link (`?code=`) | Code in `/auth/confirm`; one production account signed in on its first link (Sep 25) | Planned owner test with a fresh `+test` address, same browser |
| Returning sign-in (magic link) | Working for existing accounts (repeat sign-ins on record) | — |
| **Cross-device / cross-browser links** | `/auth/confirm` already accepts `token_hash` | **Owner: switch Supabase "Confirm signup" and "Magic Link" templates to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`, and replace the generic copy.** Until then the PKCE `?code=` link completes only in the browser that asked for it. We can't read the dashboard setting from here. Nothing in the data shows it changed |
| Signed-out watch → email → `/watch/confirm` | Same-browser path in code is idempotent and email-bound. The Sep 24 owner test's other-browser case correctly did **not** add the watch, and PR #29 explains why on the page | Owner retest in the same browser, and on a second device after the template change |
| Watch confirmation counts in production | 2 signed-out requests since Sep 24, **0 applied** (both expired). 0 new watchlist rows of any kind | Nothing verified end to end in production yet |

---

## 4. Unresolved production issues

**Should block UI work that depends on them:**

1. **Store coverage gap for allocated/limited and scarce bottles.** Until the
   > 7-day group clears (expected Sep 27–28), any product-page or discovery UI
   that leads with "near you" will mostly show "not checked" for exactly the
   bottles people care about. The Scarce view has 0 of 10 confirmed nearby in
   every test area. Design against that state, or wait for the Sep 28
   `freshness`/`discover` re-run. If A/L/scarce still lag once the backlog
   clears, consider giving rated scarce+ products the same head start as A/L.
2. **Cross-device email links (owner config).** Any flow that asks people to
   "check your email" on a phone after starting on desktop will fail until the
   token-hash template change lands.

**Known, not blocking:**

3. Rotation target (3 days) not yet demonstrated. The model on observed data
   says 4.2 days, but that uses pre-#38 run sizes. Re-check after Sep 28.
4. `WATCH_REFRESH_NOTE` still says "about twice a day" for watched bottles.
   The measured number is better (every run, all 38 < 12h). Per CLAUDE.md,
   raise the claim only after a multi-day `freshness` pass.
5. 5 SKUs permanently return HTTP 500 from DABS (backed off, none watched).
6. The 2026-09-24 session-pooler exhaustion hasn't recurred in the job
   history reviewed. If it does, run `conns`.

**Owner items still open:** Supabase email templates; same-browser
sign-up/watch retest; decision on the 2-person invite email; product-photo API
keys.

---

## Re-run checklist

- `freshness` + `discover` on or after **2026-09-28**: > 7-day bucket ~0, A/L
  72h coverage up, Scarce nearby > 0.
- `funnel` weekly (this branch adds it), and after any instrumentation change.
- `auth` after the owner's retest: expect a new account that is confirmed and
  signed in with no second link.

---

_Follow-up (same day): items 1–3 and 5 under "What we cannot measure today"
are now instrumented (search list shown + result count, ranked result
clicks, product/search Watch taps, email requests and confirmed watches with
attribution kept through sign-in, +test/admin exclusion). They start with
migration `20260929000001`; `report.yml` → `funnel` reads them. The email
template change is prepared in `docs/auth-email-templates.md`._

_Correction (owner inspected hosted Supabase, same day): the **Magic Link**
template already uses a token-hash link, so returning users' links already
work across browsers. Only **Confirm signup** (first-time) still uses the
default browser-bound link. See `docs/auth-email-templates.md`._
