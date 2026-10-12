/**
 * /bars: where you can drink in Utah without it being a restaurant meal, from
 * DABS's Licensee List (lib/licensees.ts). The license type decides the house
 * rules (21+, food, beer only, hours), so each group carries those rules as
 * cited claims, same sourcing rule as Utah 101: our words, every fact from a
 * listed source. Restaurants (food required) are left out on purpose.
 */
import { SOURCES as UTAH_101_SOURCES, type Source } from "@/lib/utah-101";
import { LICENSEE_REPORT_URL } from "@/lib/licensees";

export const BARS_PATH = "/bars";

export const BAR_SOURCES = {
  licenseeList: {
    title: "Current DABS licenses and permits (Licensee List)",
    publisher: "Utah DABS",
    url: LICENSEE_REPORT_URL,
  },
  dabsVisitors: UTAH_101_SOURCES.dabsVisitors,
  utahCodeBar: UTAH_101_SOURCES.utahCodeBar,
  dabsId2026: UTAH_101_SOURCES.dabsId2026,
  dabsLicenseInfo: UTAH_101_SOURCES.dabsLicenseInfo,
} satisfies Record<string, Source>;

export type BarSourceId = keyof typeof BAR_SOURCES;
export type BarClaim = { t: string; s: BarSourceId[] };

export type BarGroupKey = "bar" | "tavern" | "beer" | "airport";

export interface BarGroup {
  key: BarGroupKey;
  label: string;
  /** Singular, for list rows. */
  one: string;
  /** One line for the filter chip and the rules card. */
  short: string;
  /** DABS license types in this group, exactly as the Licensee List writes them. */
  types: string[];
  rules: BarClaim[];
}

export const BAR_GROUPS: BarGroup[] = [
  {
    key: "bar",
    label: "Bars",
    one: "Bar",
    short: "21+, full bar, food optional",
    types: ["Bar Establishment", "Licensed as a Bar (LB)"],
    rules: [
      { t: "21 and over.", s: ["utahCodeBar"] },
      { t: "Every ID is checked and scanned at the door, whatever your age.", s: ["dabsId2026"] },
      { t: "Cocktails, wine and beer from 10 a.m. to 1 a.m., at the bar or a table.", s: ["dabsVisitors"] },
      { t: "Food has to be available, but you don't have to order any.", s: ["dabsVisitors"] },
      {
        t: "Country clubs and fraternal clubs (VFW, Elks, Eagles, Moose) are bars too, for members and their guests only.",
        s: ["dabsVisitors"],
      },
    ],
  },
  {
    key: "tavern",
    label: "Taverns",
    one: "Tavern",
    short: "21+, beer only (5% or less)",
    types: ["On-Premise Beer Retailer (Tavern - 5% or less ABV)"],
    rules: [
      { t: "Beer only, 5% alcohol or less.", s: ["licenseeList", "dabsLicenseInfo"] },
      { t: "No minors allowed.", s: ["dabsVisitors"] },
      { t: "Every ID is checked and scanned at the door.", s: ["dabsId2026"] },
      { t: "Beer from 10 a.m. to 1 a.m.; taverns are the one license that can sell beer and nothing else.", s: ["dabsVisitors"] },
    ],
  },
  {
    key: "beer",
    label: "Beer at venues",
    one: "Beer-only venue",
    short: "golf, bowling, skiing, arenas: beer only",
    types: ["On-Premise Beer Retailer (Beer Recreational)"],
    rules: [
      { t: "Beer only (5% alcohol or less), sold at places like golf courses, bowling centers, ski resorts and arenas.", s: ["dabsVisitors", "dabsLicenseInfo"] },
      { t: "Beer from 10 a.m. to 1 a.m.", s: ["dabsVisitors"] },
    ],
  },
  {
    key: "airport",
    label: "Airport lounges",
    one: "Airport lounge",
    short: "cocktails, wine and beer, with or without food",
    types: ["Airport Lounge"],
    rules: [
      { t: "Cocktails, wine and beer from 8 a.m. to midnight, with or without food, at the bar or a table.", s: ["dabsVisitors"] },
    ],
  },
];

export const BAR_TYPES = BAR_GROUPS.flatMap((g) => g.types);

export function groupOfType(type: string): BarGroup | undefined {
  return BAR_GROUPS.find((g) => g.types.includes(type));
}

/** Every source the page cites, in first-cited order (footnote numbers). */
export function barSources(): { id: BarSourceId; source: Source }[] {
  const ids: BarSourceId[] = ["licenseeList"];
  for (const g of BAR_GROUPS) for (const r of g.rules) for (const id of r.s) if (!ids.includes(id)) ids.push(id);
  return ids.map((id) => ({ id, source: BAR_SOURCES[id] }));
}
