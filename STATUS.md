# Utah Drops — status

_Last updated: 2026-09-24 (PRs #25–#27, Worth a look)_

**Production is healthy.** Statewide stock refreshes 3×/day, store-by-store every 4h; all
scheduled workflows are enabled; `/api/health` is green.

## Shipped (PRs #1–#5, all merged and deployed)
- Recovery from the Aug–Sep outage: catalog timeout fixed, jobs moved into the
  Actions runner, workflows re-enabled + weekly keepalive, health check every 3h,
  stale-data banner, auto-migrations.
- Safe alerts: per-(user, event) delivery log, no backlog blast after outages,
  no re-announcing past allocated drops, guard against DABS zero-quantity glitches.
- Next 16.3.6 (security), apostrophe-insensitive search, mobile layout fixes,
  CI on every PR.
- Per-store "back at my store" alerts (up to 3 home stores), "nearest to me"
  on product pages, sitemap/robots/JSON-LD, delisted products marked out of
  stock, footer signup sends a real magic link, AI-search rate limits,
  open-redirect fix.

## Redesign
- PRs #7 and #8 (live): first redesign pass (jobs-first home, one search box,
  "where can I get it" product page, drops/what's new/watchlist, app icon).
- Field-guide iteration (this branch): espresso theme with amber/burgundy/green
  used by job, Instrument Serif + Instrument Sans, drop "ticket", activity as
  day-grouped rows, browse-by-taste shortcuts on real DABS categories, bottle
  names without the size suffix, bottles vs units by category, listing status
  kept separate from availability, manual area picker (no geolocation needed).
- PRs #9–#13: production stability (session pooler, one DB error no longer
  crashes the server, less link prefetch fan-out, `report.yml` modes).
- PR #14 (live): area picker in the search bar (All of Utah / use my location /
  any store city; cookie `ud_area`, no account needed, shared with product
  pages), "N stores near <area> · X bottles" on result and feed rows (10 mi,
  shows the check date when >36h old; never-checked products show nothing),
  homepage hero with the drop ticket beside the headline, full-width search,
  browse shortcuts as buttons, and a toned Park City Main Street photo
  (Unsplash, royalty-free) behind the hero.
- PR #15: share previews (OG images) redone in the site's look (fonts and
  backgrounds in `assets/`), and "near you first" search ordering when an area
  is picked (default sort only; no area = unchanged "in stock first").

## Product photos (not started for real)
- No product photos exist in the data, and DABS has none anywhere (checked the
  locator detail pages and abs.utah.gov); a neutral container glyph stands in.
- Pilot (2026-09-24, kept in git history at `fcc5ffd`): free Bing image
  scraping from Actions returned junk (1 of 28 correct). Plan: a paid image
  search API (SerpAPI or Brave) + Claude vision to verify each match against
  name/size/vintage, then tone/crop and store in Supabase Storage. Needs
  `SERPAPI_KEY` (or Brave) and `ANTHROPIC_API_KEY` as Actions secrets.

## Admin dashboard + sign-in fix (PRs #16–#18, live)
- `/admin` is live for `ADMIN_EMAILS` (set in Vercel): live visitors, traffic,
  sources, top pages/bottles/searches, audience, accounts & alerts, job
  freshness. First-party tracking in `page_events` since 2026-09-24 (one test
  visit from Claude that night). Alert email links carry `utm_source=email`.
- Sign-in fix: new accounts' first email link (`?code=`) was confirmed but
  never signed in; every account that got in had to ask for a second link.
  `/auth/confirm` now handles `?code=`; failed links explain themselves.
  Not yet proven with a real first-time sign-in (owner to test with a
  `+test` Gmail address).
- Diagnostics: `report.yml` with hours=`auth` (where sign-ups stall, no
  emails) or `conns` (who holds DB connections).

## Rarity tiers ("Utah Drops rating · beta")
- Product pages show a badge (Everyday / Uncommon / Scarce / Rare / Unicorn)
  with a plain-language line and the dated evidence behind it; products
  without enough evidence show the facts only. Written daily by the `rarity`
  job into `product_rarity`; manual corrections in `rarity_overrides`.
- Evidence: DABS monthly sales (context), our shelf history (days in stock +
  typical store count), DABS drawings (`rhdp` job; item code, bottles,
  entries; no winner names) and allocated drops (exact name → one code).
- Badges withheld for reused DABS codes (several vintages) and low confidence.
- Bottles released by drawing that DABS doesn't list get a "not currently
  listed" page (product row marked delisted).
