import {
  BODY_LABELS,
  NOVELTY_LABELS,
  SWEET_LABELS,
  TAG_LABELS,
  TYPE_LABELS,
  WINE_TYPES,
  requestHref,
  type ResolvedRequest,
  type TasteRequest,
} from "@/lib/taste/request";
import type { TasteOutcome } from "@/lib/taste/recommend";

/**
 * Pure helpers for the taste results: the interpretation chips, the one
 * clarifying question, follow-up adjustments and ways to relax a request.
 * Every link rewrites the same structured request in the URL.
 */
type Params = Record<string, string | string[] | undefined>;

export interface Chip {
  key: string;
  label: string;
  /** Where it came from, shown next to the chip ("“not too dry”"). */
  from: string | null;
  removeHref: string;
}

const followup = { via: "followup" };

export function chips(r: ResolvedRequest, defaults: TasteRequest, base: Params, areaLabel: string | null): { hard: Chip[]; prefs: Chip[] } {
  const req = r.request;
  const href = (next: TasteRequest) => requestHref(base, next, defaults, followup);
  const from = (k: keyof TasteRequest) =>
    r.origin[k] === "typed" || r.origin[k] === "model"
      ? r.phrases[k] ? `“${r.phrases[k]}”${r.origin[k] === "model" ? " (AI-read)" : ""}` : null
      : r.origin[k] === "area-picker"
        ? "your area setting"
        : null;
  const hard: Chip[] = [];
  const prefs: Chip[] = [];
  // Hard constraints read plainly ("Under $30"); only preferences, where the
  // reading is a judgment call, show the words they came from.
  if (req.type) hard.push({ key: "type", label: TYPE_LABELS[req.type], from: null, removeHref: href({ ...req, type: null, grape: null }) });
  if (req.grape) hard.push({ key: "grape", label: req.grape, from: null, removeHref: href({ ...req, grape: null }) });
  if (req.minPrice != null && req.maxPrice != null) {
    hard.push({ key: "price", label: `$${req.minPrice}–$${req.maxPrice}`, from: r.phrases.maxPrice && /around|about|roughly/.test(r.phrases.maxPrice) ? `“${r.phrases.maxPrice}”` : null, removeHref: href({ ...req, minPrice: null, maxPrice: null }) });
  } else if (req.maxPrice != null) {
    hard.push({ key: "max", label: `Under $${req.maxPrice}`, from: r.origin.maxPrice === "typed" && /around|about|roughly|cheap|budget|affordable|inexpensive|bargain/.test(r.phrases.maxPrice ?? "") ? `“${r.phrases.maxPrice}”` : null, removeHref: href({ ...req, maxPrice: null }) });
  } else if (req.minPrice != null) {
    hard.push({ key: "min", label: `$${req.minPrice} and up`, from: null, removeHref: href({ ...req, minPrice: null }) });
  }
  if (req.area && areaLabel) hard.push({ key: "area", label: areaLabel === "Near you" ? "Near you (10 mi)" : `Near ${areaLabel} (10 mi)`, from: r.origin.area === "area-picker" ? "your area setting" : null, removeHref: href({ ...req, area: null }) });
  if (req.sweet) prefs.push({ key: "sweet", label: SWEET_LABELS[req.sweet], from: from("sweet"), removeHref: href({ ...req, sweet: null }) });
  if (req.body) prefs.push({ key: "body", label: BODY_LABELS[req.body], from: from("body"), removeHref: href({ ...req, body: null }) });
  for (const t of req.tags) {
    prefs.push({ key: `tag:${t}`, label: `Prefer ${TAG_LABELS[t]}`, from: from("tags"), removeHref: href({ ...req, tags: req.tags.filter((x) => x !== t) }) });
  }
  if (req.novelty) {
    prefs.push({
      key: "novelty",
      label: req.novelty === "ask" ? NOVELTY_LABELS.style : NOVELTY_LABELS[req.novelty],
      from: from("novelty"),
      removeHref: href({ ...req, novelty: null }),
    });
  }
  return { hard, prefs };
}

export interface Clarification {
  question: string;
  options: { label: string; href: string; current?: boolean }[];
  /** "area" asks for a place with the area picker instead of links. */
  kind: "novelty" | "type" | "area";
}

