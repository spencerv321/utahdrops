/**
 * DABS licensees (/bars): the public Licensee List report, parsed and
 * normalized. Pure functions only (no DB, no browser) so they're unit-tested;
 * fetching lives in scripts/licensees.ts, storage in lib/jobs/licensees.ts.
 *
 * The report is a Looker Studio (Data Studio) table. Its page loads the whole
 * table in one `batchedDataV2` response: `tableDataset.column[]`, one entry
 * per column, each a values array that skips the rows listed in `nullIndex`.
 */

export const LICENSEE_REPORT_URL =
  "https://lookerstudio.google.com/reporting/ccc2b0df-c8e9-4d37-9e23-8c13c4061560";

/** Report columns, in the order the table shows them. */
export const LICENSEE_COLUMNS = [
  "license_number",
  "category",
  "type",
  "business_name",
  "address",
  "county",
  "original_issue_date",
  "conditional_approval",
  "new_this_month",
] as const;

export interface Licensee {
  license_number: string;
  category: string;
  type: string;
  business_name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  /** ISO date. */
  original_issue_date: string | null;
  conditional_approval: boolean | null;
  new_this_month: boolean;
}

/** A pull smaller than this is a broken report or a changed format, not reality (Oct 2026: 4,543). */
export const MIN_LICENSEES = 3000;

type LookerColumn = { nullIndex?: number[] } & Record<string, { values?: unknown[] } | number[] | undefined>;

/** Rows of the report's table from one batchedDataV2 response body (with or without the ")]}'" prefix). */
export function parseLookerTable(body: string): string[][] | null {
  const start = body.indexOf("{");
  if (start < 0) return null;
  let data: unknown;
  try {
    data = JSON.parse(body.slice(start));
  } catch {
    return null;
  }
  const responses = (data as { dataResponse?: unknown[] }).dataResponse ?? [];
  for (const r of responses) {
    for (const sub of (r as { dataSubset?: unknown[] }).dataSubset ?? []) {
      const td = (sub as { dataset?: { tableDataset?: { totalCount?: number; column?: LookerColumn[] } } }).dataset
        ?.tableDataset;
      if (!td?.column || td.column.length !== LICENSEE_COLUMNS.length || !td.totalCount) continue;
      const n = td.totalCount;
      const cols = td.column.map((c) => {
        const key = Object.keys(c).find((k) => k !== "nullIndex")!;
        const values = ((c[key] as { values?: unknown[] })?.values ?? []).map((v) => (v == null ? "" : String(v)));
        const nulls = new Set(c.nullIndex ?? []);
        if (values.length !== n - nulls.size) throw new Error(`licensees: column ${key} has ${values.length} values for ${n} rows`);
        let k = 0;
        return Array.from({ length: n }, (_, i) => (nulls.has(i) ? "" : values[k++]));
      });
      return Array.from({ length: n }, (_, i) => cols.map((c) => c[i].trim()));
    }
  }
  return null;
}

/** Typed rows from the report's 9 string columns (or a CSV row in the same order). */
export function toLicensee(cells: string[]): Licensee {
  const [license_number, category, type, business_name, address, county, date, conditional, isNew] = cells;
  return {
    license_number,
    category,
    type,
    business_name,
    address: address || null,
    city: cityFromAddress(address),
    county: county || null,
    original_issue_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    conditional_approval: conditional === "Yes" ? true : conditional === "No" ? false : null,
    new_this_month: isNew === "New",
  };
}

// Places whose real name ends in "City"; any other trailing "City"/"Town" is
// DABS's way of naming the municipality ("MOAB CITY", "HERRIMAN TOWN").
const REAL_CITY_NAMES = new Set([
  "SALT LAKE CITY", "PARK CITY", "CEDAR CITY", "BRIGHAM CITY", "HEBER CITY", "GARDEN CITY",
  "BRYCE CANYON CITY", "SPRING CITY", "BEAR RIVER CITY", "WEST VALLEY CITY",
]);
const CITY_FIXES: Record<string, string> = {
  PARKCITY: "Park City",
  SLC: "Salt Lake City",
  "SOUTH ODGEN": "South Ogden",
  "ST GEORGE": "St. George",
  "SOUTH SALT LAKE": "South Salt Lake",
  "LA VERKIN": "La Verkin",
  "MARRIOTT-SLATERVILLE": "Marriott-Slaterville",
};

/**
 * The town from a DABS address ("…, MOAB CITY, UT 84532" → "Moab"). Null
 * when the part before the state is a street (unincorporated addresses).
 */
export function cityFromAddress(address: string | null | undefined): string | null {
  const parts = (address ?? "").split(",").map((p) => p.trim());
  const ut = parts.findLastIndex((p) => /^(UT|UTAH)\b/i.test(p));
  if (ut < 1) return null;
  let city = parts[ut - 1].toUpperCase().replace(/\s*\(.*\)\s*$/, "").trim();
  if (!city || /\d/.test(city) || /^UNIT\b/.test(city) || / COUNTY$/.test(city)) return null;
  city = city.replace(/^CITY OF\s+/, "");
  if (!REAL_CITY_NAMES.has(city)) city = city.replace(/\s+(CITY|TOWN|TOWNSHIP)$/, "");
  return CITY_FIXES[city] ?? titleCase(city);
}

const SMALL = new Set(["of", "and", "the", "at", "on", "in", "a", "de", "la", "el"]);

/** "BEERHIVE PUB" → "Beerhive Pub", "GRACIE'S" → "Gracie's"; mixed-case input is kept. */
export function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/[a-z0-9][a-z0-9'’.]*/g, (w, i: number) =>
      i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
    );
}

/** Business name for display: title-cased if DABS shouted it, without trailing license codes like "(BAR)" or "(CBN-2-003)". */
export function displayName(name: string): string {
  const trimmed = name.replace(/\s*\((?:[A-Z]{2,3}|[A-Z0-9/-]*\d[A-Z0-9/-]*)\)\s*$/, "").trim() || name.trim();
  return titleCase(trimmed);
}
