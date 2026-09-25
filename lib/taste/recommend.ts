import { sql } from "@/lib/db";
import { NEARBY_MILES } from "@/lib/area";
import type { Area } from "@/lib/area";
import { PILOT_GROUP_SQL } from "@/lib/taste/pilot";
import { findGrapes, type Attr, type WineProfile } from "@/lib/taste/profile";
import { applyOverrides, BODY_WORDS, scoreProfile, SWEET_WORDS, type Contribution } from "@/lib/taste/score";
import { hasPreferences, type TasteRequest, type WineType } from "@/lib/taste/request";
import type { RarityTier } from "@/lib/queries";

/**
 * Taste recommendations for the pilot wines. Hard constraints (kind of wine,
 * grape, price, area, ordinary retail stock) are SQL filters: a bottle that
 * fails one is never shown. Preferences (sweetness, body, style words,
 * novelty) only rank, each scored separately and weighted by how strong the
 * evidence is. Every shown reason comes from a stored attribute with its
 * evidence, so it can be traced back.
 */

/**
 * Per-store stock older than this doesn't count as "near you" for a
 * recommendation. Stricter than the site-wide 7 days: the store job's
 * rotation target is 3 days. Failed checks never renew it (store rows are
 * written only by successful checks).
 */
export const RECO_STORE_MAX_AGE_HOURS = 72;
/** A drawing in this window means store stock may be winners' pickups, not shelf stock. */
export const DRAWING_EXCLUDE_DAYS = 180;
export const MAX_RESULTS = 6;
/** A grape under this share of in-stock bottles of its kind counts as less common here. */
export const LESS_COMMON_SHARE = 0.04;

export interface EvidenceLine {
  attribute: string;
  text: string;
  kind: "product" | "style" | "manual" | "catalog" | "rating" | "unknown";
  /** "DABS listing text", "DABS product name", "General style knowledge", … */
  sourceLabel: string;
}

export interface Recommendation {
  csc: string;
  name: string;
  sizeMl: number | null;
  category: string | null;
  price: string | null;
  score: number;
  reason: string;
  /** Requested preferences this wine has no information about. */
  unknowns: string[];
  evidence: EvidenceLine[];
  near: { stores: number; units: number; checkedAt: Date } | null;
  statewide: { units: number | null; asOf: Date };
  rarityTier: RarityTier | null;
  showRarity: boolean;
}

export interface TasteOutcome {
  results: Recommendation[];
  /** Bottles passing the hard constraints (before preferences). */
  eligible: number;
  /** Area searches: pilot wines otherwise eligible but not checked near there within RECO_STORE_MAX_AGE_HOURS. */
  unknownNear: number;
  /** Area searches: checked recently and not at any store near there. */
  notNear: number;
  /** Eligible bottles we couldn't rank because every requested preference is unknown for them. */
  noInfo: number;
  pilotSize: number;
}

interface Row {
  csc: string;
  name: string;
  size_ml: number | null;
  category: string | null;
  current_price: string | null;
  store_qty: number | null;
  last_seen: Date;
  profile: WineProfile;
  pilot_group: WineType;
  source_read_at: Date | null;
  overrides: Record<string, { value: unknown; note: string; reviewed_on: string }> | null;
  rarity_tier: RarityTier | null;
  near_stores: number | null;
  near_units: number | null;
  near_checked: Date | null;
  checked_recently: boolean;
}

// ---------------------------------------------------------------------------
// "Less common here": a grape's share of in-stock bottles of the same kind,
// counted from the whole catalog (not just the pilot). A shelf fact about
// Utah, not a claim about quality or about what a visitor has tried.

let shareCache: { at: number; byGroup: Map<string, { total: number; counts: Map<string, number> }> } | null = null;

async function grapeShares() {
  if (shareCache && Date.now() - shareCache.at < 3600_000) return shareCache.byGroup;
  const rows = (await sql.unsafe(`
    select ${PILOT_GROUP_SQL} as grp, name, category from products
    where in_stock and delisted_at is null and category not like 'SPECIAL ORDERS%'`)) as unknown as {
    grp: string | null; name: string; category: string;
  }[];
  const byGroup = new Map<string, { total: number; counts: Map<string, number> }>();
  for (const r of rows) {
    if (!r.grp) continue;
    const text = `${r.name} ${r.category}`.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const g = findGrapes(text);
    if (g.length !== 1) continue;
    const bucket = byGroup.get(r.grp) ?? { total: 0, counts: new Map() };
    bucket.total++;
    bucket.counts.set(g[0], (bucket.counts.get(g[0]) ?? 0) + 1);
    byGroup.set(r.grp, bucket);
  }
  shareCache = { at: Date.now(), byGroup };
  return byGroup;
}

const GROUP_NOUN: Record<WineType, string> = { white: "white wines", red: "red wines", rose: "rosés", sparkling: "sparkling wines" };