/** At most one question, only when the answer would change the results. */
export function clarification(r: ResolvedRequest, defaults: TasteRequest, base: Params, areaResolved: boolean): Clarification | null {
  const req = r.request;
  const href = (next: TasteRequest) => requestHref(base, next, defaults, followup);
  if (req.area === "me" && !areaResolved) {
    return { kind: "area", question: "Where should we look? Pick an area to see wines on a shelf near you.", options: [] };
  }
  if (req.novelty === "ask") {
    return {
      kind: "novelty",
      question: "“Not super common” can mean two things. Showing less common grapes and styles.",
      options: [
        { label: "Less common grape or style", href: href({ ...req, novelty: "style" }), current: true },
        { label: "Harder to find in Utah", href: href({ ...req, novelty: "scarce" }) },
      ],
    };
  }
  if (!req.type && !req.grape) {
    return {
      kind: "type",
      question: "Which kind of wine? Showing all four for now.",
      options: WINE_TYPES.map((t) => ({ label: TYPE_LABELS[t], href: href({ ...req, type: t }) })),
    };
  }
  return null;
}

export interface FollowUp {
  key: string;
  label: string;
  href: string | null;
  /** Why it's unavailable, when href is null. */
  note?: string;
}

const SWEETER: Record<string, TasteRequest["sweet"]> = { none: "offdry", dry: "offdry", offdry: "sweet" };
const LIGHTER: Record<string, TasteRequest["body"]> = { none: "light", full: "medium", medium: "light" };

export function followUps(req: TasteRequest, defaults: TasteRequest, base: Params, outcome: TasteOutcome): FollowUp[] {
  const href = (next: TasteRequest) => requestHref(base, next, defaults, followup);
  const out: FollowUp[] = [];
  const sweeter = SWEETER[req.sweet ?? "none"];
  out.push(
    sweeter
      ? { key: "sweeter", label: "A little sweeter", href: href({ ...req, sweet: sweeter }) }
      : { key: "sweeter", label: "A little sweeter", href: null, note: "Already asking for sweet wines." }
  );
  const lighter = LIGHTER[req.body ?? "none"];
  out.push(
    lighter
      ? { key: "lighter", label: "Lighter-bodied", href: href({ ...req, body: lighter }) }
      : { key: "lighter", label: "Lighter-bodied", href: null, note: "Already asking for light-bodied wines." }
  );
  const prices = outcome.results.map((r) => Number(r.price)).filter((n) => Number.isFinite(n) && n > 0);
  const ceiling = req.maxPrice ?? (prices.length ? Math.max(...prices) : null);
  const lower = ceiling != null ? lowerBudget(ceiling) : null;
  out.push(
    lower != null && (req.minPrice == null || lower > req.minPrice)
      ? { key: "cheaper", label: `Under $${lower}`, href: href({ ...req, maxPrice: lower }) }
      : { key: "cheaper", label: "Lower price", href: null, note: "No lower budget step to try." }
  );
  return out;
}

/** The next budget step down: $50 → $40, $30 → $25, $20 → $15, $15 → $12, $12 → $10. */
export function lowerBudget(max: number): number | null {
  const steps = [10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
  const below = steps.filter((s) => s < max);
  return below.length ? below[below.length - 1] : null;
}

/** The next budget step up, for "raise the budget". */
export function higherBudget(max: number): number {
  const steps = [15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300];
  return steps.find((s) => s > max) ?? Math.round(max * 1.5);
}

export interface Relax {
  label: string;
  href: string;
}

/** Explicit ways to widen a request that found little or nothing. Never applied silently. */
export function relaxOptions(req: TasteRequest, defaults: TasteRequest, base: Params, outcome: TasteOutcome, areaLabel: string | null): Relax[] {
  const href = (next: TasteRequest) => requestHref(base, next, defaults, followup);
  const out: Relax[] = [];
  if (req.area && areaLabel) {
    out.push({ label: `Search all of Utah instead of near ${areaLabel === "Near you" ? "you" : areaLabel}`, href: href({ ...req, area: null }) });
  }
  if (req.maxPrice != null) out.push({ label: `Raise the budget to $${higherBudget(req.maxPrice)}`, href: href({ ...req, maxPrice: higherBudget(req.maxPrice) }) });
  if (req.sweet) out.push({ label: "Drop the sweetness preference", href: href({ ...req, sweet: null }) });
  if (req.body) out.push({ label: "Drop the body preference", href: href({ ...req, body: null }) });
  if (req.tags.length) out.push({ label: "Drop the style words", href: href({ ...req, tags: [] }) });
  if (req.novelty) out.push({ label: "Drop “less common”", href: href({ ...req, novelty: null }) });
  if (req.grape) out.push({ label: `Any grape, not just ${req.grape}`, href: href({ ...req, grape: null }) });
  return out.slice(0, 4);
}
