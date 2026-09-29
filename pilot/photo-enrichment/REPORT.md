# Product photo & facts pilot — results (2026-09-29)

Staging only. Nothing here is read by the site, nothing was deployed, and no
producer, distributor or DABS contact was made. Images live only in the local
cache (`.cache/`, git-ignored); the review packet embeds small thumbnails and
was shared privately with the owner.

## What was run

- **Sample** (`data/sample.json`, method in `select-sample.ts`): 100 DABS codes,
  picked by rule with hash tie-breaks, so there was no hand picking.
  - 60 popular: 25 by Utah Drops demand (watchers ×5 + page viewers + search
    clicks, from `report.yml → photosample`) and 35 by DABS sales dollars
    Jun–Aug 2026 (15 spirits, 12 wine, 5 beer, 3 other).
  - 40 difficult: 5 each from rule detectors for multiple sizes, similar
    expressions, proof/BIB, gift sets, beer packaging, wine vintages,
    limited/allocated, and reused codes.
  - The mix is 57 spirits, 27 wine, 13 beer and 3 other.
  - Production usage is thin (248 page events since Sep 24, 38 watched
    bottles), so "demand" is mostly the watched allocated bourbons.
- **Search**: one web search per product, looking for the producer page first
  and then other public sources. 186 page references were recorded with the
  query and rank.
- **Fetch** (`fetch-candidates.ts`):
  - Honors robots.txt, allows one request per host every 2.5 s, and drops a
    host after any 401/403/429 or bot challenge.
  - 185 pages → 154 OK; 19 hosts dropped (wine.com, Binny's, Walmart, BevMo,
    K&L, OHLQ and others).
  - Only images named in the page's own markup were fetched (JSON-LD,
    og:image, product `<img>`), never image-search thumbnails.
  - 294 images, 54 MB, 235 distinct after perceptual-hash grouping.
- **Review**: I looked at every downloaded candidate (328 image slots across
  the 100 listings) on per-product contact sheets. I zoomed into about 25
  labels to read the vintage, volume or edition. Verdicts, with a reason for
  each, are in `data/review.json`.
- **Classification** (`identity.ts`, `classify.ts`): the rules are separate
  questions, and any hard conflict (size, age, proof, vintage, package, added
  expression word) rejects. **Exact** needs all of these:
  - brand and expression confirmed;
  - size confirmed, by a page that sells only that size or by the volume read
    on the label;
  - no conflicts;
  - my visual check that the picture shows this item.

  Wine without a confirmed vintage caps at representative. Everything else
  unclear is possible or nothing.

## Results

| | listings | exact | representative | possible | no image |
|---|---|---|---|---|---|
| **All** | 100 | **14** | **9** | 43 | 34 |
| Spirits | 57 | 12 | 0 | 30 | 15 |
| Wine | 27 | 1 | 9 | 6 | 11 |
| Beer | 13 | 0 | 0 | 6 | 7 |
| Other (RTD, cider) | 3 | 1 | 0 | 1 | 1 |
| Popular (60) | 60 | 8 | 8 | 29 | 15 |
| Difficult (40) | 40 | 6 | 1 | 14 | 19 |

By difficult group, as exact / exact + representative out of 5:

| group | exact | exact + representative |
|---|---|---|
| proof / BIB | 2 | 2 |
| similar expressions | 2 | 2 |
| multiple sizes | 1 | 1 |
| reused codes | 1 | 2 |
| gift sets | 0 | 0 |
| beer packaging | 0 | 0 |
| limited releases | 0 | 0 |
| wine vintages | 0 | 0 |

- **Exact matches:** Speakeasy by Willett, Canadian Mist PET 1.75 L, Green
  Chartreuse 700 ml, Tito's 1.75 L, Patrón Silver, High West Bourbon, Black
  Box Chardonnay 3 L, Copper Can Moscow Mule, Johnnie Walker Red 1.75 L,
  Angel's Envy Finished Rye, New Amsterdam Gin 375 ml, Holladay Soft Red
  Wheat BiB, New Riff Rye BiB and Malibu Pink.
- **Where they came from:** 11 of the 14 came from retailer pages (a page
  selling one size is the only place most sizes get confirmed) and 3 from
  producer pages where the volume is legible on the label.
- **Representative (wine only):** 9, labeled as family-only. Four of them show
  a legible vintage that differs from DABS or can't be tied to DABS: Sonoma-Cutrer
  2024 vs no vintage, Joel Gott 2023, Occhipinti 2022 on a 2023 page, and
  Whispering Angel's 20th-vintage limited label.
