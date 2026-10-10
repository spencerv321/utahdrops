# Product page: local answer first (2026-09-27)

Local build against a local Postgres loaded with the **real** DABS catalog and
a real 40-product store-by-store pass (`scripts/scrape.ts catalog`, then
`store-inventory` with `STORE_SCRAPE_BUDGET=40`, run 2026-09-27 ~04:05 UTC).
No stock was made up. The area comes from the `ud_area` cookie.

| File | State | Bottle |
|---|---|---|
| `390-fresh-positive-parkcity.png` | fresh positive | Ardbeg Uigeadail (004111), Park City |
| `390-fresh-zero-stgeorge.png` | fresh scoped zero, stock elsewhere named | same, Saint George |
| `390-no-area.png` | no area chosen | same |
| `390-statewide-zero.png` | statewide zero | Ardbeg Dark Cove (000131) |
| `390-unknown-never-checked.png` | unknown (never checked store by store) | Natty Daddy (918885) |
| `390-stale-lastknown-AGED50h.png` | stale last-known | The Dalmore 14 (006075). **Real counts; the local check time was moved back 50h to show this state** |
| `320-fresh-positive-full.png` | full page at 320px (no horizontal overflow) | 004111 |
| `1280-fresh-positive.png` | desktop | 004111 |

"Out of date" (a newer statewide count rules nearby counts out) and delisted/drawing
releases are covered by `tests/local-availability.test.ts`, not screenshots.