- Stale store data (>7 days) is treated as unknown site-wide, and every
  store count shows when it was checked ("checked 5h ago").
- "Does this rating seem wrong?" notes land in `rating_feedback`; /admin →
  Ratings shows them plus watchlist adds per 100 product viewers by badge
  (unrated as baseline; rare bottles draw interest anyway, so it's not proof).
- Store coverage gap (found 2026-09-24): before the Sep 23 fix the store job's
  priority queue starved ordinary in-stock bottles — 2,304 in-stock products
  had never been store-checked, incl. 699 of the 713 biggest sellers (Tito's).
  The Sep 23 oldest-first rotation reaches all ~5.4k in ~5 days; confirm with
  `report.yml` → `storecoverage` after Sep 28. Popular bottles get ratings
  ~10 in-stock days after their first store check.
- Next: get people onto rated bottle pages; read the feedback notes.

## Bottle-hunting journey (PRs #25–#27, live 2026-09-24)
- #25 Search: `products.search_key` (SQL `public.search_key()` mirrored by
  `lib/search-key.ts`) + explicit aliases/abbreviations + name-first ranking.
  "Blanton's" → standard Single Barrel first (was 2 special orders); "EH
  Taylor" 0 → 5; "eagle rare 10 year" 0 → 2. 25-bottle regression set passes
  on prod (`report.yml` → `searchcheck`).
- #25 Category filter: Type → Style (`lib/categories.ts`, `?group=`); old
  `?category=` links and homepage shortcuts unchanged.
- #25 Signed-out Watch: `/login?watch=<code>` → pick "Anywhere in Utah" or
  "Also at my store" → email link → `/watch/confirm` adds it once (table
  `watch_intents`, email-bound, 24h) → "You're watching…" on the product page.
  Home stores add store alerts on top of statewide; nothing suppresses them.
- #25 Alerts: digest skips superseded events (restock since sold out, store
  restock the latest check contradicts) and dates each line; store restocks
  need a zero seen in the last 7 days. Removed "the minute" / "one email an
  hour" claims.
- #26 Store job reliability + sizing. Review of 244 scheduled runs: GitHub
  never dropped a slot while enabled, but starts runs late (median 110 min,
  p90 180, max 350); 20 runs in June–July were killed at the 30-min timeout.
  (An earlier "GitHub skips half the runs" note was wrong: a delayed run was
  miscounted.) Now: every 4h at :37, 400 SKUs, 25-min scrape budget (stops
  cleanly, records `stopped_early`), 40-min job timeout, health alarm 12h.
  Model (`lib/jobs/store-capacity.ts`): ~2,400 checks/day → watched bottles
  every run (worst ~10h, target 12h), all ~5.4k in-stock in ~2.5 days
  (target 3, cutoff 7). DABS load ~4,800 req/day at the same 1.1 s pacing.
- #27 8 of 38 watched bottles (sold-out rare ones) always get HTTP 500 from
  DABS's detail page; they back off (6h → 72h), and a catalog restock now
  clears the backoff so they're re-checked on the next store run.
- Baseline 2026-09-24 21:01 UTC (before the new schedule ran): watched 30/38
  on target (8 = DABS 500s); in-stock checked <1d 1,157 · 1–3d 253 · never
  2,168 · >7d 1,833.

## Worth a look (/discover)
- Three views (rules in README → Worth a look, thresholds in `lib/discover-rules.ts`),
  homepage preview of up to 3, "Worth a look" in the desktop nav, share card.
- First production review (2026-09-24, `report.yml` → `discover`): Scarce 10
  bottles (all rated via allocated drops, e.g. Tears of Llorona, Old Forester
  Single Barrel Rye Barrel Proof); nearby-confirmed within 24h: 2 near Salt
  Lake City / Park City, 3 near St. George, 0 near Provo; 6 of 10 had no store
  check since Aug 13 (rotation still catching up). Price drops 0 (the 8 price
  changes since the Sep 23 restart were 5 increases and 3 small drops).
  Back after a while 0 and hidden: unbroken catalog history only since Sep 23,
  so the first confirmable returns are ~Oct 23.
- Measurement: `/admin` → Discovery (unique and returning /discover visitors,
  product click-through, confirmed watches per 100 visitors, by view and
  home vs page, "Was this useful?").

### Open items (next session: pick these up)
- **Verify the new store schedule** with `report.yml` → `freshness`
  (Claude check-ins scheduled Sep 25, 26, 27 and 29; if this session is gone,
  run it by hand). Pass = no killed runs, `stopped_early` rare, watched on
  target except DABS-500 SKUs, never/>7d buckets ~0 by Sep 27–28.
