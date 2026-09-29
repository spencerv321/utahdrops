# DABS-attached images: follow-up to the photo pilot (2026-09-29)

Staging only. Nothing was published or deployed, and nobody was contacted.
The input is the frozen 100 CSCs from `data/sample.json`, plus a separately
labeled 34-code sibling annex (other sizes and expressions of the same
brands). Counts are reproducible with the commands at the end.

## 1. Where the DABS image comes from

- **Source.** The public product detail page (`Products/GetDetailUrl?sku=` →
  `ProductDetail/Index`) embeds the photo **inline as a base64 PNG**
  (`alt="Product bottle or can"`). This is the same two-step request that
  `lib/dabs/detail.ts` and the store job already make, so there is no image
  URL or file ID. The image is simply part of the page for that CSC.
- **Resolution.** Every image is resized to **350 px tall**; widths run from
  90 to 524 px, and files are 28–244 KB (median 67 KB).
- **Other public DABS surfaces carry nothing:**
  - the catalog JSON (`LoadProductTable`) has no image field;
  - the locator scripts have no image route;
  - the monthly product-list XLSX has no image column (its columns: CSC,
    Description, Div/Dept/Class, Size, Price, Status, SPA, Vendor);
  - the drawing and allocated pages have no product images.
- **Origin.** The DABS
  [New Item Listings](https://abs.utah.gov/vendors/new-item-listings/) page
  says vendor applications include a "High-resolution product image" and
  "Images of unit and case UPCs". So these are vendor-supplied at listing
  time. DABS publishes only the 350 px copy and no UPC.
- **Scope.** This is a catalog-wide source, not an isolated case: 38 of the
  100 sample CSCs have an image, and so do 21 of the 34 sibling codes. It is
  keyed per CSC, but it is not a clean identity source (section 2).
- **Rights.** Utah.gov's [disclaimer](https://www.utah.gov/support/disclaimer.html):
  "The State makes no warranty … that the materials contained within these
  pages are free from copyright claims, or other restrictions or limitations
  on free use or display." Rights are **not established for any DABS image**.

## 2. The same 100 CSCs through the DABS source

I reviewed all 38 images, beside the pilot's external candidates and with
zooms where needed. Verdicts are in `data/dabs-review.json`, and hashes and
nearest external matches in `data/dabs-images.json`.

| | count |
|---|---|
| CSCs with a DABS image | 38 / 100 (popular 27/60, difficult 11/40; spirits 15/57, wine 16/27, beer 7/13, other 0/3) |
| Looked right for the listed item | 20 match, 13 right family only, **5 conflict** |
| Size legible in the picture | 3 (Uinta "12 FL. OZ.", Dented Brick "750 ML", Black Box "3L") |
| Size shown only by shape (handle/PET, flask, 12 vs 16 oz can) | 9 |
| Near-identical to a pilot candidate (phash ≤ 10) | 11, mostly the producer's own file (Epic cans at distance 2, Blanton's at 8) |
| Same file on two sample CSCs | 0 |
| Clears the pilot's 400 px card rule | 3 (all wide cans) |

**Reuse across sizes and expressions** (sibling annex, outside the frozen 100):

- **Identical file on every size:**
  - Five Wives Vodka, one file on 375 / 750 / 1000 / 1750 ml; the 1.75 L
    listing shows a 750-style bottle.
  - Porter's Fire, one file on 375 / 750 / 1750 ml.
- **A distinct picture per size:** Barton, Canadian Host, Taaka, Evan
  Williams BiB, and Epic cans vs 651 ml bottles.
- **Expressions kept apart:** Kim Crawford vs Illuminate, and Buffalo Trace
  vs Bourbon Cream, have separate pictures.
- **Template trap:** Dented Brick Premium Gin and Premium Vodka are
  near-duplicates (phash 6) and differ only in the word GIN/VODKA, so hash
  matching alone would merge two products.

