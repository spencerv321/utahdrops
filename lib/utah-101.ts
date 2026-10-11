/**
 * Utah 101: plain-English guides to how alcohol works in Utah (/utah-101).
 *
 * Same rule as bottle notes: our words, every fact from a cited source, no
 * guessing. Sources live here so each article lists what it relied on, and
 * `checked` is the date we last re-read them. Utah changes its alcohol laws
 * most years (the session runs January to March; most changes take effect in
 * May), so re-check every article each May and bump `checked`.
 */

export type Source = { title: string; publisher: string; url: string; date?: string };

/** Everything the articles cite, by id. */
export const SOURCES = {
  dabsFaq: {
    title: "Frequently asked questions",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/about-dabs/faq/",
  },
  dabsVisitors: {
    title: "Residents & visitors information",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/about-dabs/residents-visitors/",
  },
  dabsStatutes: {
    title: "Statutes & rules (quick points)",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/laws-policies/statutes-rules/",
  },
  dabsFindStore: {
    title: "Find a store: about Utah liquor stores",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/shop-products/find-store/",
  },
  dabsLicenseInfo: {
    title: "General licensing information (what counts as beer and liquor)",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/licenses-permits/license-information/",
  },
  dabsOffPremise: {
    title: "Products for off-premise retail stores",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/licenses-permits/off-premise-products/",
  },
  dabsPurchasing: {
    title: "Purchasing policies",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/laws-policies/purchasing-policies/",
  },
  dabsSpecialOrders: {
    title: "Special order program",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/shop-products/special-orders/",
  },
  dabsAllocated: {
    title: "Allocated & rare high demand products",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/shop-products/allocatedandrare/",
  },
  dabsRhdp: {
    title: "Rare High Demand Products: drawings and past results",
    publisher: "Utah DABS",
    url: "https://webapps2.abc.utah.gov/ProdApps/RareHighDemandProducts",
  },
  dabsRhdpTerms: {
    title: "Rare High Demand Product drawing terms & conditions (PDF)",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/wp-content/uploads/RHDP-Terms-Conditions.pdf",
  },
  dabsId2026: {
    title: "Changes to the 100% ID law requirements",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/changes-100-id-law-requirements/",
    date: "March 18, 2026",
  },
  dabsLaws2026: {
    title: "2026 changes to Utah alcohol laws",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/2026-utah-alcohol-laws/",
    date: "May 1, 2026",
  },
  dabsForeignId: {
    title: "Guidance for accepting foreign driver licenses",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/guidance-foreign-driver-licenses/",
    date: "May 1, 2026",
  },
  dabsLaws2024: {
    title: "Changes to Utah alcohol laws 2024",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/changes-utah-alcohol-laws-2024/",
  },
  dabsAbout: {
    title: "DABS: a service-first department (origin and new name)",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/about-dabs/dabs-service-first-department/",
  },
  dabsHolidays: {
    title: "Alcoholic Beverage Services Commission agenda, holiday closures (PDF)",
    publisher: "Utah Public Notice Website",
    url: "https://www.utah.gov/pmn/files/1453567.pdf",
    date: "June 2026",
  },
  slmagHistory: {
    title: "Buzzed in the Beehive: a brief history of drinking in Utah",
    publisher: "Salt Lake Magazine",
    url: "https://www.saltlakemagazine.com/buzzed-beehive-brief-history-drinking-utah/",
    date: "January 1, 2018",
  },
  npr05: {
    title: "Utah first in the nation to lower its DUI limit to .05 percent",
    publisher: "NPR",
    url: "https://www.npr.org/2018/12/26/679833767/utah-first-in-the-nation-to-lower-its-dui-limit-to-05-percent",
    date: "December 26, 2018",
  },
  fox13Beer: {
    title: "Utah's governor signs bill to dump 3.2 beer for a slightly heavier brew",
    publisher: "FOX 13",
    url: "https://fox13now.com/2019/03/26/utahs-governor-signs-bill-to-dump-3-2-beer-for-a-slightly-heavier-brew/",
    date: "March 26, 2019",
  },
  fox13Curtain: {
    title: "The Zion Curtain bill is finally unveiled. Here's what's in it",
    publisher: "FOX 13",
    url: "https://www.fox13now.com/2017/02/27/the-zion-curtain-bill-is-finally-unveiled-heres-whats-in-it",
    date: "February 27, 2017",
  },
  utahCodeBar: {
    title: "Utah Code 32B-6-406, bar licensee operational requirements (PDF)",
    publisher: "Utah Legislature",
    url: "https://le.utah.gov/xcode/Title32B/Chapter6/C32B-6-S406_2023050320230503.pdf",
    date: "version effective May 3, 2023",
  },
  wineInstitute: {
    title: "Direct shipping to consumers: Utah",
    publisher: "Wine Institute",
    url: "https://wineinstitute.org/our-work/compliance/dtc/utah/",
  },
  wineSpectator: {
    title: "Utah relaxes liquor laws, benefiting wine drinkers",
    publisher: "Wine Spectator",
    url: "https://www.winespectator.com/articles/utah-relaxes-liquor-laws-benefiting-wine-drinkers-21591",
  },
  cedarHappyHour: {
    title: "Attorney General gets 'Happy Hour' lawsuit dismissed",
    publisher: "Cedar City News",
    url: "https://www.cedarcityutah.com/news/archive/2012/08/30/attorney-general-gets-happy-hour-lawsuit-dismissed/",
    date: "August 30, 2012",
  },
} satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export type Utah101Article = {
  slug: string;
  /** Short name for cards and breadcrumbs. */
  name: string;
  /** Page heading. */
  title: string;
  /** <title>, written for search. */
  seoTitle: string;
  description: string;
  kicker: string;
  /** One line for the hub card. */
  teaser: string;
  /** Second line on the share card. */
  ogLine: string;
  /** ISO date we last re-read every source for this article. */
  checked: string;
  sources: SourceId[];
};

