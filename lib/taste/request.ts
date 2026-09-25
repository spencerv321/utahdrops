import type { Tag } from "@/lib/taste/profile";
import { TAGS } from "@/lib/taste/profile";

/**
 * One structured request behind taste search. A typed description, the "Help
 * me choose" panel and the follow-up buttons all produce this same object, and
 * it round-trips through the /search URL:
 *
 *   wine=white|red|rose|sparkling   hard: kind of wine
 *   max=30 / min=10                 hard: price (max is the existing filter)
 *   area=Draper                     hard: fresh stock at a store within 10 mi
 *   sweet=dry|offdry|sweet          preference (ranking)
 *   body=light|medium|full          preference (ranking)
 *   like=crisp,fruity               preference (ranking)
 *   novel=style|scarce              preference (ranking), "ask" = ambiguous
 *   grape=Riesling                  hard, when named
 *
 * URL values win over what was read from the typed words; "any" clears one.
 */
export type WineType = "white" | "red" | "rose" | "sparkling";
export type SweetPref = "dry" | "offdry" | "sweet";
export type BodyPref = "light" | "medium" | "full";
export type NoveltyPref = "style" | "scarce" | "ask";

export const WINE_TYPES: WineType[] = ["white", "red", "rose", "sparkling"];
export const SWEET_PREFS: SweetPref[] = ["dry", "offdry", "sweet"];
export const BODY_PREFS: BodyPref[] = ["light", "medium", "full"];

export interface TasteRequest {
  type: WineType | null;
  grape: string | null;
  maxPrice: number | null;
  minPrice: number | null;
  /** An area label from the picker list, or "me" (the visitor's own area). */
  area: string | null;
  sweet: SweetPref | null;
  body: BodyPref | null;
  tags: Tag[];
  novelty: NoveltyPref | null;
}

export const EMPTY_REQUEST: TasteRequest = {
  type: null,
  grape: null,
  maxPrice: null,
  minPrice: null,
  area: null,
  sweet: null,
  body: null,
  tags: [],
  novelty: null,
};

/** Where each part of the request came from, for the chips ("from your words"). */
export type Origin = "typed" | "url" | "area-picker" | "model";

export interface ResolvedRequest {
  request: TasteRequest;
  origin: Partial<Record<keyof TasteRequest, Origin>>;
  /** Typed phrases behind each part, e.g. sweet ← "not too dry". */
  phrases: Partial<Record<keyof TasteRequest, string>>;
  /** Typed words we couldn't use (shown, so nothing is silently ignored). */
  unused: string[];
}

export const TYPE_LABELS: Record<WineType, string> = {
  white: "White wine",
  red: "Red wine",
  rose: "Rosé",
  sparkling: "Sparkling wine",
};

export const SWEET_LABELS: Record<SweetPref, string> = {
  dry: "Prefer dry",
  offdry: "Prefer off-dry (a touch sweet)",
  sweet: "Prefer sweet",
};

export const BODY_LABELS: Record<BodyPref, string> = {
  light: "Prefer light-bodied",
  medium: "Prefer medium-bodied",
  full: "Prefer full-bodied",
};

export const NOVELTY_LABELS: Record<NoveltyPref, string> = {
  style: "Less common grape or style",
  scarce: "Harder to find",
  ask: "Not super common",
};

export const TAG_LABELS: Record<Tag, string> = {
  crisp: "crisp",
  refreshing: "refreshing",
  fruity: "fruity",
  oaky: "oaky",
  creamy: "creamy",
  floral: "floral",
  mineral: "mineral",
  earthy: "earthy",
  spicy: "spicy",
  smooth: "smooth",
};

// ---------------------------------------------------------------------------
// URL <-> request

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : undefined);

const money = (v: string | undefined): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === "" || v === "any") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 10_000 ? Math.round(n * 100) / 100 : undefined;
};