function lessCommonLine(
  profile: WineProfile,
  group: WineType,
  shares: Map<string, { total: number; counts: Map<string, number> }>
): string | null {
  const grapes = profile.grapes.value;
  if (!grapes || grapes.length !== 1 || profile.grapes.evidence === "none") return null;
  const bucket = shares.get(group);
  if (!bucket || bucket.total < 50) return null;
  const n = bucket.counts.get(grapes[0]) ?? 0;
  if (n === 0 || n / bucket.total >= LESS_COMMON_SHARE) return null;
  return `Less common here: ${grapes[0]} is ${n} of the ${bucket.total.toLocaleString("en-US")} in-stock ${GROUP_NOUN[group]} we can tell the grape of.`;
}

// ---------------------------------------------------------------------------

export async function recommend(req: TasteRequest, area: Area | null, catalogAsOf: Date | null): Promise<TasteOutcome> {
  const nearIds = area ? await storeIdsNear(area) : null;

  const rows = (await sql`
    select p.csc, p.name, p.size_ml, p.category, p.current_price::text, p.store_qty, p.last_seen,
           w.profile, w.pilot_group, w.source_read_at,
           (select jsonb_object_agg(o.attribute, jsonb_build_object('value', o.value, 'note', o.note, 'reviewed_on', o.reviewed_on))
              from wine_profile_overrides o where o.csc = p.csc) as overrides,
           case when ro.csc is not null then ro.tier when pr.published then pr.tier end as rarity_tier,
           near.stores as near_stores, near.units as near_units, near.checked as near_checked,
           coalesce(p.store_checked_at > now() - make_interval(hours => ${RECO_STORE_MAX_AGE_HOURS}), false) as checked_recently
    from wine_profiles w
    join products p using (csc)
    left join product_rarity pr using (csc)
    left join rarity_overrides ro on ro.csc = p.csc
    left join lateral (
      select count(*)::int as stores, sum(c.qty)::int as units, max(c.scraped_at) as checked
      from store_inventory_current c
      where c.csc = p.csc and c.qty > 0
        and c.store_id = any(${nearIds ?? []}::int[])
        and c.scraped_at > now() - make_interval(hours => ${RECO_STORE_MAX_AGE_HOURS})
    ) near on ${nearIds != null}
    where w.identity_status = 'ok'
      and p.in_stock and p.delisted_at is null
      and coalesce(p.status, '') not in ('A', 'N', 'S', 'X')
      and coalesce(p.category, '') !~ 'ALLOCATED|OFFER|SPECIAL ORDERS'
      and not exists (
        select 1 from rhdp_drawings d
        where d.item_code = p.csc and d.last_seen > now() - make_interval(days => ${DRAWING_EXCLUDE_DAYS}))
      and not exists (
        select 1 from wine_profile_overrides x
        where x.csc = p.csc and x.attribute = 'exclude' and x.value = 'true'::jsonb)
      ${req.type ? sql`and w.pilot_group = ${req.type}` : sql``}
      ${req.maxPrice != null ? sql`and p.current_price <= ${req.maxPrice}` : sql``}
      ${req.minPrice != null ? sql`and p.current_price >= ${req.minPrice}` : sql``}
    `) as unknown as Row[];

  const [{ n: pilotSize }] = (await sql`select count(*)::int as n from wine_profiles`) as unknown as { n: number }[];

  // Grape is a hard constraint, checked on the merged profile.
  let eligible = rows.map((r) => ({ ...r, profile: applyOverrides(r.profile, r.overrides) }));
  if (req.grape) {
    eligible = eligible.filter((r) => (r.profile.grapes.value ?? []).some((g) => g.toLowerCase() === req.grape!.toLowerCase()));
  }
  let unknownNear = 0;
  let notNear = 0;
  if (nearIds) {
    const inArea = eligible.filter((r) => (r.near_stores ?? 0) > 0);
    unknownNear = eligible.filter((r) => !(r.near_stores ?? 0) && !r.checked_recently).length;
    notNear = eligible.filter((r) => !(r.near_stores ?? 0) && r.checked_recently).length;
    eligible = inArea;
  }

  const shares = req.novelty === "style" || req.novelty === "ask" ? await grapeShares() : new Map();
  const prefs = hasPreferences(req);
  let noInfo = 0;

  const scored = eligible
    .map((r) => {
      const lessCommon = shares.size ? lessCommonLine(r.profile, r.pilot_group, shares) : null;
      const s = scoreProfile(r.profile, req, { lessCommon, rarityTier: r.rarity_tier });
      return { r, s, lessCommon };
    })
    .filter(({ s }) => {
      if (!prefs) return true;
      if (s.contributions.length === 0) noInfo++;
      // Only bottles with real support for what was asked, and nothing the
      // bottle's own listing contradicts.
      return s.points > 0 && !s.contradicted;
    })
    .sort(
      (a, b) =>
        b.s.points - a.s.points ||
        (b.r.near_stores ?? 0) - (a.r.near_stores ?? 0) ||
        evidenceCount(b.r.profile) - evidenceCount(a.r.profile) ||
        Number(a.r.current_price ?? 0) - Number(b.r.current_price ?? 0) ||
        a.r.csc.localeCompare(b.r.csc)
    );

  const results: Recommendation[] = scored.slice(0, MAX_RESULTS).map(({ r, s }) => {
    const best = [...s.contributions].sort((a, b) => b.points - a.points)[0];
    return {
      csc: r.csc,
      name: r.name,
      sizeMl: r.size_ml,
      category: r.category,
      price: r.current_price,
      score: Math.round(s.points * 100) / 100,
      reason: best?.reason ?? defaultReason(r.profile),
      unknowns: s.unknowns,
      evidence: evidenceLines(r.profile, s.contributions, r.source_read_at),
      near:
        nearIds && r.near_stores
          ? { stores: r.near_stores, units: r.near_units ?? 0, checkedAt: r.near_checked! }
          : null,
      statewide: { units: r.store_qty, asOf: catalogAsOf ?? r.last_seen },
      rarityTier: r.rarity_tier,
      showRarity: !!r.rarity_tier && (req.novelty === "scarce" || ["scarce", "rare", "unicorn"].includes(r.rarity_tier)),
    };
  });

  return { results, eligible: eligible.length, unknownNear, notNear, noInfo, pilotSize };
}

