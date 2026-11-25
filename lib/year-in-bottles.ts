/**
 * Utah's Year in Bottles: a statewide year in review built only from DABS's
 * official monthly Sales Analysis reports (`monthly_sales`). Pure math, no
 * database: `scripts/year-in-bottles.ts` loads the rows, runs `buildYear`, and
 * writes a frozen snapshot (data/year-in-bottles-<edition>.json) that is
 * reviewed by eye before the page uses it. The page never queries live, so
 * shared numbers never change after launch.
 *
 * Rules (see YEAR_RULES):
 * - The window is the latest 12 consecutive reported months, not a calendar
 *   year. Every card states it.
 * - "Units" is DABS's bottle count, which includes cans.
 * - Year-over-year compares only months reported in both years, summed (single
 *   months swing ±10% with the calendar), and needs at least MIN_YOY_MONTHS.
 * - Categories use the site's own groups (lib/categories.ts); the DABS class
 *   is kept for finer facts ("Irish whiskey peaks in March").
 * - Utah brand = a /makers match (vendor code or reviewed name prefix). Some
 *   Utah brands brew out of state, so copy says "Utah brand", not "Utah-made".
 * - State and bottle facts only: no per-person consumption.
 */
import { groupOf } from "@/lib/categories";
import { productTitle } from "@/lib/format";

export const YEAR_RULES = {
  /** Months in the window. */
  WINDOW_MONTHS: 12,
  /** Fewest months reported in both years for any year-over-year claim. */
  MIN_YOY_MONTHS: 3,
  /** A group needs this much in last year's matching months for a growth figure. */
  MIN_YOY_GROUP_DOLLARS: 1_000_000,
  /** Same for a single DABS class (finer, so smaller). */
  MIN_YOY_CLASS_DOLLARS: 500_000,
  /** Seasonal swings only for groups at least this share of the year's dollars. */
  MIN_SEASON_GROUP_SHARE: 0.01,
  /** …and DABS classes at least this share. */
  MIN_SEASON_CLASS_SHARE: 0.005,
  /** Top-seller lists only count items sold in every month of the window (no launch spikes). */
  TOP_LIST: 10,
  /** Site groups that are buying channels, not styles: kept in totals, left out of style facts. */
  NOT_STYLES: ["offers", "special-orders", "gift-sets", "other"] as readonly string[],
  TOP_PER_GROUP: 3,
} as const;

export interface SalesRow {
  /** "YYYY-MM" */
  month: string;
  itemCode: string;
  itemName: string | null;
  className: string | null;
  sizeMl: number | null;
  bottles: number | null;
  dollars: number | null;
}

export type Kind = "spirits" | "wine" | "beer" | "premixed" | "other";

export const KIND_LABEL: Record<Kind, string> = {
  spirits: "Spirits",
  wine: "Wine",
  beer: "Beer & cider",
  premixed: "Premixed cocktails",
  other: "Other",
};

const BEER = /^(ALE|LAGER|BEER|DOMESTIC BEER|IMPORTED BEER|CIDER|FLAVORED MALT BEVERAGES|ALLOCATED BEER|BEER OFFER|SPECIAL ORDERS - BEER)\b/;
const SPIRITS =
  /^(WHISKEY|VODKA|TEQUILA|RUM|GIN|BRANDY|LIQUEURS|SCHNAPPS|SPIRIT OFFER|ALLOCATED SPIRIT|SPECIAL ORDERS - (SPIRITS|LIQUEURS)|GIFT SETS - (SPIRITS|LIQUEURS))\b/;

/** Broad kind for a DABS class name. Wine is everything wine-shaped that isn't the others. */
export function kindOf(className: string | null | undefined): Kind {
  const c = (className ?? "").trim().toUpperCase();
  if (!c || c === "SUPPLIES" || c.startsWith("SPECIAL ORDERS - DSD")) return "other";
  if (c.startsWith("PREMIXED")) return "premixed";
  if (BEER.test(c)) return "beer";
  if (SPIRITS.test(c)) return "spirits";
  return "wine";
}