- If it passes, change `WATCH_REFRESH_NOTE` (`lib/config.ts`) and the digest
  footer from "about twice a day" to the measured frequency.
- Re-run `report.yml` → `discover` after Sep 28 (store rotation caught up) and
  after Oct 23 (Back view can first appear); check /admin → Discovery weekly.
- **Owner test** (2026-09-24, partial): the request and confirm email worked,
  but the link was opened in a different browser already signed in as the
  owner's main account. Supabase's confirm-signup link (PKCE `?code=`) only
  completes in the browser that asked, so the watch was correctly not added;
  PR #29 now explains that on the page. Retest by opening the link in the
  same browser (or after the template change below).
- **Supabase email templates (owner, dashboard → Authentication → Email
  Templates):** switch "Confirm signup" and "Magic Link" to token-hash links,
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`, so links work in
  any browser/device (`/auth/confirm` already handles `token_hash`; all three
  sign-in forms send `emailRedirectTo=/auth/confirm?next=…`), and replace the
  generic "Confirm your email address" copy, which reads as phishing.

## Taste picks (beta, wine only; PR #32)
- One search box. A wine request with a taste in it ("white, not too dry,
  under $30 near Draper") gets up to 6 picks above ordinary results; "Help me
  choose" under the examples opens a small panel that writes the same URL
  request. Exact names stay plain name search. Chips split "Only showing"
  (kind, grape, price, area) from "Ranked by" (sweetness, body, style words,
  "less common"); at most one clarifying question; follow-ups keep the rest.
- Availability uses the /discover rules: nearby = successful store check in
  24h within 10 mi, statewide = catalog pass in 24h, drawings excluded.
- Source audit (2026-09-25, 260 in-stock wines read from DABS): DABS gives
  category (color; region for imported; grape for varietals), the name (grape
  often abbreviated, label words like Brut / Extra Dry / Late Harvest, some
  vintages, size as its own field) and listing text for ~80% (short,
  formulaic blurbs; often identical wording across producers). Stated in the
  text: style words (crisp 62, smooth 54, floral 52…), body for 39, sweetness
  for only 16 (+17 from label words). Not available anywhere we read:
  residual sugar, acidity, producer tech notes, vintage-specific notes.
  Sweetness for most dry styles is general style knowledge (marked "Style
  note"); Riesling, Chenin, Prosecco and most rosé stay unknown on purpose.
- Pilot: 260 wines (95 white, 85 red, 35 rosé, 45 sparkling) spread across
  price and stock, fixed in `lib/taste/pilot-list.ts`. Six ambiguous codes
  (several vintages, "USE <code>") are never recommended. 50-profile sample
  review (`lib/taste/review-log.ts`): 45 right as extracted, 5 fixed by rule
  changes. Reviewed by Claude against DABS text; an owner spot-check of
  usefulness is still owed.
- Model: Haiku reads only words the rules couldn't; it may only fill empty
  preferences (2.5s limit, shared AI-search limits). Latency and cost go into
  `taste_events` (`report.yml` → `taste`).
- Measure: `report.yml` → `taste` (coverage, review drift, shown/clicks/
  feedback by typed/guided/followup, watches from `discover_events` surface
  `taste`, model p50/p90 and cost), `tasteeval` (53 cases), `searchlog`.
- Next: more coverage only if usage shows people use it and picks get clicks,
  watches and "useful"; the smallest data gap is sweetness (a source such as
  producer sheets for the most-searched wines). Embeddings aren't needed at
  this size.

## Watch
- 2026-09-24 ~04:40–05:00 UTC the session pooler (pool_size 15) was full of
  idle Vercel connections; jobs/report couldn't connect, the site was fine.
  Cleared on its own. If jobs fail with EMAXCONNSESSION, run report `conns`.
- 6 accounts never clicked their first email (spam, typos, or lost
  interest; unknown).

## Pending decisions
- Invite email for the 2 legacy footer signups: built, **not sent** — owner said
  wait. Send by running `cron.yml` with job `invite-signups` and `send` checked.

## Next
- Product photos (above), once the owner adds the API keys.
- Nice-to-have: near-you counts on the browse buttons (low value; results
  already show them).
- Remaining review items (see `REVIEW.md` §4): push/PWA alerts, price history
  chart, drop-day experience, tests for the scraper parsers.
