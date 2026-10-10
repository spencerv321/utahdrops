# Bottle photos

Verified product photos live in `public/bottles/<csc>.webp` (cut out, 400px
tall). `lib/bottle-photos.json` maps every product that shares a label
(other sizes) to its photo; `data/bottle-photo-sources.json` records where
each photo came from, so one can be traced and removed. `components/bottle-photo.tsx`
shows the photo, or the container glyph when there is none.

Rule: the photo must show the right label. Size and vintage/edition may
differ (a 750ml shot stands in for the 1.75L). A different expression is
never OK. No generic stock photos. When unsure, leave the bottle without one.

## Adding a batch (run in the cloud sandbox, not in Actions)

1. `report.yml` with `phototargets:300` → save the `top N` JSON rows as `targets.json`.
2. In a scratch directory: `npm i sharp`, copy these scripts in, and export the
   catalog (`catalog.json`: `[{csc, name, size_ml}]`, listed products) so other
   sizes of a label get the same photo.
3. `node harvest.mjs targets.json <start> <count>`: searches Yahoo Images
   (DuckDuckGo fallback, paced), downloads up to 6 candidates per label, and
   writes contact sheets to `out/sheets/`. Resumable. Bing serves decoy
   results to scripts; don't use it.
4. Review every sheet and write `picks.json`: `{ "<csc>": index | [index, note]
   | [index, note, threshold, mode, step] | {"same": "<csc>"} | null }`
   (`same` reuses another product's photo, e.g. a "PET" listing). Prefer plain
   white-background bottle shots.
5. `node apply.mjs <repo>` processes picks into the repo files; then
   `node preview.mjs check.jpg <repo>/public/bottles/*.webp` and look at every
   cutout on the dark background (halos, labels eaten by the cutout). Fix with
   another candidate or a smaller `step`: 5–6 for white labels, 4 for clear
   bottles, 2–3 for wine boxes, white cans and frosted bottles.
