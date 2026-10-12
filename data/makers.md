# Utah makers data (`data/makers.json`)

One entry per business on DABS's [Proudly Utah](https://abs.utah.gov/shop-products/proudly-utah/)
list (83 listings, 77 pages: a few businesses are listed twice, e.g. Moab
Brewery + Moab Distillery, and share a page with both listings in `dabs`).
Rendered at `/makers` and `/makers/<slug>`; code in `lib/makers.ts`.

Licensed makers that aren't on Proudly Utah (found in DABS's Licensee List,
`data/licensees/`) get a page too: `dabs: []` and a `licenses` array copied
exactly from the license rows (`tests/makers.test.ts` checks them against the
snapshot). Cite the shared `licenseeList` source for license facts. Set
`checked` on a maker when its sources were read after the file-wide date.

## Rules (same as Utah 101 and bottle notes)
- Our words. Every sentence is a claim `{ "t": "...", "s": ["sourceId"] }` and
  cites at least one source: the maker's own `sources`, or a shared one in
  `MAKER_SOURCES` (`lib/makers.ts`: DABS lists, City Weekly Best of Utah 2025,
  City Cast reader picks, Salt Lake Magazine's distillery roundup).
- No guessing. If no source says it, leave the section empty; the page says
  "we couldn't confirm" instead. Avoid hours and prices (they go stale).
- "What locals say" summarizes local press and reader polls. Never quote or
  copy reviews (including the reviews makers paste on their own sites), and
  never copy photos.
- Reddit blocks scripted access from the research sandbox (2026-10-11), so
  no Reddit threads are cited yet. Add one only from a thread a person has
  read, summarized in our words.
- `npx tsx --test tests/makers.test.ts` checks citations, slugs, the 83-listing
  total and catalog matchers.

## Owner notes (firsthand)
Add to the maker's `notes` array; it shows as "From our visits", credited and dated:

```json
"notes": [{ "text": "Our words about the visit.", "by": "Spencer V.", "date": "2026-10-20" }]
```

## Linking bottles (`catalog`)
- `vendors`: DABS "Vendor Cd" without leading zeros (`products.vendor_code`,
  filled monthly by the `xlsx` job). Use it when the maker sells to DABS
  under its own vendor account (most distilleries, wineries and cideries).
- `prefixes`: uppercase DABS name prefixes, for brands sold through a
  distributor (most breweries). Keep them specific: "PROPER BREWING", not
  "PROPER" (Proper No. Twelve is an Irish whiskey).
- `exclude`: CSCs a matcher catches by mistake.
- Review matches with `npx tsx scripts/makers-check.ts [slug]` locally or
  `report.yml` → `makers[:slug]` in production.

## Re-checking
Bump `checked` after re-reading sources. Re-check DABS's list for new or
closed makers; City Weekly's Best of Utah results come out each November.
