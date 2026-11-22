/**
 * Holiday season (/holidays/<year> and the homepage strip). Pure rules, kept
 * apart from the SQL (lib/holiday-query.ts) so they can be tested.
 *
 * Bottles come from rules only, never hand-picked. A bottle counts when its
 * DABS name or category says it is a holiday or gift item, read through the
 * groups below. If few bottles qualify, the page shows few.
 */

export interface HolidayClosure {
  /** ISO date the stores are closed. */
  date: string;
  holiday: string;
  /** The last day stores are open before it. */
  lastDay: string;
}

export interface HolidaySeason {
  year: number;
  /** First and last day (inclusive, Mountain time) the homepage strip shows. */
  start: string;
  end: string;
  closures: HolidayClosure[];
}

/**
 * State holidays from Utah Code 63G-1-301 (New Year's Day, the fourth Thursday
 * of November, December 25). State stores close on state holidays and Sundays.
 */
export const SEASONS: HolidaySeason[] = [
  {
    year: 2026,
    start: "2026-11-14",
    end: "2027-01-02",
    closures: [
      { date: "2026-11-26", holiday: "Thanksgiving", lastDay: "2026-11-25" },
      { date: "2026-12-25", holiday: "Christmas", lastDay: "2026-12-24" },
      { date: "2027-01-01", holiday: "New Year's Day", lastDay: "2026-12-31" },
    ],
  },
];

export const HOLIDAY_SOURCES = {
  utahCode: {
    title: "Utah Code 63G-1-301, Legal holidays",
    url: "https://le.utah.gov/xcode/Title63G/Chapter1/63G-1-S301.html",
  },
  dabsClosures: {
    title: "DABS Commission agenda: stores close on state holidays (PDF)",
    url: "https://www.utah.gov/pmn/files/1453567.pdf",
  },
} as const;

/** Today's date in Utah, as YYYY-MM-DD. */
export function utahToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
}

/** The season showing on `now`, if any. `?holiday=1` previews outside the window. */
export function activeSeason(now = new Date(), force = false): HolidaySeason | null {
  const today = utahToday(now);
  const s = SEASONS.find((x) => today >= x.start && today <= x.end);
  return s ?? (force ? SEASONS[SEASONS.length - 1] : null);
}

export function seasonPath(s: HolidaySeason): string {
  return `/holidays/${s.year}`;
}

/** Closures still ahead (today counts), soonest first. */
export function upcomingClosures(s: HolidaySeason, now = new Date()): HolidayClosure[] {
  const today = utahToday(now);
  return s.closures.filter((c) => c.date >= today);
}

/** "Thu Nov 26" for an ISO date. */
export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type HolidayGroup = "nouveau" | "warm" | "nog" | "beer" | "gift" | "seasonal";

export const GROUPS: { key: HolidayGroup; label: string; blurb: string }[] = [
  {
    key: "nog",
    label: "Eggnog & peppermint",
    blurb: "Eggnogs, peppermint and gingerbread bottles.",
  },
  {
    key: "warm",
    label: "Mulled & spiced wine",
    blurb: "Glühwein and glögg: heat gently, don't boil.",
  },
  {
    key: "beer",
    label: "Holiday beer",
    blurb: "Christmas and winter beers, and holiday packs.",
  },
  {
    key: "nouveau",
    label: "Beaujolais Nouveau",
    blurb: "This year's Nouveau, released the third Thursday of November and made to drink young.",
  },
  {
    key: "seasonal",
    label: "Seasonal bottles",
    blurb: "Limited-time flavors and bottles DABS stocks for the season.",
  },
  {
    key: "gift",
    label: "Gift sets",
    blurb: "Bottles packed with glasses, a shaker or a gift box.",
  },
];

const NOUVEAU = /\bNOUVEAU\b/;
const WARM = /\b(GLUHWEIN|GLUEHWEIN|GLOGG|GLÖGG|MULLED|WASSAIL)\b/;
// DABS names run into the size ("EGG NOG750ml") and abbreviate ("PEP BARK", "PPRMINT").
const NOG = /\b(EGG ?NOG|NOG(?![A-Z])|PEPPERMINT|PPRMINT|PEP BARK|CANDY CANE|GINGERBREAD)/;
/** Truncated eggnog names in the liqueur gift sets ("CINNAMON SPICE EGG"). */
const EGG_LIQUEUR = /\bEGG\b/;
const BEER_CAT = /^(ALE|LAGER|BEER|DOMESTIC BEER|IMPORTED BEER|ALLOCATED BEER)\b/;
const BEER_WORDS = /\b(CHRISTMAS|XMAS|HOLIDAY|NOEL|WINTER|YULE|JINGLE|FESTIVE|SNOW|SANTA|WASSAIL)\b/;
const SEASONAL_WORDS = /\b(CHRISTMAS|XMAS|HOLIDAY|MISTLETOE|FESTIVE|NOEL|YULE|JINGLE)\b/;
const GIFT_CAT = /^GIFT SETS\b/;
/**
 * DABS's gift-set categories also hold its seasonal one-off buys (flavored
 * whiskeys, cans). Only names that say what's in the box count as gift sets;
 * the rest are seasonal bottles.
 */
