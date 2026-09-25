import type { RarityTier } from "@/lib/queries";
import type { Attr, Body, Sweetness, Tag, WineProfile } from "@/lib/taste/profile";
import type { TasteRequest } from "@/lib/taste/request";

/**
 * Pure scoring for taste recommendations (lib/taste/recommend.ts): manual
 * overrides, per-preference scores weighted by evidence, and the reason
 * sentences, worded by what kind of evidence they rest on.
 */
type Overrides = Record<string, { value: unknown; note: string; reviewed_on: string }> | null;

// ---------------------------------------------------------------------------
// Overrides: documented manual corrections replace extracted values.

export function applyOverrides(profile: WineProfile, overrides: Overrides): WineProfile {
  if (!overrides) return profile;
  const p: WineProfile = { ...profile, tags: [...profile.tags] };
  for (const [attribute, o] of Object.entries(overrides)) {
    const manual = { evidence: "manual" as const, source: `override:${o.reviewed_on}`, confidence: "high" as const, note: o.note };
    if (attribute.startsWith("tag:")) {
      const tag = attribute.slice(4) as Tag;
      p.tags = p.tags.filter((t) => t.value !== tag);
      if (o.value === true) p.tags.push({ ...manual, value: tag });
    } else if (["sweetness", "body", "fizz", "region", "grapes", "color"].includes(attribute)) {
      const value = o.value ?? null;
      (p as unknown as Record<string, Attr<unknown>>)[attribute] =
        value == null ? { value: null, evidence: "manual", source: manual.source, confidence: null, note: o.note } : { ...manual, value };
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
// Scoring. Each preference is its own dimension; nothing collapses sweetness,
// body and style words into one number before weighting by evidence.

const SWEET_TABLE: Record<NonNullable<TasteRequest["sweet"]>, Record<Sweetness, number>> = {
  dry: { dry: 3, "off-dry": 1, "medium-sweet": -3, sweet: -4 },
  offdry: { dry: -3, "off-dry": 3, "medium-sweet": 2.5, sweet: 1.5 },
  sweet: { dry: -4, "off-dry": 0, "medium-sweet": 2, sweet: 3 },
};

const BODY_TABLE: Record<NonNullable<TasteRequest["body"]>, Record<Body, number>> = {
  light: { light: 2, medium: 0, full: -2 },
  medium: { light: 0, medium: 2, full: 0 },
  full: { light: -2, medium: 0, full: 2 },
};

/** How much a value counts, by kind and strength of evidence. */
export function weight(a: Pick<Attr<unknown>, "evidence" | "confidence">): number {
  if (a.evidence === "manual") return 1;
  if (a.evidence === "product") return a.confidence === "high" ? 1 : a.confidence === "medium" ? 0.8 : 0.5;
  if (a.evidence === "style") return a.confidence === "medium" ? 0.6 : 0.4;
  return 0;
}

export interface Contribution {
  attribute: string;
  points: number;
  reason: string;
}

export const SWEET_WORDS: Record<Sweetness, string> = { dry: "dry", "off-dry": "off-dry", "medium-sweet": "semi-sweet", sweet: "sweet" };
export const BODY_WORDS: Record<Body, string> = { light: "light-bodied", medium: "medium-bodied", full: "full-bodied" };

/** One sentence about one attribute, worded by its evidence kind. */
export function describeAttr(label: string, a: Attr<unknown>, valueWords: string): string {
  if (a.evidence === "manual") return `${cap(label)}: ${valueWords} (reviewed by Utah Drops${a.note ? `: ${a.note}` : ""}).`;
  if (a.evidence === "style") return `Style note: ${a.note ?? `typically ${valueWords}`} (general, not from this bottle's listing).`;
  if (a.source === "dabs_description") return `DABS's listing describes it as ${valueWords}: “${a.quote}”`;
  if (a.source === "dabs_name") {
    const label = a.note?.match(/^labeled (.+)$/)?.[1];
    return label ? `Its DABS name says “${label}” (${valueWords}).` : `Its DABS name says ${valueWords}.`;
  }
  if (a.source === "dabs_category") return `DABS lists it under ${a.quote ?? "its category"}.`;
  return `${cap(label)}: ${valueWords}.`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function sparklingSweetNote(a: Attr<Sweetness>): string {
  // Sparkling labels read backwards to most people; say what they mean.
  if (a.source === "dabs_name" && /Extra Dry/i.test(a.note ?? "")) return `Its DABS name says “Extra Dry”, which for sparkling wine means off-dry (slightly sweet).`;
  if (a.source === "dabs_name" && /^labeled Brut$/i.test(a.note ?? "")) return `Its DABS name says “Brut”, which means dry.`;
  return describeAttr("sweetness", a, SWEET_WORDS[a.value!]);
}

export function scoreProfile(
  profile: WineProfile,
  req: TasteRequest,
  ctx: { lessCommon: string | null; rarityTier: RarityTier | null }
): { points: number; contributions: Contribution[]; unknowns: string[]; contradicted: boolean } {
  const contributions: Contribution[] = [];
  const unknowns: string[] = [];
  let contradicted = false;

  if (req.sweet) {
    const a = profile.sweetness;
    if (a.value) {
      const raw = SWEET_TABLE[req.sweet][a.value];
      const pts = raw * weight(a);
      if (raw <= -3 && (a.evidence === "product" || a.evidence === "manual")) contradicted = true;
      contributions.push({ attribute: "sweetness", points: pts, reason: sparklingSweetNote(a as Attr<Sweetness>) });
    } else unknowns.push("sweetness");
  }
  if (req.body) {
    const a = profile.body;
    if (a.value) {
      const raw = BODY_TABLE[req.body][a.value];
      if (raw <= -2 && (a.evidence === "product" || a.evidence === "manual")) contradicted = true;
      contributions.push({ attribute: "body", points: raw * weight(a), reason: describeAttr("body", a, BODY_WORDS[a.value]) });
    } else unknowns.push("body");
  }
  for (const tag of req.tags) {
    const t = profile.tags.find((x) => x.value === tag);
    if (t) contributions.push({ attribute: `tag:${tag}`, points: 1.5 * weight(t), reason: describeAttr(tag, t, tag) });
    else if (tag === "refreshing" && profile.fizz.value && profile.fizz.value !== "still") {
      contributions.push({ attribute: "tag:refreshing", points: 0.5, reason: `It's ${profile.fizz.value} (${profile.fizz.source === "dabs_category" ? "DABS category" : "DABS listing"}).` });
    }
  }
  if (req.novelty === "style" || req.novelty === "ask") {
    // An ambiguous "not super common" counts for less than an explicit ask.
    if (ctx.lessCommon) contributions.push({ attribute: "novelty", points: req.novelty === "ask" ? 1.5 : 2, reason: ctx.lessCommon });
  }
  if (req.novelty === "scarce") {
    if (ctx.rarityTier === "uncommon" || ctx.rarityTier === "scarce") {
      contributions.push({ attribute: "novelty", points: 2, reason: `Utah Drops rating: ${cap(ctx.rarityTier)} (how easy it is to find in Utah).` });
    }
  }
  // A stated taste preference we know nothing about costs a little, so fully
  // supported matches come first; it never excludes a bottle on its own.
  const points = contributions.reduce((s, c) => s + c.points, 0) - 0.5 * unknowns.length;
  return { points, contributions, unknowns, contradicted };
}