export const UTAH_101_PATH = "/utah-101";

export const ARTICLES: Utah101Article[] = [
  {
    slug: "visitor-guide",
    name: "The visitor cheat sheet",
    title: "Visiting Utah? Here's how drinking works",
    seoTitle: "Utah Alcohol Laws for Visitors: The 10-Point Cheat Sheet",
    description:
      "Ten things to know about drinking in Utah on a trip: where to buy beer, wine and liquor, Sunday and holiday closures, ID, bars vs. restaurants, the .05 DUI limit and more.",
    kicker: "Start here",
    teaser: "Ten things to know before your ski trip, park visit or convention. Readable in a lift line.",
    ogLine: "Ten things to know, readable in a lift line.",
    checked: "2026-10-11",
    sources: [
      "slmagHistory",
      "fox13Beer",
      "dabsStatutes",
      "dabsHolidays",
      "dabsId2026",
      "dabsForeignId",
      "dabsFaq",
      "dabsVisitors",
      "utahCodeBar",
      "cedarHappyHour",
      "npr05",
      "wineInstitute",
    ],
  },
  {
    slug: "buying-alcohol",
    name: "How buying works",
    title: "How buying alcohol works in Utah",
    seoTitle: "How to Buy Alcohol in Utah: Liquor Stores, Grocery Beer, Hours & Holidays",
    description:
      "Who sells what in Utah: grocery-store beer up to 5% ABV, state liquor stores and package agencies for everything else, store hours, Sunday and holiday closures, ID rules and special orders.",
    kicker: "Buying",
    teaser: "Grocery beer, state liquor stores, package agencies, hours and holidays, and why it's set up this way.",
    ogLine: "Grocery beer, state stores, hours and holidays.",
    checked: "2026-10-11",
    sources: [
      "dabsStatutes",
      "dabsFaq",
      "dabsFindStore",
      "dabsLicenseInfo",
      "dabsOffPremise",
      "fox13Beer",
      "dabsPurchasing",
      "dabsLaws2024",
      "dabsHolidays",
      "dabsId2026",
      "dabsForeignId",
      "dabsSpecialOrders",
      "dabsAbout",
      "dabsVisitors",
    ],
  },
  {
    slug: "bars-and-restaurants",
    name: "Bars & restaurants",
    title: "Drinking out in Utah: bars, restaurants and the rules in between",
    seoTitle: "Utah Bar & Restaurant Drinking Laws: Hours, Pours, ID and Food Rules",
    description:
      "What's different about ordering a drink in Utah: restaurants vs. bars, service hours, 1.5-ounce pours, no happy hour, ID scanning, bringing your own wine and taking the rest home.",
    kicker: "Drinking out",
    teaser: "Why the restaurant asks if you're eating, why there are no doubles, and what a bar is here.",
    ogLine: "Hours, pours, ID and the food question.",
    checked: "2026-10-11",
    sources: [
      "dabsVisitors",
      "slmagHistory",
      "dabsLaws2026",
      "utahCodeBar",
      "dabsId2026",
      "dabsLaws2024",
      "cedarHappyHour",
      "fox13Curtain",
      "wineSpectator",
      "dabsFaq",
      "dabsStatutes",
      "npr05",
    ],
  },
  {
    slug: "myths-and-quirks",
    name: "Myths & quirks",
    title: "Utah alcohol myths, and the quirks that are real",
    seoTitle: "Utah Liquor Law Myths vs. Facts (and the Weird Rules That Are Real)",
    description:
      "No, you don't need a membership, and no, it isn't all 3.2 beer. What's outdated about Utah's alcohol reputation, and the genuinely odd rules still on the books.",
    kicker: "Myths & quirks",
    teaser: "Memberships, 3.2 beer, “dry” Utah: what's outdated, and the odd rules that are still real.",
    ogLine: "What's outdated, and the odd rules that are real.",
    checked: "2026-10-11",
    sources: [
      "slmagHistory",
      "fox13Beer",
      "dabsStatutes",
      "dabsAbout",
      "fox13Curtain",
      "dabsVisitors",
      "cedarHappyHour",
      "npr05",
      "dabsFaq",
      "dabsLaws2024",
      "wineInstitute",
      "dabsHolidays",
      "dabsId2026",
      "dabsOffPremise",
    ],
  },
  {
    slug: "rare-bottles",
    name: "Rare bottles & drawings",
    title: "How rare bottles work in Utah: allocations and drawings",
    seoTitle: "Utah Allocated Bourbon & the DABS Rare Bottle Drawing, Explained",
    description:
      "How Utah sells hard-to-find bottles like Pappy Van Winkle and Blanton's: the third-Saturday allocated drop, the DABS rare high demand drawing, real odds, and the rules.",
    kicker: "Rare bottles",
    teaser: "The third-Saturday drop, the DABS drawing, the real odds, and why you can't resell.",
    ogLine: "The monthly drop, the drawing and the real odds.",
    checked: "2026-10-11",
    sources: [
      "dabsAllocated",
      "dabsRhdp",
      "dabsRhdpTerms",
      "dabsSpecialOrders",
      "dabsFaq",
    ],
  },
  {
    slug: "glossary",
    name: "Glossary",
    title: "Utah alcohol glossary",
    seoTitle: "Utah Alcohol Glossary: DABS, Package Agency, Heavy Beer and More",
    description:
      "Plain-English definitions of Utah alcohol terms: DABS, package agency, heavy beer, allocated, RHDP drawing, intent to dine, Zion curtain, interdicted and more.",
    kicker: "Glossary",
    teaser: "DABS, package agency, heavy beer, RHDP, intent to dine: the words, in plain English.",
    ogLine: "The words, in plain English.",
    checked: "2026-10-11",
    sources: [
      "dabsLicenseInfo",
      "dabsAllocated",
      "dabsVisitors",
      "dabsAbout",
      "dabsFaq",
      "dabsRhdpTerms",
      "dabsId2026",
      "dabsOffPremise",
      "dabsFindStore",
      "dabsSpecialOrders",
      "fox13Curtain",
    ],
  },
];

export function getArticle(slug: string): Utah101Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export const articlePath = (slug: string) => `${UTAH_101_PATH}/${slug}`;