**Reused codes.** DABS shows only the current image, so change over time
can't be observed. What can be seen is that **images are frozen at listing
time:**
- Black Box Chardonnay shows a 2016 box;
- Joel Gott Pinot Noir shows the 2021 label while the producer shows 2023.

Of the 9 reused codes in the sample, two have a DABS image (Spottswoode
'24/'25 and Sokol Blosser). Neither image's vintage is legible, so neither
can be tied to the current item.

**Exact-looking successes**
- **Dented Brick Premium Gin:** "PREMIUM GIN … 750 ML" legible. The external
  page had shown "Grain to Glass Gin".
- **Uinta Detour:** "12 FL. OZ." legible, and no external page was reachable.
- **La Marca:** the classic Prosecco D.O.C., which no external page had.
- **Bergström:** the label confirms "SILICE"; DABS's "SALICE" is a typo.
- **Canadian Host:** no public page existed anywhere, and DABS has a
  size-specific picture for each size.
- **Blanton's (016850):** DABS attaches the producer's own packshot. That is
  strong provenance, but the picture shows no volume.

**Dangerous failures**
- **Black Box:** a 2016 box, where the current box is non-vintage.
- **Five Wives 1.75 L:** shows the 750 bottle.
- **Porter's Fire 375 ml:** shows the full-size bottle.
- **Juicy Haze "CAN 355 ml":** the picture is the 12-pack carton.
- **Sonoma-Cutrer "RR":** the label reads "Sonoma Coast".
- **Joel Gott:** a 2021 label.

## 3. Three judgments, kept apart

- **Attached to the official CSC** (provenance): yes for 38.
- **Visually verified exact depiction:** 2 under the pilot's strict rules
  (size legible, no conflict, clean). Both fail the 400 px card rule, so
  **0 pass everything**.
- **Reuse rights established:** 0.

No DABS image was promoted to exact or treated as rights-cleared.

## 4. Practical yield (exact matches)

| | listings | External only | DABS only, strict | **Combined, strict** | + shape cue | + one-size catalog |
|---|---|---|---|---|---|---|
| All | 100 | 14 | 2 | **16** | 24 | 28 |
| Popular | 60 | 8 | 0 | **8** | 13 | 17 |
| Difficult | 40 | 6 | 2 | **8** | 11 | 11 |
| Spirits | 57 | 12 | 1 | **13** | 17 | 21 |
| Wine | 27 | 1 | 0 | **1** | 1 | 1 |
| Beer | 13 | 0 | 1 | **1** | 5 | 5 |

- **The two sensitivity rules are not recommendations.** "Shape cue" counts
  a 1.75 L PET/handle bottle, a flask or can proportions as size evidence.
  "One-size catalog" accepts a DABS picture when DABS's whole catalog has no
  other size of that item.
- **Resolution:** with the 400 px rule applied, the DABS contribution drops
  to 0.
- **Difficult cases didn't cause the low yield.** Popular listings were 8/60
  (13%) exact, no better than the difficult ones (6/40), and DABS adds
  **nothing** to popular listings under the strict rules. The bottleneck is
  proving size and current packaging for ordinary bottles, not hard cases.
- **Of the 43 "possible" listings**, strict DABS evidence upgrades **0**.
  The shape cue would upgrade 3 (Chasing Ghosts, Spiral Jetty, Evan Williams
  BiB 1.75 L), and the one-size rule 6 (adding Blanton's, Elijah Craig
  Toasted Barrel and Buffalo Trace). The strict gains (Dented Brick, Uinta)
  both come from "no image".
- **Wine:** DABS adds 9 *representative-only* candidates, taking
  exact-or-representative from 10 to 19 of 27. Vintage is legible on only 2
  of 16 DABS wine images, and both are stale (2016, 2021).
- **Cost:**
  - Fetch: 100 detail pages took 3.6 minutes at the shared DABS pace, about
    37 minutes per 1,000 CSCs. It would cost nothing extra if the store job
    kept the image it already downloads, but that is a production change I
    haven't made.
  - Review: one small image per listing plus a per-brand sibling check, about
    40 s per listing with an image; roughly 4–6 hours per 1,000 CSCs.
  - Storage: 76 KB average, about 30 MB per 1,000 CSCs at 38% coverage.
