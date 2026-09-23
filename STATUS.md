# Utah Drops — status

_Last updated: 2026-09-23_

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

## Pending decisions
- Invite email for the 2 legacy footer signups: built, **not sent** — owner said
  wait. Send by running `cron.yml` with job `invite-signups` and `send` checked.

## Next
- Full design / UI / UX refresh (planned in a separate session).
- Remaining review items (see `REVIEW.md` §4): push/PWA alerts, price history
  chart, drop-day experience, tests for the scraper parsers.
