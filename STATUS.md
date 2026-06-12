# BevFinder Utah — build status

_Last updated: 2026-06-09 (paused for the night)_

A fast front end + alerting layer on top of Utah DABS liquor inventory data.
See `../dabs-tracker-prd.md` for the full product vision. Working name in the
UI is **BevFinder Utah** (single constant in `lib/config.ts` — trivial to rename).

## How to resume

```bash
# 1. Start infra (Docker Desktop must be running)
supabase start              # local Postgres + auth + Mailpit
pnpm -C bevfinder build && pnpm -C bevfinder start --port 3010

# 2. Run scrapers locally (any time)
npx tsx scripts/scrape.ts catalog          # full catalog → products + snapshots + events
npx tsx scripts/scrape.ts store-inventory  # per-store qty (budget via STORE_SCRAPE_BUDGET)
npx tsx scripts/scrape.ts allocated        # 3rd-Saturday drop list
npx tsx scripts/scrape.ts xlsx             # monthly catalog enrichment
npx tsx scripts/scrape.ts percentiles      # nightly price tiers
npx tsx scripts/scrape.ts digest           # watchlist + drop alert emails
```

Local URLs: app `:3010` · Supabase Studio `:54323` · Mailpit `:54324` · DB `:54322`.

## Done & verified against real DABS data

- Next.js 16 (App Router) + Tailwind 4 + shadcn/ui scaffolded
- Schema applied: delta-encoded snapshots, events, watchlist, drops, RLS
  (`supabase/migrations/20260609000001_init.sql`)
- **Catalog scraper** — seeded 28,830 real products via the `LoadProductTable`
  JSON API (`lib/dabs/catalog.ts`, `lib/jobs/catalog.ts`)
- **Per-store scraper** — 47 stores w/ lat-lng + per-store quantities; uses the
  GetDetailUrl→Index TempData-cookie two-step (`lib/dabs/detail.ts`)
- **Allocated scraper** — parsed the live June 20 2026 drop (`lib/dabs/allocated.ts`)
- **XLSX ingest** — 10,237 rows enriched with subcategory/size/SPA (`lib/dabs/xlsx.ts`)
- **Percentiles** computed for NL price tiers
- Pages render real data: `/` search + filters, `/product/[csc]` per-store table +
  sparkline + watch button, `/whats-new` feed, `/drops` countdown, `/login`,
  `/watchlist`. Age gate, compliance footer, email-capture instrument all in place.
- **NL search** (`lib/nl/*`, `/api/nl-search`) — Haiku query translator, falls back
  to plain FTS when no `ANTHROPIC_API_KEY`. Geocoding via Nominatim.
- Cron routes (`/api/cron/[job]`, CRON_SECRET-guarded) + `vercel.json` schedules
- Email/digest layer (`lib/email.ts`, `lib/jobs/digest.ts`) — Resend in prod,
  console dry-run locally
- Production build is green; all routes return 200/307 as expected

## ✅ Auth round-trip — DONE (2026-06-10)

The bug was the **email template**, not just the port. The `/auth/confirm` route
expects the SSR token-hash flow (`verifyOtp({ token_hash, type })`), but no custom
email template existed, so Supabase sent its default `{{ .ConfirmationURL }}` link
(implicit flow) that never carried `token_hash`. Fix:
- Added `supabase/templates/magic_link.html` linking to
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` (preserves `next`).
- Wired it via `[auth.email.template.magic_link]` in `supabase/config.toml`.
- `site_url`/redirects already pointed at `:3010`; also fixed stale
  `NEXT_PUBLIC_SITE_URL` (was `:3000`) in `.env.local`.

Verified end-to-end in the browser: login → magic link in Mailpit → `/auth/confirm`
→ signed in as tester@example.com → watched Eagle Rare (017766) → `digest` job
emitted the correct "Back in stock — 54 bottles statewide" alert. Cron auth gate
(401/404/200), NL fallback (`{fallback:true}` → `/?q=` → FTS, "macallan"→30 hits),
and percentiles job (28,841 updated) all confirmed. **All MVP paths verified.**

## Before deploy

- Real `DABS_CONTACT_EMAIL` in env (politeness; currently a placeholder)
- Real Supabase project + `DATABASE_URL`/anon key; `ANTHROPIC_API_KEY` (the NL
  Claude path is wired but only the FTS fallback is exercised without a key);
  `RESEND_API_KEY` + verified sending domain; `CRON_SECRET`; `NEXT_PUBLIC_SITE_URL`
- **Vercel cron frequency:** `vercel.json` schedules several jobs multiple times
  daily (catalog 3×, store-inventory every 2h, digest hourly). Vercel **Hobby**
  caps crons at once-daily and 2 total — this needs **Pro**, or an external
  scheduler (cron-job.org / GitHub Actions) hitting the `CRON_SECRET`-guarded
  endpoints. Decide before deploy.
- When deploying to a real domain, set the same magic-link template in the hosted
  Supabase project (Auth → Email Templates) — the local `config.toml` template
  does not transfer to a hosted project.
- First production run: `catalog` bootstraps with events suppressed (correct);
  events start flowing on the 2nd pass

## OG images — DONE (2026-06-10)

Branded 1200×630 Open Graph / Twitter images, shared frame in [`lib/og.tsx`](bevfinder/lib/og.tsx)
(dark whiskey gradient, amber rail, drawn glass mark — hex colors since Satori
can't do oklch; no emoji/custom fonts so it's offline-safe):
- `app/opengraph-image.tsx` — root brand (covers `/`, `/login`, `/watchlist`)
- `app/product/[csc]/opengraph-image.tsx` — **dynamic**: title-cased name,
  category·size eyebrow, price pill (green in-stock / red out), status subtitle
- `app/drops/opengraph-image.tsx` — next third-Saturday date + "N days out" pill;
  `revalidate = 3600` so the countdown stays fresh (UTC date format — beware the
  off-by-one if you ever format `thirdSaturday()` output in a non-UTC zone)
- `app/whats-new/opengraph-image.tsx` — feed brand
Root layout sets `openGraph` + `twitter: summary_large_image` metadata; verified
all four render and the `og:image`/`twitter:image` tags resolve in page `<head>`.

## Known gaps / deferred

- Per-store coverage is partial by design (budget-limited rotation) — NL "near me"
  degrades gracefully to statewide when a store lacks data
- Allocated store-address → `stores.id` matching is best-effort (exact address match)
- No tests yet; verification has been live-data + screenshots
