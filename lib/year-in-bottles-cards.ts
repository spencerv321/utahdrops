/**
 * Utah's Year in Bottles: the card deck (/year-in-bottles/<edition>), worded
 * from the frozen snapshot (data/year-in-bottles-<edition>.json, built by
 * scripts/year-in-bottles.ts). Every number on a card comes from the
 * snapshot; nothing is typed by hand.
 *
 * Copy rules:
 * - Each headline is a claim. `need()` checks it still holds, so a new
 *   edition with different numbers fails loudly instead of saying something
 *   false (rewrite the card then).
 * - Bottle and maker names shown on cards come from NAMES (reviewed by eye).
 *   A name that isn't there throws, so a new edition can't print a raw DABS
 *   abbreviation.
 * - State and bottle facts only. "Units" are DABS bottle counts (cans included),
 *   worded "bottles and cans" in totals.
 */
import data2026 from "@/data/year-in-bottles-2026.json";
import type { YearSnapshot } from "@/lib/year-in-bottles";

export type YearEdition = YearSnapshot & {
  edition: string;
  builtAt: string;
  sources: { month: string; fiscalLabel: string; url: string }[];
};

export const EDITIONS: Record<string, YearEdition> = {
  "2026": data2026 as unknown as YearEdition,
};
export const CURRENT_EDITION = "2026";
export { YEAR_IN_BOTTLES_PATH, editionPath, cardPath } from "@/lib/year-in-bottles-paths";
export const DABS_SALES_URL = "https://abs.utah.gov/vendors/sales-analysis/";

/** Homepage pointer while the year-end season lasts (Utah dates, inclusive). */
export const HOME_WINDOW = { from: "2026-11-24", to: "2027-01-31" };
export function onHome(today: string): boolean {
  return today >= HOME_WINDOW.from && today <= HOME_WINDOW.to;
}

/** Display names for bottles and makers the cards mention, by snapshot title or maker slug. */
export const NAMES: Record<string, string> = {
  "Titos Handmade Vodka": "Tito's Handmade Vodka",
  "Jack Daniels Black Label": "Jack Daniel's Black Label",
  "Natty Daddy": "Natty Daddy",
  "Eagle Rare 10 Yr Bourbon": "Eagle Rare 10 Year Bourbon",
  "Drc Romanee-Conti'23": "Domaine de la Romanée-Conti 2023",
  "high-west-distillery": "High West",
};

export function displayNameOf(key: string): string {
  const name = NAMES[key];
  if (!name) throw new Error(`year in bottles: no reviewed display name for "${key}" (add it to NAMES)`);
  return name;
}

function need(cond: unknown, claim: string): asserts cond {
  if (!cond) throw new Error(`year in bottles: "${claim}" no longer holds for this edition; rewrite the card`);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];
const monthShort = (ym: string) => monthName(ym).slice(0, 3);
export const monthYear = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;
/** "Oct 2025 – Sep 2026" */
export const windowLabel = (s: { window: { from: string; through: string } }) =>
  `${monthShort(s.window.from)} ${s.window.from.slice(0, 4)} – ${monthShort(s.window.through)} ${s.window.through.slice(0, 4)}`;

