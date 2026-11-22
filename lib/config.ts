export const SITE_NAME = "Utah Drops";
/** Public contact address (corrections, questions). */
export const CONTACT_EMAIL = "utahdrops@gmail.com";
export const SITE_TAGLINE = "Find any bottle at Utah's state liquor stores";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === "production" ? "https://utahdrops.com" : "http://localhost:3000");

export const DABS_LOCATOR_URL =
  "https://webapps2.abc.utah.gov/ProdApps/ProductLocatorCore";
export const DABS_ALLOCATED_URL =
  "https://abs.utah.gov/shop-products/allocatedandrare/";
export const DABS_PRODUCT_LIST_PAGE =
  "https://abs.utah.gov/shop-products/interactive-product-list/";
export const DABS_SALES_ANALYSIS_PAGE =
  "https://abs.utah.gov/vendors/sales-analysis/";
export const DABS_RHDP_URL =
  "https://webapps2.abc.utah.gov/ProdApps/RareHighDemandProducts";

/** Compliance: every inventory display must carry "as of" + official link. */
export const DABS_DISCLAIMER =
  "Not affiliated with or endorsed by the Utah Department of Alcoholic Beverage Services. " +
  "Inventory data is collected from public DABS pages and may be out of date. " +
  "No availability is guaranteed — always confirm with the store.";

/**
 * DABS listing status codes, worded for shoppers. Sources: DABS's product
 * locator names every code ("T  Trial Distribution", "U  Unavailable Limited
 * Distribution"…), and the 2026 Vendor Partnership Manual (section 2d) defines
 * 1, L, A, T and S. D, X, N, U and P have only their locator names, so their
 * words stay close to them: no claims about clearance prices or dates.
 * `label` is the full name (filters, history, listing details, emails),
 * `note` the short one beside a bottle in lists (none for general listings),
 * `explain` one line on the product page.
 */
export const STATUS_INFO: Record<string, { label: string; note: string | null; explain: string }> = {
  "1": {
    label: "General",
    note: null,
    explain: "A core item DABS stocks in most state stores.",
  },
  L: {
    label: "Limited: select stores",
    note: "Select stores",
    explain: "Stocked only in the stores where DABS expects it to sell.",
  },
  A: {
    label: "Allocated",
    note: "Allocated",
    explain: "Supply is limited by the maker, so DABS gets small amounts and releases them to select stores.",
  },
  T: {
    label: "Seasonal or trial",
    note: "Seasonal or trial",
    explain: "A one-time buy for a season or a short test. Once it sells out, DABS may not bring it back.",
  },
  S: {
    label: "Special order",
    note: "Special order only",
    explain: "Not stocked in stores. You can order it through DABS.",
  },
  D: {
    label: "Discontinued",
    note: "Discontinued",
    explain: "DABS has discontinued it, so what's left in stores won't be restocked.",
  },
  X: {
    label: "Discontinued (select stores)",
    note: "Discontinued",
    explain: "A select-stores item DABS has discontinued, so what's left won't be restocked.",
  },
  N: {
    label: "Unavailable",
    note: "Unavailable",
    explain: "DABS lists it as unavailable.",
  },
  U: {
    label: "Unavailable (select stores)",
    note: "Unavailable",
    explain: "A select-stores item DABS lists as unavailable.",
  },
  P: {
    label: "Limited availability",
    note: "Limited availability",
    explain: "DABS lists it as limited availability.",
  },
};

/** Full label for a status code (falls back to the raw code). */
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_INFO).map(([k, v]) => [k, v.label])
);

/**
 * Store-by-store checks older than this are treated as unknown everywhere on
 * the site. The store job normally re-checks a bottle every 1–4 days, so this
 * only trips after an outage or when rotation falls far behind.
 */
export const STORE_DATA_MAX_AGE_HOURS = 7 * 24;

export function isFreshStoreCheck(checkedAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!checkedAt) return false;
  return now - new Date(checkedAt).getTime() <= STORE_DATA_MAX_AGE_HOURS * 3600_000;
}

/**
 * What we promise about refresh speed, in one place. Statewide counts come
 * from the catalog pass (3×/day, catalog.yml); store-by-store counts for
 * watched bottles from every store pass (every 4h, store-inventory.yml,
 * usually started ~2h late by GitHub), with a reserved share of each run.
 * Measured 2026-09-25..29 (report.yml → freshness): watched bottles re-checked
 * at every store run, runs usually 4–6h apart (max 6.7h once the store job
 * sized runs by elapsed time), 38/38 within the 12h target at every check. Check against report.yml → freshness.
 */
export const WATCH_REFRESH_NOTE =
  "We check statewide stock about 3 times a day, and store-by-store stock for watched bottles several times a day (usually every 4 to 6 hours).";

/** Watchlisted SKUs get scrape priority, so keep one account from hogging it. */
export const MAX_WATCHLIST = 50;

/** Home stores per user for "back at my store" alerts. */
export const MAX_HOME_STORES = 3;

/**
 * Oldest acceptable last success per job, in hours (/api/health, /admin).
 * GitHub's scheduler often skips or delays "hourly" runs by several hours, so
 * digest also runs right after each catalog / store-inventory pass; 8h leaves
 * room for that without paging on GitHub's gaps. Catalog gets 16h because
 * GitHub sometimes runs only 2 of its 3 daily passes (~12h apart).
 */
export const JOB_MAX_AGE_HOURS: Record<string, number> = {
  catalog: 16,
  store_inventory: 12,
  allocated: 24,
  digest: 8,
};

/**
 * "Check DABS now" on a product page (app/api/check/[csc]): one live store
 * check for a visitor deciding whether to drive. It shares the DABS pacer
 * with the jobs, so it never raises the overall request rate; these caps
 * bound how much of that pace visitors can take.
 */
export const CHECK_NOW = {
  /** A check this recent is reused instead of asking DABS again. */
  reuseMinutes: 15,
  /** Per visitor IP, per hour. */
  perIpPerHour: 12,
  /** Across everyone, per UTC day (each check is 2 DABS requests). */
  dailyCap: 300,
  /** Per DABS request, while a visitor waits. */
  timeoutMs: 8_000,
  /** Longest wait for a slot from the shared pacer before saying "busy". */
  maxWaitMs: 6_000,
  /** Stop asking DABS for a while after this many failed checks in 10 minutes. */
  breakerFailures: 5,
} as const;