- **Quality:** a clean white background and consistent framing, but 350 px
  is thumbnail-only, and 2 of 38 were composites or moody shots (E.H. Taylor
  with its tube, High West).

## 5. Review packet

- Each listing now shows a boxed **"Listing result"**. Every candidate
  carries its own **"This image: accepted / possible / rejected"** tag, and
  rejected images are struck with a red ✕ and greyed.
- The "ten failures" list shows both verdicts side by side, so the Cabernet
  "815" share image reads "✕ This image: rejected" next to "Listing result:
  Representative".
- Each listing also has a **DABS attached image** panel showing the three
  judgments separately. A follow-up section at the top has the yield table,
  the sibling reuse strips and the DABS successes and failures.
- All earlier review evidence is unchanged.

## 6. Recommendation

**No image rollout yet, and don't run the 250-product sourcing run.** Neither
source moves popular listings, and every usable image has unknown rights. If
you want to continue, the next step is a **small curated set**: about 30 of
the most-watched or most-viewed bottles, checked by hand with a second
reviewer. DABS images should be used there as provenance evidence during
review, not as the published asset.

**Proceed to a larger sourcing run only if all of these hold:**
1. A written rights decision per source class (producer, retailer, DABS).
2. Strict combined exact ≥ 35% on a fresh 50-listing popular sample.
3. A second reviewer finds 0 wrong images among at least 30 exact matches
   (upper bound ≤ 10%).
4. Review time ≤ 2 minutes per listing.

**Use a DABS image as evidence for a listing only when:**
- no identical or near-identical DABS file sits on another size or
  expression of that brand;
- size is visible in the picture;
- no vintage or packaging conflict is visible;
- it is re-checked when DABS renames the code.

**Stop** if the curated round's strict yield on popular listings stays below
20%; improve text facts instead.

### How others show pictures

Observed through public pages and code only. I couldn't render outside sites
here.

- **DABS:** verified. Inline vendor photos on detail pages, 38% coverage in
  this sample, reused across sizes for some brands, and sometimes stale. The
  UT DABS app's store listing doesn't mention photos.
- **Liquor In Front:** verified from its public script. It fetches
  `/api/products/{sku}/image`, and its CSS comment says its thumbnails are
  "the DABS photos". So it inherits DABS's reuse and staleness.
- **Utah Neat:** verified from its robots-allowed API. 175 of 783 products
  have an `image_url`, all hotlinked from a whisky review site, using only
  62 distinct images.
  - 147 products share an image with a different product: Ardbeg 10, 17, 25,
    Uigeadail and Anthology 14 all point to "An Oa"; one High West Double Rye
    picture covers 14 High West codes, including Bourbon 375, 750 and
    1750 ml.
  - Whether its pages render these images wasn't checked.
- **Heathen:** an App Store claim only ("See product pictures (where
  available)", last update April 2023). Not verified.
- **Takeaway:** a store app showing a photo doesn't mean it solved exact SKU
  matching. The one catalog-scale public source is DABS's own image, and it
  has the size-reuse and staleness problems above.

## Reproduce

```bash
npx tsx pilot/photo-enrichment/fetch-dabs-images.ts            # 100 CSCs → data/dabs-images.json
npx tsx pilot/photo-enrichment/fetch-dabs-images.ts siblings   # annex → data/dabs-images-siblings.json
python3 pilot/photo-enrichment/dabs-compare.py <sheet_dir>     # dims, hashes, nearest external, sheets
python3 pilot/photo-enrichment/dabs-yield.py                   # tables above → data/dabs-yield.json
python3 pilot/photo-enrichment/packet.py out.html              # review packet
```

The one-size-catalog column needs the local catalog DB (`scrape.ts catalog`).
Visual verdicts are in `data/dabs-review.json` and competitor observations in
`data/competitors.json`.
