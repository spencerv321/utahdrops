# Utah Drops — status

_Last updated: 2026-09-24_

**Production is healthy.** utahdrops.com refreshes several times a day; all
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
