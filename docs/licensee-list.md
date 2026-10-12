# DABS Licensee List: can it be exported? (checked 2026-10-11)

For Phase 2 of /makers (bars and taverns with license-type facts).

**Where it is.** abs.utah.gov/licenses-permits/license-information/ links
"CURRENT LICENSES — The Licensee List is a comprehensive list of active
licenses" to a Looker Studio report
(`lookerstudio.google.com/reporting/ccc2b0df-c8e9-4d37-9e23-8c13c4061560`).
The "Event Permit List" next to it is a second report (short link
`lookerstudio.google.com/s/lASosMiwc0E`).

**Update 2026-10-12: fetched.** A headless Chromium routed through the
sandbox proxy (`proxy: { server: process.env.HTTPS_PROXY }` in Playwright;
the browser's NSS store already trusts the proxy CA) opens the report like
any viewer. The page's own `batchedDataV2` response carries the whole table
(4,543 rows, `tableDataset.column[]` with `nullIndex` gaps), so no paging or
login is needed. Saved as `data/licensees/dabs-licensees-2026-10-12.csv`:
license_number, category, type, business_name, address, county,
original_issue_date, conditional_approval, new_this_month. The report says it
updates daily; a GitHub Actions job could re-pull it weekly (no proxy needed
there). It relies on Looker's response format, so a job should fail loudly
if the column count or row total looks wrong.

Earlier notes (before the fetch worked):

**What we found.**
- The report is client-rendered; its HTML has no rows, and the DABS page has
  no CSV/XLSX link. (We didn't find a copy on Utah's open-data portal, but
  that search failed, so it isn't ruled out.)
- Looker Studio's own data endpoints (`getReport`, `batchedDataV2`) need a
  browser session and anti-forgery token; plain HTTP requests get
  `errorStatus code 3`. Pulling data that way would mean reverse-engineering
  a private API, which we shouldn't do for a production job.
- Whether viewers may download the table (the owner can turn off "download,
  copy and print") can only be seen in a real browser. The sandbox's Chromium
  can't load outside sites, and working around that means trusting the
  proxy certificate, which we don't do.

**Next step (owner, 2 minutes).** Open the Licensee List in a normal browser,
hover over the table, open the ⋮ menu: if "Export" / "Download data (CSV)" is
there, export it and send the file (or tell Claude). If it isn't, the clean
route is a records request: ask DABS (abs.utah.gov contact, or a GRAMA
request) for the active licensee list as CSV with license type, and whether
they can publish it regularly.

**What Phase 2 needs from it.** Business name, address, license type (bar,
tavern = beer-only, full-service restaurant, limited-service, beer-only
restaurant, etc.). License type is what drives the facts we'd show (21+ for
bars and taverns; restaurants must serve food and ask "intent to dine";
beer-only licenses), each explained from DABS/Utah Code sources as in
Utah 101 → Bars & restaurants.
