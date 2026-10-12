/**
 * Utah makers (/makers): every brewery, distillery, winery and cidery on
 * DABS's "Proudly Utah" list, one page per business (DABS lists a few
 * businesses twice, e.g. Moab Brewery and Moab Distillery; those share a page
 * and keep both listings in `dabs`), plus licensed makers that aren't on that
 * list, found in DABS's Licensee List (`dabs` empty, `licenses` set).
 *
 * Same rule as Utah 101 and bottle notes: our words, every fact from a cited
 * source, no guessing. Each claim carries the ids of the sources it relies
 * on: a maker's own `sources`, or one of MAKER_SOURCES below (shared by many
 * makers). "What locals say" summarizes local press and reader polls; it
 * never quotes reviews. A section with nothing we could confirm stays empty
 * and the page says so. Owner-written firsthand notes go in `notes`
 * (credited and dated). Data: data/makers.json; how to edit: data/makers.md.
 */
import data from "@/data/makers.json";
import { LICENSEE_REPORT_URL } from "@/lib/licensees";

export type MakerKind = "brewery" | "distillery" | "winery" | "cidery";

export type Source = { title: string; publisher: string; url: string; date?: string };

/** One sentence in our words, with the sources it relies on. */
export type Claim = { t: string; s: string[] };

export type MakerPlace = { name: string; address: string; city: string };

/** A DABS license row (Licensee List), copied as DABS wrote it. */
export type MakerLicense = { number: string; type: string; name: string; address: string; since: string };

export type MakerNote = {
  text: string;
  /** Who wrote it, as it should be credited. */
  by: string;
  /** ISO date of the visit or note. */
  date: string;
};

export type Maker = {
  slug: string;
  name: string;
  kinds: MakerKind[];
  /** The business's entries on DABS's Proudly Utah list, as DABS wrote them. */
  dabs: { listedAs: string; kind: MakerKind; address: string }[];
  /** For makers not on Proudly Utah: their DABS licenses, from the Licensee List. */
  licenses?: MakerLicense[];
  /** Empty when the maker has no website we could find. */
  website: string;
  places: MakerPlace[];
  summary: Claim;
  makes: Claim[];
  visit: Claim[];
  toGo: Claim[];
  locals: Claim[];
  notes: MakerNote[];
  /**
   * Which catalog products are this maker's: DABS vendor codes (from the
   * monthly product list, `products.vendor_code`) and/or name prefixes for
   * brands sold through a distributor. `exclude` drops a matched CSC.
   */
  catalog: { vendors?: string[]; prefixes?: string[]; exclude?: string[] };
  sources: Record<string, Source>;
  /** ISO date this maker's sources were read, when later than MAKERS_CHECKED. */
  checked?: string;
};

/** Sources several makers cite. */
export const MAKER_SOURCES = {
  dabsProudlyUtah: {
    title: "We are Proudly Utah: local breweries, distilleries, wineries and cideries",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/shop-products/proudly-utah/",
  },
  licenseeList: {
    title: "Current DABS licenses and permits (Licensee List), read October 12, 2026",
    publisher: "Utah DABS",
    url: LICENSEE_REPORT_URL,
  },
  dabsPackageAgencies: {
    title: "Package agencies (the five types, including Type 5 at manufacturers)",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/package-agencies/",
  },
  dabsProductList: {
    title: "Monthly product list (item, status and vendor), October 2026",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/shop-products/product-lists/",
  },
  cw25Libations: {
    title: "Best of Utah 2025: libations (reader poll)",
    publisher: "City Weekly",
    url: "https://www.cityweekly.net/best-of-utah/best-of-utah-2025---libations-404dd06f",
    date: "November 21, 2025",
  },
  cw25Nightlife: {
    title: "Best of Utah 2025: restaurants & nightlife (reader poll)",
    publisher: "City Weekly",
    url: "https://www.cityweekly.net/best-of-utah/best-of-utah-2025---restaurants-nightlife-bc22101a",
    date: "November 2025",
  },
  cityCastBreweries: {
    title: "The best breweries (reader picks)",
    publisher: "City Cast Salt Lake",
    url: "https://saltlake.citycast.fm/best/the-best-breweries",
    date: "updated September 30, 2025",
  },
  slm2025: {
    title: "Grain-to-glass: distillery roundup in Utah",
    publisher: "Salt Lake Magazine",
    url: "https://saltlakemagazine.com/grain-to-glass-distillery-roundup-in-utah/",
    date: "April 10, 2025",
  },
} satisfies Record<string, Source>;

export const MAKERS_PATH = "/makers";
export const makerPath = (slug: string) => `${MAKERS_PATH}/${slug}`;

/** ISO date we last re-read the sources for every maker. */
export const MAKERS_CHECKED: string = data.checked;