/** The latest `n` consecutive months. Throws on a gap: a year with a missing month isn't a year. */
export function trailingWindow(months: string[], n: number = YEAR_RULES.WINDOW_MONTHS): string[] {
  const sorted = [...new Set(months)].sort();
  if (sorted.length < n) throw new Error(`need ${n} months of sales, have ${sorted.length}`);
  const window = sorted.slice(-n);
  for (let i = 1; i < window.length; i++) {
    if (addMonths(window[i - 1], 1) !== window[i]) throw new Error(`gap in sales months: ${window[i - 1]} → ${window[i]}`);
  }
  return window;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const isStyle = (slug: string) => !YEAR_RULES.NOT_STYLES.includes(slug);
const round2 = (n: number) => Math.round(n * 100) / 100;
const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 10000 : null);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

function groupKey(className: string | null): { slug: string; label: string } {
  const g = groupOf(className);
  return g ? { slug: g.slug, label: g.label } : { slug: "other", label: "Other" };
}

/** Same bottle in different sizes ("Tito's" 750ml, 1L, 1.75L) shares a title. */
export function familyTitle(row: Pick<SalesRow, "itemName" | "sizeMl">): string {
  return productTitle(row.itemName, row.sizeMl);
}

interface Tally {
  dollars: number;
  units: number;
}
const tally = (): Tally => ({ dollars: 0, units: 0 });
const add = (t: Tally, r: SalesRow) => {
  t.dollars += r.dollars ?? 0;
  t.units += r.bottles ?? 0;
};
const out = (t: Tally) => ({ dollars: round2(t.dollars), units: t.units });

export interface MakerRef {
  slug: string;
  name: string;
}

export interface BuildOptions {
  /** Defaults to the latest 12 consecutive months in `rows`. */
  window?: string[];
  /** Utah maker for an item, if any (the script passes makerForProduct with vendor codes). */
  makerOf?: (row: SalesRow) => MakerRef | null | undefined;
}

