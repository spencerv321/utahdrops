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
- No product photos exist in the data; a neutral container glyph stands in.

## Admin dashboard (this branch)
- `/admin`: live visitors, traffic, sources, top pages/bottles/searches,
  audience, accounts & alerts, job freshness. Own first-party tracking
  (`page_events`), no third-party analytics. Needs `ADMIN_EMAILS` in Vercel.

## Pending decisions
- Invite email for the 2 legacy footer signups: built, **not sent** — owner said
  wait. Send by running `cron.yml` with job `invite-signups` and `send` checked.

## Next
- Remaining review items (see `REVIEW.md` §4): push/PWA alerts, price history
  chart, drop-day experience, tests for the scraper parsers.