/** 42689698 → "42.7M"; 117000 → "117,000" */
export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return Math.round(n).toLocaleString("en-US");
}
export const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString("en-US")}`);
export const pct = (share: number) => `${Math.round(share * 100)}%`;
export const signedPct = (change: number) => `${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change * 1000) / 10).toFixed(1)}%`;
export const times = (r: number) => `${(Math.round(r * 10) / 10).toFixed(1)}×`;
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const count = (n: number) => (n < 10 ? words[n] : n.toLocaleString("en-US"));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type CardTone = "plain" | "amber" | "burgundy";

export interface YearCard {
  slug: string;
  kicker: string;
  /** The big figure, or null for a headline card. */
  big: string | null;
  headline: string | null;
  body: string;
  /** Short list under the body (seasons card). */
  points?: string[];
  foot: string;
  tone: CardTone;
  chart?:
    | { type: "months"; labels: string[]; values: number[]; peak: number }
    | { type: "shares"; rows: { label: string; share: number }[] };
  cta?: { href: string; label: string };
  /** One line for the card's share image and page description. */
  ogLine: string;
}

export function buildCards(s: YearEdition): YearCard[] {
  const cards: YearCard[] = [];

  // ---- total ----
  cards.push({
    slug: "total",
    kicker: "The total",
    big: compact(s.totals.units),
    headline: null,
    body: `bottles and cans left Utah's state liquor stores. That's about ${compact(Math.round(s.totals.unitsPerDay / 1000) * 1000)} a day.`,
    foot: `${money(s.totals.dollars)} in sales`,
    tone: "plain",
    ogLine: `${compact(s.totals.units)} bottles and cans left Utah's state liquor stores: about ${compact(Math.round(s.totals.unitsPerDay / 1000) * 1000)} a day.`,
  });

  // ---- mix ----
  const kind = (k: string) => s.mix.find((m) => m.kind === k);
  const spirits = kind("spirits");
  const beer = kind("beer");
  const premixed = kind("premixed");
  need(spirits && s.mix[0].kind === "spirits", "spirits are the biggest share of dollars");
  need(beer && premixed, "beer and premixed are in the mix");
  const cansShare = (beer.unitShare ?? 0) + (premixed.unitShare ?? 0);
  need(cansShare > (spirits.unitShare ?? 0), "beer, cider and premixed outnumber spirits by count");
  cards.push({
    slug: "mix",
    kicker: "Where the money went",
    big: null,
    headline: "Spirits pay the bills. Cans move the volume.",
    body: `Spirits were ${pct(spirits.dollarShare ?? 0)} of sales dollars. By count, beer, cider and premixed cocktails were ${pct(cansShare)} of everything sold.`,
    foot: "Share of sales dollars",
    tone: "plain",
    chart: {
      type: "shares",
      rows: s.mix.filter((m) => m.kind !== "other").map((m) => ({ label: m.label, share: m.dollarShare ?? 0 })),
    },
    ogLine: `Spirits were ${pct(spirits.dollarShare ?? 0)} of the money; beer, cider and premixed cocktails were ${pct(cansShare)} of what sold.`,
  });

  // ---- #1 bottle ----
  const [first, second] = s.top.familiesByDollars;
  const byUnits = s.top.itemsByUnits[0];
  const firstName = displayNameOf(first.title);
  const lead = first.dollars / second.dollars;
  need(lead >= 2, "the #1 bottle sold at least twice the runner-up");
  cards.push({
    slug: "number-one",
    kicker: "Utah's #1",
    big: null,
    headline: firstName,
    body: `${money(first.dollars)} across ${count(first.sizesMl.length)} sizes, about ${times(lead)} the runner-up, ${displayNameOf(second.title)}.`,
    foot: `By count, the top seller was ${displayNameOf(byUnits.title)}: ${byUnits.units.toLocaleString("en-US")} cans.`,
    tone: "amber",
    ogLine: `${firstName} was Utah's #1 bottle: ${money(first.dollars)} across ${count(first.sizesMl.length)} sizes.`,
  });

  // ---- the riser ----
  if (s.yoy) {
    const [up, ...rest] = s.yoy.kinds;
    need(up && (up.dollarChange ?? 0) > 0, "one kind grew year over year");
    const short: Record<string, string> = { spirits: "spirits", wine: "wine", beer: "beer", premixed: "premixed cocktails" };
    const down = rest.filter((k) => (k.dollarChange ?? 0) < 0).map((k) => short[k.kind]);
    need(down.length === rest.length, "every other kind dipped");
    const span = `${monthShort(s.yoy.months[0])}–${monthShort(s.yoy.months.at(-1)!)} ${s.yoy.months.at(-1)!.slice(0, 4)}`;
    cards.push({
      slug: "riser",
      kicker: "The riser",
      big: signedPct(up.dollarChange!),
      headline: null,
      body: `${up.label} grew while ${listJoin(down)} all dipped.`,
      foot: `${span} vs. the same months a year earlier, in dollars. All sales: ${signedPct(s.yoy.total.dollarChange!)}.`,
      tone: "plain",
      ogLine: `${up.label} grew ${signedPct(up.dollarChange!).slice(1)} while ${listJoin(down)} dipped.`,
    });
  }

  // ---- the peak month ----
  const peak = s.peakMonth;
  const surge = peak.surges[0];
  need((peak.vsTypical ?? 0) >= 1.2, "the peak month stands well above a typical month");
  cards.push({
    slug: "peak-month",
    kicker: monthName(peak.month),
    big: money(peak.dollars),
    headline: null,
    body: `in one month, ${times(peak.vsTypical!)} a typical month. ${surge.label} sold ${surge.peakUnits.toLocaleString("en-US")} bottles, ${times(surge.vsTypical!)} its usual month.`,
    foot: "Sales by month",
    tone: "burgundy",
    chart: {
      type: "months",
      labels: s.monthly.map((m) => monthName(m.month).charAt(0)),
      values: s.monthly.map((m) => m.dollars),
      peak: s.monthly.findIndex((m) => m.month === peak.month),
    },
    ogLine: `${monthYear(peak.month)}: ${money(peak.dollars)} in one month, ${times(peak.vsTypical!)} a typical month.`,
  });

  // ---- seasons ----
  const group = (slug: string) => s.seasons.groups.find((g) => g.slug === slug);
  const cls = (name: string) => s.seasons.classes.find((c) => c.className === name);
  const red = group("red-wine");
  const rose = group("rose");
  need(red && rose, "red wine and rosé have seasonal figures");
  const redLow = red.low;
  const points = [
    `Red wine: ${pct(red.peak.share)} of ${monthName(red.peak.month)}'s sales, ${pct(redLow.share)} of ${monthName(redLow.month)}'s`,
    `Rosé peaks in ${monthName(rose.peak.month)}`,
  ];
  const irish = cls("WHISKEY - IRISH");
  if (irish) points.push(`Irish whiskey peaks in ${monthName(irish.peak.month)}`);
  const tequila = group("tequila");
  if (tequila) points.push(`Tequila peaks in ${monthName(tequila.peak.month)}`);
  cards.push({
    slug: "seasons",
    kicker: "By season",
    big: null,
    headline: `Red in ${monthName(red.peak.month)}, rosé in ${monthName(rose.peak.month)}`,
    body: "Each style's share of each month's sales.",
    points,
    foot: "Share of each month's sales dollars",
    tone: "plain",
    ogLine: `Red wine peaks in ${monthName(red.peak.month)}, rosé in ${monthName(rose.peak.month)}.`,
  });

  // ---- Utah brands ----
  if (s.homegrown) {
    const h = s.homegrown;
    const oneIn = Math.round(1 / (h.unitShare ?? 1));
    const beerShare = h.byKind.find((k) => k.kind === "beer")?.dollarShare ?? 0;
    const top = h.makers[0];
    cards.push({
      slug: "homegrown",
      kicker: "Homegrown",
      big: `1 in ${oneIn}`,
      headline: null,
      body: `bottles and cans sold carried a Utah brand. In beer and cider, Utah brands took ${pct(beerShare)} of sales.`,
      foot: `Top Utah brand by sales: ${displayNameOf(top.slug)}, ${money(top.dollars)}. Some Utah brands now brew out of state.`,
      tone: "plain",
      cta: { href: "/makers", label: "Meet Utah's makers" },
      ogLine: `1 in ${oneIn} bottles and cans sold in Utah's state stores carried a Utah brand.`,
    });
  }

  // ---- allocated ----
  const a = s.allocated;
  const topAlloc = a.topByUnits[0];
  cards.push({
    slug: "the-hunt",
    kicker: "The hunt",
    big: a.units.toLocaleString("en-US"),
    headline: null,
    body: `allocated bottles sold, across ${a.items} different ones. The one found most: ${displayNameOf(topAlloc.title)} (${topAlloc.units.toLocaleString("en-US")} bottles).`,
    foot: "Allocated bottles are scarce ones DABS releases in a monthly drop.",
    tone: "burgundy",
    cta: { href: "/drops", label: "See the next drops" },
    ogLine: `${a.units.toLocaleString("en-US")} allocated bottles sold in Utah (${windowLabel(s)}). The one found most: ${displayNameOf(topAlloc.title)}.`,
  });

  // ---- the splurge ----
  const sp = s.splurge[0];
  cards.push({
    slug: "splurge",
    kicker: "The splurge",
    big: `$${Math.round(sp.unitPrice).toLocaleString("en-US")}`,
    headline: null,
    body: `for one bottle of ${displayNameOf(sp.title)}. ${cap(count(sp.units))} sold in ${monthYear(sp.month)}.`,
    foot: "The highest price per bottle in the year's sales reports",
    tone: "plain",
    ogLine: `The year's priciest bottle: ${displayNameOf(sp.title)}, $${Math.round(sp.unitPrice).toLocaleString("en-US")}.`,
  });

  return cards;
}

function listJoin(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

export function getEdition(edition: string): { snapshot: YearEdition; cards: YearCard[] } | null {
  const snapshot = EDITIONS[edition];
  return snapshot ? { snapshot, cards: buildCards(snapshot) } : null;
}