/** Request parts set explicitly in the URL. null = explicitly cleared ("any"). */
export function requestFromParams(params: Params): Partial<TasteRequest> {
  const out: Partial<TasteRequest> = {};
  const wine = one(params.wine);
  if (wine === "any") out.type = null;
  else if (WINE_TYPES.includes(wine as WineType)) out.type = wine as WineType;
  const grape = one(params.grape);
  if (grape === "any") out.grape = null;
  else if (grape && /^[\p{L} '·.-]{3,30}$/u.test(grape)) out.grape = grape;
  const max = money(one(params.max));
  if (max !== undefined) out.maxPrice = max;
  const min = money(one(params.min));
  if (min !== undefined) out.minPrice = min;
  const area = one(params.area);
  if (area === "any") out.area = null;
  else if (area && area.length <= 60) out.area = area;
  const sweet = one(params.sweet);
  if (sweet === "any") out.sweet = null;
  else if (SWEET_PREFS.includes(sweet as SweetPref)) out.sweet = sweet as SweetPref;
  const body = one(params.body);
  if (body === "any") out.body = null;
  else if (BODY_PREFS.includes(body as BodyPref)) out.body = body as BodyPref;
  // The guided form sends like="" plus one like=<tag> per checked box.
  const like = Array.isArray(params.like) ? params.like.filter(Boolean).join(",") : one(params.like);
  if (like !== undefined) {
    out.tags = like === "none" || like === "" ? [] : like.split(",").filter((t): t is Tag => TAGS.includes(t as Tag)).slice(0, 4);
  }
  const novel = one(params.novel);
  if (novel === "none") out.novelty = null;
  else if (novel === "style" || novel === "scarce" || novel === "ask") out.novelty = novel;
  return out;
}

/** True when the URL itself asks for taste results (guided panel, follow-ups). */
export function hasTasteParams(params: Params): boolean {
  return ["wine", "sweet", "body", "like", "novel", "grape"].some((k) => one(params[k]) !== undefined);
}

/**
 * URL for a request. Keeps q and unrelated filters, and writes only the parts
 * that differ from `defaults` (what q and the area picker already give), so
 * URLs stay short: "any"/"none" where a default is cleared.
 */
export function requestHref(
  base: Params,
  req: TasteRequest,
  defaults: TasteRequest = EMPTY_REQUEST,
  extra: Record<string, string | null> = {}
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === "string" && !TASTE_KEYS.includes(k) && k !== "page") next.set(k, v);
  }
  const put = (key: string, value: string | null, dflt: string | null, cleared = "any") => {
    if (value === dflt) return;
    next.set(key, value ?? cleared);
  };
  put("wine", req.type, defaults.type);
  put("grape", req.grape, defaults.grape);
  put("max", req.maxPrice != null ? String(req.maxPrice) : null, defaults.maxPrice != null ? String(defaults.maxPrice) : null);
  put("min", req.minPrice != null ? String(req.minPrice) : null, defaults.minPrice != null ? String(defaults.minPrice) : null);
  put("area", req.area, defaults.area);
  put("sweet", req.sweet, defaults.sweet);
  put("body", req.body, defaults.body);
  put("like", req.tags.length ? req.tags.join(",") : null, defaults.tags.length ? defaults.tags.join(",") : null, "none");
  put("novel", req.novelty, defaults.novelty, "none");
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) next.delete(k);
    else next.set(k, v);
  }
  return `/search?${next.toString()}`;
}

export const TASTE_KEYS = ["wine", "grape", "max", "min", "area", "sweet", "body", "like", "novel", "via"];

/** Merge: typed words first, URL overrides, then the picker's area as default. */
export function resolveRequest(
  typed: ResolvedRequest | null,
  params: Params,
  pickerArea: string | null
): ResolvedRequest {
  const fromUrl = requestFromParams(params);
  const request: TasteRequest = { ...EMPTY_REQUEST, ...(typed?.request ?? {}) };
  const origin: ResolvedRequest["origin"] = { ...(typed?.origin ?? {}) };
  const phrases: ResolvedRequest["phrases"] = { ...(typed?.phrases ?? {}) };
  for (const [k, v] of Object.entries(fromUrl) as [keyof TasteRequest, never][]) {
    (request as unknown as Record<string, unknown>)[k] = v;
    origin[k] = "url";
    delete phrases[k];
  }
  if (!("area" in fromUrl) && !request.area && pickerArea) {
    request.area = pickerArea;
    origin.area = "area-picker";
  }
  return { request, origin, phrases, unused: typed?.unused ?? [] };
}

/** Anything to rank by (beyond the hard constraints)? */
export function hasPreferences(r: TasteRequest): boolean {
  return !!(r.sweet || r.body || r.tags.length || r.novelty);
}

/**
 * Does this search get taste picks? The guided panel and follow-ups always
 * do; typed words do when they describe a wine with a preference, budget or
 * place. Words the rules can't read go to the model step only when nothing
 * matched by name, so exact bottle names stay plain, fast name search.
 */
export function isTasteSearch(
  typed: { isTaste: boolean; wineish: boolean; unused: string[] } | null,
  params: Params,
  exactHits: number,
  modelAvailable: boolean
): boolean {
  return (
    hasTasteParams(params) ||
    !!typed?.isTaste ||
    (!!typed?.wineish && exactHits === 0 && typed.unused.length > 0 && modelAvailable)
  );
}