// Shape is checked by tests/makers.test.ts (JSON imports widen string unions).
export const MAKERS: Maker[] = data.makers as unknown as Maker[];

export const makerChecked = (maker: Maker): string => maker.checked ?? MAKERS_CHECKED;

export function getMaker(slug: string): Maker | undefined {
  return MAKERS.find((m) => m.slug === slug);
}

/** A claim's source, from the maker's own list or the shared one. */
export function sourceFor(maker: Maker, id: string): Source | undefined {
  return maker.sources[id] ?? (MAKER_SOURCES as Record<string, Source>)[id];
}

/** Every source a maker's page cites, in first-cited order (for footnote numbers). */
export function citedSources(maker: Maker): { id: string; source: Source }[] {
  const ids: string[] = [];
  for (const c of [maker.summary, ...maker.makes, ...maker.visit, ...maker.toGo, ...maker.locals]) {
    for (const id of c.s) if (!ids.includes(id)) ids.push(id);
  }
  // Every page shows its DABS listing or licenses, so that list is always a source.
  const listing = maker.dabs.length > 0 ? "dabsProudlyUtah" : "licenseeList";
  if (!ids.includes(listing)) ids.push(listing);
  if (hasCatalogLink(maker) && !ids.includes("dabsProductList")) ids.push("dabsProductList");
  // The "Bottles to go" section always explains Type 5 package agencies.
  if (!ids.includes("dabsPackageAgencies")) ids.push("dabsPackageAgencies");
  return ids.map((id) => ({ id, source: sourceFor(maker, id)! }));
}

export function hasCatalogLink(maker: Maker): boolean {
  return (maker.catalog.vendors?.length ?? 0) + (maker.catalog.prefixes?.length ?? 0) > 0;
}

export const KIND_LABEL: Record<MakerKind, { one: string; many: string }> = {
  brewery: { one: "Brewery", many: "Breweries" },
  distillery: { one: "Distillery", many: "Distilleries" },
  winery: { one: "Winery", many: "Wineries" },
  cidery: { one: "Cidery", many: "Cideries & meaderies" },
};

export const KIND_ORDER: MakerKind[] = ["brewery", "distillery", "winery", "cidery"];

export function kindsLabel(kinds: MakerKind[]): string {
  return kinds.map((k) => KIND_LABEL[k].one).join(" & ");
}

/** Regions for the index, by the city of a maker's first place. */
export const REGIONS = [
  {
    key: "salt-lake",
    label: "Salt Lake County",
    cities: [
      "Salt Lake City", "South Salt Lake", "Midvale", "Murray", "Millcreek", "Cottonwood Heights",
      "Sandy", "Draper", "Herriman", "West Valley City",
    ],
  },
  {
    key: "north",
    label: "Ogden, Logan & the north",
    cities: ["Ogden", "Layton", "Pleasant View", "Eden", "Logan", "Mendon", "Hyde Park"],
  },
  { key: "park-city", label: "Park City, Heber & Kamas", cities: ["Park City", "Wanship", "Kamas", "Heber City"] },
  { key: "utah-county", label: "Utah County", cities: ["Pleasant Grove", "Springville", "Lehi"] },
  { key: "tooele", label: "Tooele County", cities: ["Tooele", "Grantsville"] },
  { key: "central", label: "Sanpete & central Utah", cities: ["Moroni"] },
  {
    key: "south",
    label: "St. George, Zion & Cedar City",
    cities: ["St. George", "Cedar City", "Leeds", "Springdale", "Hildale", "Dammeron Valley"],
  },
  { key: "east", label: "Moab, Capitol Reef & eastern Utah", cities: ["Moab", "Torrey", "Helper", "Vernal"] },
] as const;

export type RegionKey = (typeof REGIONS)[number]["key"];

export function regionOf(maker: Maker): RegionKey | null {
  const city = maker.places[0]?.city;
  return REGIONS.find((r) => (r.cities as readonly string[]).includes(city))?.key ?? null;
}

/** "Salt Lake City", or "Salt Lake City & Park City" for makers with places in several cities. */
export function citiesLabel(maker: Maker): string {
  return [...new Set(maker.places.map((p) => p.city))].join(" & ");
}

/**
 * The maker for a product, by vendor code or name prefix. Used on product
 * pages ("Made in Utah by …"). Mirrors the SQL match in lib/maker-products.ts.
 */
export function makerForProduct(p: { csc: string; name: string; vendor_code?: string | null }): Maker | undefined {
  const name = p.name.toUpperCase();
  return MAKERS.find(
    (m) =>
      !m.catalog.exclude?.includes(p.csc) &&
      ((p.vendor_code != null && m.catalog.vendors?.includes(p.vendor_code)) ||
        m.catalog.prefixes?.some((pre) => name.startsWith(pre)))
  );
}