export function buildYear(rows: SalesRow[], opts: BuildOptions = {}) {
  const window = opts.window ?? trailingWindow(rows.map((r) => r.month));
  const inWindow = new Set(window);
  const year = rows.filter((r) => inWindow.has(r.month));
  const days = window.reduce((s, m) => s + daysInMonth(m), 0);

  // ---- totals and mix ----
  const total = tally();
  const byKind = new Map<Kind, Tally>();
  const byGroup = new Map<string, Tally & { label: string }>();
  const byMonth = new Map<string, Tally>(window.map((m) => [m, tally()]));
  const groupMonth = new Map<string, Map<string, Tally>>();
  const classYear = new Map<string, Tally>();
  const classMonth = new Map<string, Map<string, Tally>>();
  for (const r of year) {
    add(total, r);
    const k = kindOf(r.className);
    if (!byKind.has(k)) byKind.set(k, tally());
    add(byKind.get(k)!, r);
    const g = groupKey(r.className);
    if (!byGroup.has(g.slug)) byGroup.set(g.slug, { ...tally(), label: g.label });
    add(byGroup.get(g.slug)!, r);
    add(byMonth.get(r.month)!, r);
    if (!groupMonth.has(g.slug)) groupMonth.set(g.slug, new Map(window.map((m) => [m, tally()])));
    add(groupMonth.get(g.slug)!.get(r.month)!, r);
    const c = (r.className ?? "").trim();
    if (c) {
      if (!classYear.has(c)) classYear.set(c, tally());
      add(classYear.get(c)!, r);
      if (!classMonth.has(c)) classMonth.set(c, new Map(window.map((m) => [m, tally()])));
      add(classMonth.get(c)!.get(r.month)!, r);
    }
  }

  const mix = [...byKind.entries()]
    .map(([kind, t]) => ({
      kind,
      label: KIND_LABEL[kind],
      ...out(t),
      dollarShare: ratio(t.dollars, total.dollars),
      unitShare: ratio(t.units, total.units),
    }))
    .sort((a, b) => b.dollars - a.dollars);

  const groups = [...byGroup.entries()]
    .map(([slug, t]) => ({ slug, label: t.label, ...out(t), dollarShare: ratio(t.dollars, total.dollars) }))
    .sort((a, b) => b.dollars - a.dollars);

  // ---- items ----
  interface Item extends Tally {
    itemCode: string;
    title: string;
    name: string;
    sizeMl: number | null;
    className: string;
    group: string;
    months: Set<string>;
    nameMonth: string;
  }
  const items = new Map<string, Item>();
  for (const r of year) {
    let it = items.get(r.itemCode);
    if (!it) {
      it = {
        ...tally(),
        itemCode: r.itemCode,
        title: familyTitle(r),
        name: r.itemName ?? "",
        sizeMl: r.sizeMl,
        className: r.className ?? "",
        group: groupKey(r.className).slug,
        months: new Set(),
        nameMonth: r.month,
      };
      items.set(r.itemCode, it);
    }
    add(it, r);
    if ((r.bottles ?? 0) > 0) it.months.add(r.month);
    // Keep the latest name DABS used.
    if (r.itemName && r.month > it.nameMonth) {
      it.name = r.itemName;
      it.title = familyTitle(r);
      it.nameMonth = r.month;
    }
  }
  const steady = [...items.values()].filter((i) => i.months.size === window.length);
  const itemOut = (i: Item) => ({
    itemCode: i.itemCode,
    title: i.title,
    name: i.name,
    sizeMl: i.sizeMl,
    group: i.group,
    ...out(i),
  });
  const byUnits = [...steady].sort((a, b) => b.units - a.units);

  // Families: the same title across sizes, summed (Tito's 750ml + 1L + 1.75L).
  type Family = Tally & { title: string; sizes: Set<number>; codes: string[]; group: string };
  const families = new Map<string, Family>();
  for (const i of items.values()) {
    const key = `${i.group}|${i.title.toUpperCase()}`;
    let f = families.get(key);
    if (!f) families.set(key, (f = { ...tally(), title: i.title, sizes: new Set(), codes: [], group: i.group }));
    f.dollars += i.dollars;
    f.units += i.units;
    if (i.sizeMl) f.sizes.add(i.sizeMl);
    f.codes.push(i.itemCode);
  }
  const familyOut = (f: Family) => ({
    title: f.title,
    group: f.group,
    sizesMl: [...f.sizes].sort((a, b) => a - b),
    itemCodes: f.codes.sort(),
    ...out(f),
  });
  const familiesByDollars = [...families.values()].sort((a, b) => b.dollars - a.dollars);

  const topPerGroup = groups.filter((g) => isStyle(g.slug)).map((g) => ({
    slug: g.slug,
    label: g.label,
    byUnits: byUnits.filter((i) => i.group === g.slug).slice(0, YEAR_RULES.TOP_PER_GROUP).map(itemOut),
  }));

  // ---- the peak month ----
  const monthly = window.map((m) => ({ month: m, ...out(byMonth.get(m)!) }));
  const peak = [...monthly].sort((a, b) => b.dollars - a.dollars)[0];
  const typical = median(monthly.map((m) => m.dollars));
  const peakSurges = groups
    .filter((g) => isStyle(g.slug) && (g.dollarShare ?? 0) >= YEAR_RULES.MIN_SEASON_GROUP_SHARE)
    .map((g) => {
      const months = groupMonth.get(g.slug)!;
      const units = window.map((m) => months.get(m)!.units);
      const peakUnits = months.get(peak.month)!.units;
      return { slug: g.slug, label: g.label, peakUnits, typicalUnits: median(units), vsTypical: ratio(peakUnits, median(units)) };
    })
    .sort((a, b) => (b.vsTypical ?? 0) - (a.vsTypical ?? 0));

  // ---- seasons: each category's share of each month's dollars ----
  const seasonOf = (months: Map<string, Tally>) => {
    const shares = window.map((m) => ({ month: m, share: ratio(months.get(m)!.dollars, byMonth.get(m)!.dollars) ?? 0 }));
    const hi = shares.reduce((a, b) => (b.share > a.share ? b : a));
    const lo = shares.reduce((a, b) => (b.share < a.share ? b : a));
    return { peak: hi, low: lo, peakVsLow: ratio(hi.share, lo.share), shares };
  };
  const seasons = {
    groups: groups
      .filter((g) => isStyle(g.slug) && (g.dollarShare ?? 0) >= YEAR_RULES.MIN_SEASON_GROUP_SHARE)
      .map((g) => ({ slug: g.slug, label: g.label, ...seasonOf(groupMonth.get(g.slug)!) }))
      .sort((a, b) => (b.peakVsLow ?? 0) - (a.peakVsLow ?? 0)),
    classes: [...classYear.entries()]
      .filter(([c, t]) => isStyle(groupKey(c).slug) && t.dollars / total.dollars >= YEAR_RULES.MIN_SEASON_CLASS_SHARE)
      .map(([c]) => ({ className: c, group: groupKey(c).slug, ...seasonOf(classMonth.get(c)!) }))
      .sort((a, b) => (b.peakVsLow ?? 0) - (a.peakVsLow ?? 0)),
  };

  // ---- year over year: only months reported in both years, summed ----
  const allMonths = new Set(rows.map((r) => r.month));
  const yoyMonths = window.filter((m) => allMonths.has(addMonths(m, -12)));
  let yoy = null;
  if (yoyMonths.length >= YEAR_RULES.MIN_YOY_MONTHS) {
    const cur = new Set(yoyMonths);
    const prev = new Set(yoyMonths.map((m) => addMonths(m, -12)));
    const sides = { total: { prev: tally(), cur: tally() } };
    const kinds = new Map<Kind, { prev: Tally; cur: Tally }>();
    const grp = new Map<string, { label: string; prev: Tally; cur: Tally }>();
    const cls = new Map<string, { prev: Tally; cur: Tally }>();
    for (const r of rows) {
      const side = cur.has(r.month) ? "cur" : prev.has(r.month) ? "prev" : null;
      if (!side) continue;
      add(sides.total[side], r);
      const k = kindOf(r.className);
      if (!kinds.has(k)) kinds.set(k, { prev: tally(), cur: tally() });
      add(kinds.get(k)![side], r);
      const g = groupKey(r.className);
      if (!grp.has(g.slug)) grp.set(g.slug, { label: g.label, prev: tally(), cur: tally() });
      add(grp.get(g.slug)![side], r);
      const c = (r.className ?? "").trim();
      if (c) {
        if (!cls.has(c)) cls.set(c, { prev: tally(), cur: tally() });
        add(cls.get(c)![side], r);
      }
    }
    const change = (p: Tally, c: Tally) => ({
      prev: out(p),
      cur: out(c),
      dollarChange: p.dollars ? ratio(c.dollars - p.dollars, p.dollars) : null,
      unitChange: p.units ? ratio(c.units - p.units, p.units) : null,
    });
    const byChange = (a: { dollarChange: number | null }, b: { dollarChange: number | null }) =>
      (b.dollarChange ?? 0) - (a.dollarChange ?? 0);
    yoy = {
      months: yoyMonths,
      priorMonths: yoyMonths.map((m) => addMonths(m, -12)),
      total: change(sides.total.prev, sides.total.cur),
      kinds: [...kinds.entries()]
        .filter(([k]) => k !== "other")
        .map(([kind, s]) => ({ kind, label: KIND_LABEL[kind], ...change(s.prev, s.cur) }))
        .sort(byChange),
      groups: [...grp.entries()]
        .filter(([slug, s]) => isStyle(slug) && s.prev.dollars >= YEAR_RULES.MIN_YOY_GROUP_DOLLARS)
        .map(([slug, s]) => ({ slug, label: s.label, ...change(s.prev, s.cur) }))
        .sort(byChange),
      classes: [...cls.entries()]
        .filter(([c, s]) => isStyle(groupKey(c).slug) && s.prev.dollars >= YEAR_RULES.MIN_YOY_CLASS_DOLLARS)
        .map(([className, s]) => ({ className, ...change(s.prev, s.cur) }))
        .sort(byChange),
    };
  }

  // ---- Utah brands ----
  let homegrown = null;
  if (opts.makerOf) {
    const ut = tally();
    const utKind = new Map<Kind, Tally>();
    const makers = new Map<string, Tally & { name: string }>();
    const utItems = new Map<string, Tally & { title: string; maker: string; sizeMl: number | null }>();
    for (const r of year) {
      const m = opts.makerOf(r);
      if (!m) continue;
      add(ut, r);
      const k = kindOf(r.className);
      if (!utKind.has(k)) utKind.set(k, tally());
      add(utKind.get(k)!, r);
      if (!makers.has(m.slug)) makers.set(m.slug, { ...tally(), name: m.name });
      add(makers.get(m.slug)!, r);
      if (!utItems.has(r.itemCode)) utItems.set(r.itemCode, { ...tally(), title: familyTitle(r), maker: m.slug, sizeMl: r.sizeMl });
      add(utItems.get(r.itemCode)!, r);
    }
    homegrown = {
      ...out(ut),
      dollarShare: ratio(ut.dollars, total.dollars),
      unitShare: ratio(ut.units, total.units),
      byKind: [...utKind.entries()]
        .map(([kind, t]) => ({
          kind,
          label: KIND_LABEL[kind],
          ...out(t),
          dollarShare: ratio(t.dollars, byKind.get(kind)!.dollars),
          unitShare: ratio(t.units, byKind.get(kind)!.units),
        }))
        .sort((a, b) => b.dollars - a.dollars),
      makers: [...makers.entries()]
        .map(([slug, t]) => ({ slug, name: t.name, ...out(t) }))
        .sort((a, b) => b.dollars - a.dollars)
        .slice(0, YEAR_RULES.TOP_LIST),
      topByUnits: [...utItems.entries()]
        .map(([itemCode, t]) => ({ itemCode, title: t.title, maker: t.maker, sizeMl: t.sizeMl, ...out(t) }))
        .sort((a, b) => b.units - a.units)
        .slice(0, YEAR_RULES.TOP_LIST),
    };
  }

  // ---- allocated: lines in DABS's ALLOCATED classes (an item can be allocated some months only) ----
  const allocTotal = tally();
  const allocItems = new Map<string, Tally & { name: string; title: string }>();
  for (const r of year) {
    if (!(r.className ?? "").toUpperCase().startsWith("ALLOCATED")) continue;
    add(allocTotal, r);
    if (!allocItems.has(r.itemCode)) allocItems.set(r.itemCode, { ...tally(), name: r.itemName ?? "", title: familyTitle(r) });
    add(allocItems.get(r.itemCode)!, r);
  }
  const allocated = {
    ...out(allocTotal),
    items: [...allocItems.values()].filter((i) => i.units > 0).length,
    topByUnits: [...allocItems.entries()]
      .map(([itemCode, i]) => ({ itemCode, name: i.name, title: i.title, ...out(i) }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5),
  };

  // ---- the splurge: highest price per bottle on any report line ----
  const splurge = year
    .filter((r) => (r.bottles ?? 0) > 0 && (r.dollars ?? 0) > 0)
    .map((r) => ({
      month: r.month,
      itemCode: r.itemCode,
      title: familyTitle(r),
      sizeMl: r.sizeMl,
      units: r.bottles!,
      unitPrice: round2(r.dollars! / r.bottles!),
    }))
    .sort((a, b) => b.unitPrice - a.unitPrice)
    .slice(0, 5);

  return {
    window: { from: window[0], through: window.at(-1)!, months: window, days },
    totals: {
      ...out(total),
      items: [...items.values()].filter((i) => i.units > 0).length,
      unitsPerDay: Math.round(total.units / days),
      dollarsPerDay: Math.round(total.dollars / days),
    },
    mix,
    groups,
    top: {
      familiesByDollars: familiesByDollars.slice(0, YEAR_RULES.TOP_LIST).map(familyOut),
      itemsByUnits: byUnits.slice(0, YEAR_RULES.TOP_LIST).map(itemOut),
      perGroup: topPerGroup,
    },
    monthly,
    peakMonth: { ...peak, typicalMonthDollars: round2(typical), vsTypical: ratio(peak.dollars, typical), surges: peakSurges.slice(0, 5) },
    seasons,
    yoy,
    homegrown,
    allocated,
    splurge,
  };
}

export type YearSnapshot = ReturnType<typeof buildYear>;
