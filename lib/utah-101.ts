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
  dabsProudlyUtah: {
    title: "We are Proudly Utah: local breweries, distilleries, wineries and cideries",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/shop-products/proudly-utah/",
  },
  dabsBarrelSelects: {
    title: "New special selections available (barrel picks)",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/dabs-special-barrel-selections/",
    date: "October 5, 2026",
  },
  dabsSlaterville: {
    title: "New state liquor store opening near Ogden, in Marriott-Slaterville",
    publisher: "Utah DABS",
    url: "https://abs.utah.gov/new-store-opens-marriott-slaterville/",
    date: "September 30, 2025",
  },
  dc89: {
    title: "Doctrine and Covenants 89 (the Word of Wisdom)",
    publisher: "The Church of Jesus Christ of Latter-day Saints",
    url: "https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/89?lang=eng",
  },
  niaaaStandardDrink: {
    title: "What is a standard drink?",
    publisher: "NIAAA (National Institutes of Health)",
    url: "https://www.niaaa.nih.gov/alcohols-effects-health/what-standard-drink",
  },
  niaaaOverdose: {
    title: "Understanding the dangers of alcohol overdose",
    publisher: "NIAAA (National Institutes of Health)",
    url: "https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/understanding-dangers-of-alcohol-overdose",
  },
  niaaaMeds: {
    title: "Harmful interactions: mixing alcohol with medicines",
    publisher: "NIAAA (National Institutes of Health)",
    url: "https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/harmful-interactions-mixing-alcohol-with-medicines",
  },
  samhsaHelpline: {
    title: "National Helpline, 1-800-662-HELP (4357)",
    publisher: "SAMHSA",
    url: "https://www.samhsa.gov/find-help/helplines/national-helpline",
  },
  vinepairDga: {
    title: "Daily limit for alcohol consumption removed from U.S. Dietary Guidelines",
    publisher: "VinePair",
    url: "https://vinepair.com/booze-news/new-dga-removes-daily-alcohol-limit/",
    date: "January 7, 2026",
  },
  cfrProof: {
    title: "27 CFR 5.1, definitions (proof)",
    publisher: "Cornell Law School, Legal Information Institute",
    url: "https://www.law.cornell.edu/cfr/text/27/5.1",
  },
  wikiStraightUp: {
    title: "Straight up (bartending): neat, up and on the rocks",
    publisher: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Straight_up_(bartending)",
  },
  homebrewStatute: {
    title: "Utah homebrewing statute (Utah Code 32B-11-202)",
    publisher: "American Homebrewers Association",
    url: "https://homebrewersassociation.org/homebrewing-rights/statutes/Utah",
  },
  duiUtah: {
    title: "Utah DUI laws and the penalties for a conviction",
    publisher: "DrivingLaws.org (Nolo)",
    url: "https://dui.drivinglaws.org/utah.php",
  },
  townliftBoating: {
    title: "Utah cracks down on impaired boating during busy holiday weekend",
    publisher: "TownLift",
    url: "https://townlift.com/2026/07/utah-cracks-down-on-impaired-boating-during-busy-holiday-weekend/",
    date: "July 2026",
  },
  npsGlenCanyon: {
    title: "Operation Dry Water at Glen Canyon National Recreation Area",
    publisher: "National Park Service",
    url: "https://www.nps.gov/glca/learn/news/20250620.htm",
    date: "June 20, 2025",
  },
  standardParks: {
    title: "Where can Northern Utahns drink outdoors after Pineview, Causey alcohol ban?",
    publisher: "Standard-Examiner",
    url: "https://www.standard.net/police-fire/2017/jun/08/where-can-northern-utahns-drink-outdoors-after-pineview-causey-alcohol-ban/",
    date: "June 8, 2017",
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
    slug: "out-and-about",
    name: "Out and about",
    title: "Driving, boating, parks and hotels: drinking on the go in Utah",
    seoTitle: "Utah .05 DUI Law, Open Containers, Boating and Drinking in Parks",
    description:
      "How alcohol fits into getting around Utah: the .05 DUI limit and what counts, open containers, limos and buses, boating at Lake Powell, parks and campgrounds, hotels and the airport.",
    kicker: "Out and about",
    teaser: "The .05 limit, open containers, boats, parks, hotels and the airport.",
    ogLine: "The .05 limit, open containers, boats, parks and hotels.",
    checked: "2026-10-11",
    sources: [
      "npr05",
      "duiUtah",
      "dabsStatutes",
      "dabsLaws2024",
      "dabsFaq",
      "townliftBoating",
      "npsGlenCanyon",
      "standardParks",
      "dabsVisitors",
      "dabsLaws2026",
    ],
  },
  {
    slug: "new-to-drinking",
    name: "New to drinking",
    title: "New to drinking? A friendly, judgment-free start",
    seoTitle: "New to Drinking? Standard Drinks, How to Order and Staying Safe",
    description:
      "For anyone starting to drink later in life: what a standard drink is, ABV and proof, how to order, pacing, medications, the warning signs of alcohol overdose, and how Utah's rules fit in.",
    kicker: "New to drinking",
    teaser: "What's in a drink, how to order one, and how to stay safe. No judgment either way.",
    ogLine: "What's in a drink, how to order, how to stay safe.",
    checked: "2026-10-11",
    sources: [
      "niaaaStandardDrink",
      "cfrProof",
      "wikiStraightUp",
      "niaaaOverdose",
      "niaaaMeds",
      "vinepairDga",
      "npr05",
      "samhsaHelpline",
    ],
  },
  {
    slug: "moving-to-utah",
    name: "Moving to Utah",
    title: "Moving to Utah? What happens to your bar cart",
    seoTitle: "Moving to Utah With Alcohol: Your Collection, Wine Clubs and Homebrewing",
    description:
      "New to Utah? Bringing your bottle collection, why wine clubs stop shipping, how locals shop the state stores, the rare-bottle drawing, local makers and Utah's homebrewing limits.",
    kicker: "Moving here",
    teaser: "Your collection, wine clubs, how locals shop, and homebrewing.",
    ogLine: "Your collection, wine clubs and how locals shop.",
    checked: "2026-10-11",
    sources: [
      "dabsFaq",
      "wineInstitute",
      "dabsFindStore",
      "dabsBarrelSelects",
      "dabsRhdpTerms",
      "slmagHistory",
      "dabsProudlyUtah",
      "homebrewStatute",
    ],
  },
  {
    slug: "hosting-and-events",
    name: "Hosting & events",
    title: "Hosting in Utah: parties, weddings and event permits",
    seoTitle: "Serving Alcohol at a Utah Party or Wedding: When You Need a Permit",
    description:
      "When you can serve alcohol at a Utah party or wedding without a permit, what changes if you sell drinks, single event and temporary beer permits, caterers, kegs and venues.",
    kicker: "Hosting",
    teaser: "Parties, weddings and fundraisers: when you need a permit, and when you don't.",
    ogLine: "Parties, weddings and when you need a permit.",
    checked: "2026-10-11",
    sources: ["dabsFaq", "dabsVisitors", "dabsSpecialOrders", "npr05"],
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
    slug: "history",
    name: "A short history",
    title: "A short history of drinking in Utah",
    seoTitle: "History of Alcohol in Utah: From Pioneer Breweries to the .05 Limit",
    description:
      "Pioneer breweries, the Word of Wisdom, statewide prohibition, Utah's deciding vote to end Prohibition, brown bagging, mini bottles, the Zion curtain and the .05 limit: a timeline from 1825 to today.",
    kicker: "History",
    teaser: "From pioneer breweries and the deciding vote on Prohibition to the .05 limit.",
    ogLine: "From pioneer breweries to the .05 limit.",
    checked: "2026-10-11",
    sources: [
      "slmagHistory",
      "dc89",
      "dabsAbout",
      "homebrewStatute",
      "cedarHappyHour",
      "fox13Curtain",
      "npr05",
      "fox13Beer",
      "dabsLaws2024",
      "dabsSlaterville",
      "dabsId2026",
      "dabsLaws2026",
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
      "duiUtah",
      "dabsAllocated",
      "niaaaOverdose",
      "dabsVisitors",
      "dabsAbout",
      "dabsFaq",
      "dabsRhdpTerms",
      "homebrewStatute",
      "dabsId2026",
      "wikiStraightUp",
      "dabsOffPremise",
      "dabsFindStore",
      "dabsHolidays",
      "dabsLaws2024",
      "cfrProof",
      "dabsSpecialOrders",
      "niaaaStandardDrink",
      "fox13Curtain",
    ],
  },
];

export function getArticle(slug: string): Utah101Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export const articlePath = (slug: string) => `${UTAH_101_PATH}/${slug}`;