- **Possible (43):** mostly the right product with the size unproven. That
  covers producer pages (which never state a size) and front views where
  750 ml, 1 L and 1.75 L bottles look alike. Also here: annual or limited
  releases (Shenk's, Bomberger's, Ocho Barrel Proof, Penelope 2026), DABS
  gift-set codes shown without the gift pack, label redesigns (Hennessy,
  Svedka, Vitus, Regal Apple), and single-barrel picks.
- **No image (34):** 16 had no candidate at all. Their pages were
  script-rendered, blocked, 404/410, a PDF only, or not found at all (Canadian
  Host). The other 18 had only rejected candidates.

### Rights

All 14 exact matches have **unknown** permission. No page stated that its
image may be reused. The pipeline looked for media-kit, press or reuse
wording and found none that grants use. Public access was not treated as
permission. Retailer images are probably the producer's pack shots, but that
is an inference, not permission. A publishing decision needs a separate call
on rights.

### Errors caught in review

- **113 of 328 candidates were the wrong item** when I looked at them. 62 of
  those were product photos of another bottle or can; the rest were logos,
  banners, lifestyle shots and placeholders.
- **The text rules alone would have accepted 24 wrong images as "exact"** and
  failed to reject 86. The page text described the right product while the
  image was something else: related-product strips (Dom Pérignon, cigars,
  Buffalo Trace), store logos, or a sibling expression. Visual review is doing
  most of the safety work.
- **30 listings carry a "caught" note.** The most plausible wrong bottles:
  - Berry Bros.: a 2021 Premier Cru "Les Suchots" on the page for the 2022
    village Vosne-Romanée (same domaine, same label).
  - An "Elijah Craig 94 proof Private Barrel" page showing an Angel's Envy
    Private Selection.
  - La Marca's Prosecco page showing only the Rosé and the Demi Sec.
  - Grand Marnier's US page showing a 700 ml label (DABS sells 1 L).
  - High West's 375 ml page reusing the 750 ml image.
  - A tall 19.2 oz Juice Force can on a 355 ml listing.
  - Joel Gott's Pinot Noir page with a Cabernet "815" share image.
  - Copper Can's page showing Apple Cinnamon and Blueberry Maple mules.
  - Kim Crawford's alcohol-removed "Illuminate" beside the real Sauvignon
    Blanc.
  - Crown Royal Salted Caramel beside Regal Apple.
  - Elijah Craig Small Batch and Straight Rye in the Toasted Barrel lineup.
- **Wrong-image rate by type:** spirits 69/217, wine 28/68, beer 14/31, other
  2/12. By difficult group, wine vintages was worst (14/17 wrong). Popular
  listings were 50/192.
- **Rule errors found and fixed during the run:**
  - DABS truncation ("BRRL PR" for barrel proof) and abbreviations it uses
    (STR, PRV, CHAT, BIB, CA).
  - Accents ("PATRÓN").
  - "Smooth Finish" in marketing copy read as a finished-cask expression.
  - Wine colour words read as expressions.
  - A reviewer flag that could have overridden missing DABS words.

  Each fix has a test in `tests/photo-pilot-identity.test.ts`.
- **One known false negative remains:** Willett Small Batch 4 yr is sold as
  "Cask Strength" but DABS's name omits it, so the rules reject it. I left it
  that way on purpose.

### Facts (separate track)

Every claim is stored with its source URL, the exact supporting text, the
evidence type and a status (`data/facts.json`).

- **DABS-stated:** category and size for all 100 (size from the sales report
  where the catalog name was truncated), detail-page text for 68, and
  vintage/age/proof where they appear in the name.
- **Pattern-extracted page text was unreliable.** In a 40-fact spot check,
  18 were wrong (45%): navigation text ("Country/Region: United States"),
  recipes on a wine page ("corn"), and other products' specs. All 586
  auto-extracted claims are therefore kept as **unverified candidates**.
- **Hand-checked:** 23 listings (the ones with an exact or representative
  image) were checked against the page, quoting it exactly.
- Listings with at least one verified claim, by attribute:

| attribute | DABS | producer | other source | any verified |
|---|---|---|---|---|
| producer | – | 41 | – | 41 |
| region | – | 4 | 8 | 12 |
| grape / grain | – | 4 | 5 | 9 |
| ABV / proof | 1 | 2 | 8 | 11 |
| age | 5 | 3 | 2 | 8 |
| tasting notes | 68 | 7 | 7 | 73 |

