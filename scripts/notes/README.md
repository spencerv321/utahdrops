# Bottle notes ("About this bottle")

Short descriptions for popular bottles that DABS describes poorly or not at
all. `lib/bottle-notes.json` holds one note per label (shared by its other
sizes); `data/bottle-note-sources.json` lists the pages each note was written
from. `lib/bottle-notes.ts` picks what the product page shows: our note, else
the DABS listing text unless it only talks about bottle size ("Larger bottle
of…").

## Rules
- Written in our own words from the cited pages (producer sites and reviews),
  2–3 sentences: what it is, who makes it, key facts, then tasting notes.
- Every fact (age, proof, mash bill, casks, region) must appear in a cited
  source. Conflicting or thin sources = no note. No price, stock or ratings.
- Annual editions, store picks and wines: say that they vary ("each barrel
  differs", "vintages vary", "this listing is the 2022 vintage").
- Only fill gaps: bottles with no DABS text, generic text shared by several
  products, or size-only blurbs. Good DABS text stays.

## Adding a batch (cloud sandbox)
1. `report.yml` with `notetargets:300` → save the JSON rows as `targets.json`;
   group by label and keep those without usable DABS text (`need.json`, see
   batch 1 in git history for the grouping).
2. In a scratch dir with `npm i cheerio`: `node gather.mjs need.json` (web
   search via DuckDuckGo HTML, Brave fallback; keeps fact-bearing paragraphs).
3. `node next.mjs 5` prints sources for the next bottles; write notes with
   `python3 add.py` (`csc|text|source indexes or URLs`, `-` to skip).
4. `python3 verify.py` flags numbers not found in the cited sources; check each.
5. `node apply.mjs <repo>` writes the two JSON files. Look at a few pages.