const PACK = /\b(VAP|GIFT|GIFTBOX|GS|PACK|PK|PKG|DUO|TRIO|SET|GLASS|GLASSES|FLUTES?|FLU|SHAKER|TUMBLE|REPLICA|HIGHBALL|DISH|SHOT G)(?![A-Z])|\bW\/|\dPACK/;
/** "Offer" listings are DABS's one-time and seasonal buys. */
const OFFER_CAT = /^(BEER|WINE|SPIRIT) OFFER$/;

/** Names that look seasonal but aren't (a producer called Winter, Santa wines). */
const DENY_NAME = /\bROTHMAN (& )?WINTER\b/;
/** Product codes reviewed and ruled out. */
export const DENY_CSC: string[] = [];

/**
 * Which holiday group a bottle belongs to, or null. The first match wins, in
 * this order: Nouveau, mulled wine, eggnog/peppermint, holiday beer, DABS
 * gift-set categories (packs = gift sets, the rest seasonal), then holiday
 * names on other listings. "Santa" counts only on beer, never on wine names
 * (Santa Margherita, Santa Cristina).
 */
export function holidayGroup(
  p: { csc: string; name: string; category: string | null },
  seasonYear: number = SEASONS[SEASONS.length - 1].year
): HolidayGroup | null {
  if (DENY_CSC.includes(p.csc)) return null;
  const name = p.name.toUpperCase();
  const cat = (p.category ?? "").toUpperCase();
  if (DENY_NAME.test(name)) return null;
  if (cat.startsWith("SPECIAL ORDERS")) return null;
  if (NOUVEAU.test(name)) {
    // Nouveau is made to drink young: last year's ('25) still on a shelf isn't this year's release.
    const v = name.match(/'(\d{2})\b/);
    return v && 2000 + Number(v[1]) !== seasonYear ? null : "nouveau";
  }
  if (WARM.test(name)) return "warm";
  if (NOG.test(name) || (cat === "GIFT SETS - LIQUEURS" && EGG_LIQUEUR.test(name))) return "nog";
  const beer = BEER_CAT.test(cat) || (cat === "BEER OFFER");
  if (beer && BEER_WORDS.test(name)) return "beer";
  if (GIFT_CAT.test(cat)) return PACK.test(name) ? "gift" : "seasonal";
  if ((OFFER_CAT.test(cat) || /^(SPIRITS?|WINE|LIQUEURS|WHISKEY|VODKA|RUM|GIN|TEQUILA|BRANDY)/.test(cat)) && SEASONAL_WORDS.test(name)) {
    return "seasonal";
  }
  return null;
}

/**
 * Tracking sources (discover_events surface "holiday"): "holiday:home" for the
 * homepage strip's bottles, "holiday:guide" for its link to the page, and
 * "holiday:<group>" for bottles on the page.
 */
export const HOLIDAY_VIEWS = ["home", "guide", ...GROUPS.map((g) => g.key)] as const;
export type HolidayView = (typeof HOLIDAY_VIEWS)[number];
export function parseHolidaySource(v: string): { surface: "holiday"; view: HolidayView } | null {
  const m = v.match(/^holiday:([a-z]+)$/);
  return m && (HOLIDAY_VIEWS as readonly string[]).includes(m[1]) ? { surface: "holiday", view: m[1] as HolidayView } : null;
}

export const GIFT_BANDS = [
  { key: "under25", label: "Under $25", min: 0, max: 25 },
  { key: "25to50", label: "$25–50", min: 25, max: 50 },
  { key: "over50", label: "$50 and up", min: 50, max: Infinity },
] as const;
export type GiftBand = (typeof GIFT_BANDS)[number]["key"];

export function parseBand(v: string | undefined): GiftBand | null {
  return GIFT_BANDS.find((b) => b.key === v)?.key ?? null;
}

export function inBand(price: number, band: GiftBand): boolean {
  const b = GIFT_BANDS.find((x) => x.key === band)!;
  return price >= b.min && price < b.max;
}

/**
 * DABS's seasonal buys (trial listings, offers, gift sets) before year-round
 * listings that happen to match, e.g. peppermint schnapps.
 */
export function isSeasonalListing(p: { status: string | null; category: string | null }): boolean {
  const cat = (p.category ?? "").toUpperCase();
  return p.status === "T" || GIFT_CAT.test(cat) || OFFER_CAT.test(cat);
}

/** Shown per group before "Show all". */
export const HOLIDAY_PAGE_SIZE = 6;
/** Homepage strip. */
export const HOLIDAY_STRIP_SIZE = 4;

/**
 * The homepage strip: one bottle from each group in turn (so it mixes kinds),
 * groups in GROUPS order, each group already ranked.
 */
export function mixStrip<T>(byGroup: Record<HolidayGroup, T[]>, size = HOLIDAY_STRIP_SIZE): T[] {
  const out: T[] = [];
  for (let round = 0; out.length < size; round++) {
    let added = false;
    for (const g of GROUPS) {
      const item = byGroup[g.key]?.[round];
      if (item && out.length < size) {
        out.push(item);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}