- **Conflict kept:** Speakeasy is 45% (90 proof) per one retailer, and 49%
  (98 proof) per another retailer and the label in the photo. Both claims
  stay, marked conflict.
- **Retailer copy:** some retailer text reads like generated copy ("Quick
  Facts: …") and should be treated as a weak source.
- No descriptions were written.

## Time, cost, storage

- **Wall clock:** about 1 hour for the fetch and classification runs (the
  full fetch took 18 min). Visual review was the bulk of the effort: 328
  image slots plus about 25 zooms.
- **Tool use:** 100 web searches, roughly 700 HTTP requests (185 pages, 387 image URLs, robots.txt for 138 hosts) to third-party
  sites, and a few dozen DABS detail pages at the shared pacing. No paid
  image or search API was used.
- **Model cost:** I can't measure this session's token cost from inside it,
  so I haven't estimated it.
- **Storage:** raw candidates average 184 KB (54 MB for 294 images). Keeping
  one normalized image per product (≤800 px WebP) is about 60–120 KB, so
  roughly 100 MB for 1,000 products. The audit cache would be about 0.5 GB,
  kept outside git.
- **Projection for the top 1,000:**
  - 1,000–1,500 searches.
  - About 3 hours of paced fetching, or less if run in parallel across hosts.
  - Review is the bottleneck. At 1–2 minutes per listing that is 17–33 hours
    of human review. A model can triage, but only its would-be-exact picks
    (about 15–25%) should go to a person; skipping the look is not safe (see
    the 24 wrong "exact" images above).
  - Expect about 15–25% exact and 35–45% exact or representative, with
    better yield for spirits and 1.75 L/375 ml sizes on retailer pages, and
    worse for beer, allocated releases, gift sets and vintage wine.

## False-positive risks and what would reduce them

- **I was the only reviewer.** 0 errors among the 14 exacts is my own
  judgment. With n = 14, the 95% upper bound on the error rate is still
  about 21% (rule of three), so this pilot supports no accuracy claim. A
  second independent look at every exact would reduce this.
- **The same image is reused across sizes and vintages** on retailer sites.
  Require a single-size page *and* a size or shape cue in the picture (label
  volume, handle, flask). Use cross-code perceptual-hash collision checks
  (built in; none fired here).
- **Labels change:** redesigns, anniversary or limited labels, annual
  releases. Re-check whenever DABS renames a code or its monthly sales name
  changes. Never auto-apply an image to reused codes (9 in this sample).
- **DABS names are truncated and occasionally misspelled** ("SALICE",
  "ARNOD"). Keep the explicit alias lists, and send anything unmatched to
  possible, never to a fuzzy match.
- **Related-product strips, logos and placeholders** share the page with the
  right product. Only trust JSON-LD/og images on product pages, and still
  look.
- **GTINs appeared on 14 retailer pages**, but DABS publishes no UPC, so a
  GTIN can only corroborate between sources.

## Recommendation

1. **Threshold:** publish only **exact** under these rules, after a second
   look by the owner. For wine, **representative** may be shown only with a
   visible "label shown may be another vintage" note, and never for
   spirits, beer or special releases. Never show possible.
2. **Rights first:** decide separately whether to use producer or retailer
   pack shots with unknown permission. Every exact here is unknown.
3. **Next step, if you want to continue:** a 250-listing run of the same
   pipeline, with model-assisted triage and a person approving each exact,
   still staging only. Scaling to 1,000 makes sense only if that run holds
   up.

## Files

- `select-sample.ts`, `fetch-dabs.ts`, `fetch-candidates.ts`, `images.py`,
  `identity.ts`, `classify.ts`, `facts.ts`, `summary.py`, `highlights.py`,
  `packet.py`, and the review helpers `rev.py` / `crop.py` / `add_sources.py`.
- `data/`: sample, demand counts, DABS side, sources with provenance,
  candidates (pages, extracted identity text, image URLs), image hashes,
  review verdicts, results, facts, summary.
- Rerun, from the repo root: `npx tsx pilot/photo-enrichment/fetch-candidates.ts`
  (with `NODE_OPTIONS=--max-http-header-size=65536`), then
  `python3 pilot/photo-enrichment/images.py <sheet_dir>`, then
  `npx tsx pilot/photo-enrichment/classify.ts`,
  `npx tsx pilot/photo-enrichment/facts.ts`,
  `python3 pilot/photo-enrichment/summary.py` and
  `python3 pilot/photo-enrichment/packet.py out.html`.
