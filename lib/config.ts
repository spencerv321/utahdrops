export const SITE_NAME = "Utah Drops";
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

export const STATUS_LABELS: Record<string, string> = {
  "1": "General",
  A: "Allocated",
  D: "Discontinued (clearance)",
  L: "Limited",
  N: "Unavailable",
  P: "Limited availability",
  S: "Special order",
  T: "Trial",
  U: "Unavailable soon",
  X: "Discontinued limited",
};

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
 * watched bottles from every store pass (scheduled every 6h in
 * store-inventory.yml, but GitHub skips about half: ~2 runs/day observed
 * 2026-09-24), with a reserved share of each run. Check against report.yml → freshness.
 */
export const WATCH_REFRESH_NOTE =
  "We check statewide stock about 3 times a day, and store-by-store stock for watched bottles about twice a day.";

/** Watchlisted SKUs get scrape priority, so keep one account from hogging it. */
export const MAX_WATCHLIST = 50;

/** Home stores per user for "back at my store" alerts. */
export const MAX_HOME_STORES = 3;

/**
 * Oldest acceptable last success per job, in hours (/api/health, /admin).
 * GitHub's scheduler often skips or delays "hourly" runs by several hours, so
 * digest also runs right after each catalog / store-inventory pass; 8h leaves
 * room for that without paging on GitHub's gaps.
 */
export const JOB_MAX_AGE_HOURS: Record<string, number> = {
  catalog: 12,
  store_inventory: 18,
  allocated: 24,
  digest: 8,
};