function evidenceCount(p: WineProfile): number {
  return [p.sweetness, p.body, p.grapes, p.region].filter((a) => a.evidence === "product" || a.evidence === "manual").length;
}

function defaultReason(p: WineProfile): string {
  if (p.grapes.value?.length && p.region.value) return `${p.grapes.value.join(", ")} from ${p.region.value}.`;
  if (p.grapes.value?.length) return `${p.grapes.value.join(", ")}.`;
  if (p.region.value) return `From ${p.region.value}.`;
  return "Matches your budget and area.";
}

const SOURCE_LABELS: Record<string, string> = {
  dabs_description: "DABS listing text",
  dabs_name: "DABS product name",
  dabs_category: "DABS category",
};

function sourceLabel(a: Attr<unknown>, readAt: Date | null): string {
  if (a.evidence === "manual") return `Reviewed correction (${a.source?.replace("override:", "")})`;
  if (a.evidence === "style") return "General style knowledge";
  const base = SOURCE_LABELS[a.source ?? ""] ?? "DABS";
  if (a.source === "dabs_description" && readAt) {
    return `${base}, read ${readAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" })}`;
  }
  return base;
}

/** Everything behind a card, for the "Why this match" disclosure. */
function evidenceLines(p: WineProfile, contributions: Contribution[], readAt: Date | null): EvidenceLine[] {
  const lines: EvidenceLine[] = [];
  const push = (attribute: string, a: Attr<unknown>, text: string) => {
    if (a.evidence === "none") return;
    lines.push({ attribute, text, kind: a.evidence as EvidenceLine["kind"], sourceLabel: sourceLabel(a, readAt) });
  };
  if (p.grapes.value?.length) push("Grape", p.grapes, `${p.grapes.value.join(", ")}${p.grapes.source === "dabs_description" && p.grapes.quote ? ` (“${p.grapes.quote}”)` : ""}`);
  if (p.region.value) push("Region", p.region, p.region.value);
  if (p.fizz.value && p.fizz.value !== "still") push("Style", p.fizz, p.fizz.value);
  if (p.sweetness.value) push("Sweetness", p.sweetness, p.sweetness.evidence === "product" && p.sweetness.source === "dabs_description" ? `${SWEET_WORDS[p.sweetness.value]} (“${p.sweetness.quote}”)` : p.sweetness.evidence === "style" ? `usually ${SWEET_WORDS[p.sweetness.value]}: ${p.sweetness.note}` : SWEET_WORDS[p.sweetness.value] + (p.sweetness.note ? ` (${p.sweetness.note})` : ""));
  else lines.push({ attribute: "Sweetness", text: "not stated by DABS, and no general rule for this style", kind: "unknown", sourceLabel: "Unknown" });
  if (p.body.value) push("Body", p.body, p.body.evidence === "product" && p.body.quote ? `${BODY_WORDS[p.body.value]} (“${p.body.quote}”)` : p.body.evidence === "style" ? `usually ${BODY_WORDS[p.body.value]}: ${p.body.note}` : BODY_WORDS[p.body.value]);
  for (const t of p.tags) push("Described as", t, t.evidence === "style" ? `usually ${t.value}: ${t.note}` : `${t.value}${t.quote ? ` (“${t.quote}”)` : ""}`);
  for (const c of contributions) {
    if (c.attribute === "novelty") lines.push({ attribute: "Less common", text: c.reason, kind: c.reason.startsWith("Utah Drops rating") ? "rating" : "catalog", sourceLabel: c.reason.startsWith("Utah Drops rating") ? "Utah Drops rating (beta)" : "Our count of DABS's in-stock catalog" });
  }
  return lines;
}

async function storeIdsNear(a: Area): Promise<number[]> {
  const rows = (await sql`
    select id from stores
    where lat is not null and 3959 * 2 * asin(least(1, sqrt(
      sin(radians(lat - ${a.lat}) / 2) ^ 2 +
      cos(radians(${a.lat})) * cos(radians(lat)) * sin(radians(lng - ${a.lng}) / 2) ^ 2
    ))) <= ${NEARBY_MILES}`) as unknown as { id: number }[];
  return rows.map((r) => r.id);
}
