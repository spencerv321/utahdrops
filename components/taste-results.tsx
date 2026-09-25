import Link from "next/link";
import { headers } from "next/headers";
import { ChevronRight, MapPin, Sparkles, X } from "lucide-react";
import type { Area } from "@/lib/area";
import { checkedAgo, formatPrice, formatQty, productTitle, sizeLabel, unitWord, whenLabel } from "@/lib/format";
import { clientIp, withinLimit } from "@/lib/rate-limit";
import { getWatchedSet } from "@/lib/queries";
import { interpretWithModel, mergeModel, shouldInterpret } from "@/lib/taste/interpret";
import type { TypedParse } from "@/lib/taste/parse";
import { recommend, RECO_STORE_MAX_AGE_HOURS, type Recommendation, type TasteOutcome } from "@/lib/taste/recommend";
import { requestHref, resolveRequest, type TasteRequest } from "@/lib/taste/request";
import { chips, clarification, followUps, relaxOptions, type Chip } from "@/lib/taste/view";
import { TIERS } from "@/components/rarity-card";
import { TasteFeedback, TasteLink, TasteShown } from "@/components/taste-track";
import { TasteGuide } from "@/components/taste-guide";
import { WatchStar } from "@/components/watch-star";
import { cn } from "@/lib/utils";

type Params = Record<string, string | string[] | undefined>;
type Mode = "typed" | "guided" | "followup";

/** Same budget as AI search: each model call is a paid request. */
const PER_IP_LIMIT = 20;
const DAILY_LIMIT = Number(process.env.NL_DAILY_LIMIT ?? 3000);

/**
 * Taste-ranked wine picks for a descriptive search or the "Help me choose"
 * panel, above the ordinary results. Streams in its own Suspense boundary so
 * name search never waits on it.
 */
export async function TasteResults({
  q,
  typed,
  params,
  pickerArea,
  areas,
  userId,
  catalogAsOf,
}: {
  q: string;
  typed: TypedParse | null;
  params: Params;
  pickerArea: Area | null;
  areas: Area[];
  userId: string | undefined;
  catalogAsOf: Date | null;
}) {
  const via = typeof params.via === "string" ? params.via : "";
  const mode: Mode = via === "guided" ? "guided" : via === "followup" ? "followup" : "typed";

  // The model only reads words the rules couldn't, within the AI-search budget.
  let reading = typed;
  let modelNote: "used" | "failed" | "limited" | null = null;
  if (typed && q && shouldInterpret(typed)) {
    const ip = clientIp(await headers());
    const allowed = (await withinLimit(`nl:ip:${ip}`, PER_IP_LIMIT, 600)) && (await withinLimit("nl:day", DAILY_LIMIT, 86400));
    if (allowed) {
      const add = await interpretWithModel(q, typed);
      reading = mergeModel(typed, add);
      modelNote = add ? "used" : "failed";
    } else modelNote = "limited";
  }

  const resolved = resolveRequest(reading, params, pickerArea?.label ?? null);
  // "Defaults" = what the typed words and area setting give without URL edits,
  // so follow-up links only write what changed.
  const defaults = resolveRequest(reading, {}, pickerArea?.label ?? null).request;
  const req = resolved.request;
  const area = resolveArea(req.area, pickerArea, areas);
  const areaLabel = area?.label ?? null;
  const base = Object.fromEntries(Object.entries(params).filter(([k]) => !["via", "page"].includes(k)));
  const effective: TasteRequest = { ...req, area: area ? req.area : null };

  let outcome: TasteOutcome | null = null;
  try {
    outcome = await recommend(effective, area, catalogAsOf);
  } catch (err) {
    console.error("[taste] recommend failed:", err instanceof Error ? err.message : err);
  }

  const view = chips(resolved, defaults, base, areaLabel);
  const ask = clarification(resolved, defaults, base, !!area || req.area !== "me");
  const logged = { ...effective, area: areaLabel ? "set" : null, grape: req.grape ? "set" : null };

  if (!outcome) {
    // Keep the request visible and fall back plainly; never pass ordinary
    // matches off as taste picks.
    return (
      <section aria-labelledby="taste-title" className="space-y-3 rounded-lg bg-card p-4 sm:p-5">
        <Heading />
        <ChipRows hard={view.hard} prefs={view.prefs} />
        <p className="text-[15px] text-muted-foreground">
          Taste matching isn&apos;t available right now. The list below is ordinary search results for your words, not
          ranked by taste.
        </p>
      </section>
    );
  }

  const watched = await getWatchedSet(userId, outcome.results.map((r) => r.csc));
  const areaOptions = areas.map((a) => a.label);
  if (pickerArea && !areaOptions.includes(pickerArea.label)) areaOptions.unshift(pickerArea.label);
  const more = followUps(effective, defaults, base, outcome);
  const relax = relaxOptions(effective, defaults, base, outcome, areaLabel);

  return (
    <section aria-labelledby="taste-title" className="space-y-4 rounded-lg bg-card p-4 sm:p-5">
      <TasteShown mode={mode} request={logged} results={outcome.results.length} />
      <Heading />
      <ChipRows hard={view.hard} prefs={view.prefs} />
      {resolved.unused.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Not used: {resolved.unused.map((w) => `“${w}”`).join(", ")}
          {modelNote === "failed" || modelNote === "limited" ? " (the AI reading step isn't available right now)" : ""}.
        </p>
      ) : null}

      {ask ? (
        <div className="space-y-2 border-l-2 border-primary pl-3" role="group" aria-label="Clarify">
          <p className="text-[15px]">{ask.question}</p>
          {ask.kind === "area" ? (
            <AreaForm areas={areaOptions} base={base} req={req} defaults={defaults} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {ask.options.map((o) => (
                <Link
                  prefetch={false}
                  key={o.label}
                  href={o.href}
                  aria-current={o.current ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-md border px-3 text-sm hover:border-primary",
                    o.current ? "border-primary bg-primary/12" : "border-input"
                  )}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {outcome.results.length === 0 ? (
        <Empty outcome={outcome} areaLabel={areaLabel} relax={relax} scarce={effective.novelty === "scarce"} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {outcome.results.length === 1 ? "1 wine fits" : `${outcome.results.length} wines fit`}
            {outcome.results.length < 6 ? " (only the ones with real support for what you asked)" : ""}.{" "}
            {areaLabel
              ? `Each is on a shelf ${areaLabel === "Near you" ? "near you" : `near ${areaLabel}`}, checked in the last ${RECO_STORE_MAX_AGE_HOURS} hours.`
              : "In stock statewide; pick an area to see what's near you."}
          </p>
          <ol className="divide-y border-y">
            {outcome.results.map((r, i) => (
              <Card
                key={r.csc}
                r={r}
                rank={i}
                mode={mode}
                areaLabel={areaLabel}
                watched={watched.has(r.csc)}
                signedIn={!!userId}
              />
            ))}
          </ol>
          {areaLabel && outcome.unknownNear > 0 ? (
            <p className="text-sm text-muted-foreground">
              {outcome.unknownNear} more {outcome.unknownNear === 1 ? "wine fits" : "wines fit"} your budget but
              {outcome.unknownNear === 1 ? " hasn't" : " haven't"} been checked store by store near {areaLabel} in the
              last {RECO_STORE_MAX_AGE_HOURS} hours, so {outcome.unknownNear === 1 ? "it isn't" : "they aren't"} listed.
            </p>
          ) : null}
        </>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Adjust</p>
        <div className="flex flex-wrap gap-2">
          {more.map((f) =>
            f.href ? (
              <Link
                prefetch={false}
                key={f.key}
                href={f.href}
                className="inline-flex min-h-10 items-center rounded-md border border-input px-3 text-sm hover:border-primary"
              >
                {f.label}
              </Link>
            ) : (
              <span
                key={f.key}
                title={f.note}
                className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-subtle-foreground"
              >
                {f.label}
                <span className="sr-only"> ({f.note})</span>
              </span>
            )
          )}
          <details className="group">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-md border border-input px-3 text-sm hover:border-primary">
              Change area
            </summary>
            <div className="mt-2">
              <AreaForm areas={areaOptions} base={base} req={req} defaults={defaults} current={areaLabel} />
            </div>
          </details>
        </div>
        <TasteGuide areas={areaOptions} initial={{ ...req, area: areaLabel }} q={q || undefined} label="Edit all preferences" />
      </div>

      <div className="space-y-2 border-t pt-3">
        <TasteFeedback mode={mode} request={logged} />
        <p className="text-xs leading-relaxed text-subtle-foreground">
          Beta: covers {outcome.pilotSize} everyday wines. Reasons quote DABS&apos;s listing text, or say when they&apos;re
          general style notes. We don&apos;t taste or score wines. Prices and stock are re-read from our latest DABS
          data every time.
        </p>
      </div>
    </section>
  );
}

function Heading() {
  return (
    <h2 id="taste-title" className="flex items-center gap-2 text-[15px] font-medium">
      <Sparkles className="size-4 text-primary" aria-hidden />
      Wine picks for what you described
      <span className="rounded-sm bg-raised px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Beta
      </span>
    </h2>
  );
}

function ChipRows({ hard, prefs }: { hard: Chip[]; prefs: Chip[] }) {
  const row = (title: string, items: Chip[]) =>
    items.length ? (
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="mr-0.5 text-muted-foreground">{title}</span>
        {items.map((c) => (
          <Link
            prefetch={false}
            key={c.key}
            href={c.removeHref}
            aria-label={`Remove: ${c.label}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-md bg-raised px-2.5 hover:bg-background"
          >
            {c.label}
            {c.from ? <span className="text-xs text-subtle-foreground">{c.from}</span> : null}
            <X className="size-3.5 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    ) : null;
  return (
    <div className="space-y-1.5">
      {row("Only showing", hard)}
      {row("Ranked by", prefs)}
    </div>
  );
}

function Card({
  r,
  rank,
  mode,
  areaLabel,
  watched,
  signedIn,
}: {
  r: Recommendation;
  rank: number;
  mode: Mode;
  areaLabel: string | null;
  watched: boolean;
  signedIn: boolean;
}) {
  const title = productTitle(r.name, r.sizeMl);
  const tier = r.showRarity && r.rarityTier ? TIERS[r.rarityTier] : null;
  return (
    <li className="space-y-1.5 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <TasteLink href={`/product/${r.csc}`} csc={r.csc} rank={rank} mode={mode} className="min-w-0 text-[16px] font-medium hover:underline hover:underline-offset-4">
          {title}
          {r.sizeMl ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">{sizeLabel(r.sizeMl)}</span> : null}
        </TasteLink>
        <span className="shrink-0 text-[16px] font-medium tabular-nums">{formatPrice(r.price)}</span>
      </div>
      <p className="text-[15px] leading-snug">{r.reason}</p>
      {r.unknowns.length ? (
        <p className="text-[13px] text-subtle-foreground">
          {r.unknowns.map((u) => (u === "sweetness" ? "Sweetness" : "Body")).join(" and ")} not stated for this one.
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        {r.near ? (
          <span className="inline-flex items-center gap-1 font-medium">
            <MapPin className="size-3.5" aria-hidden />
            {r.near.stores} {r.near.stores === 1 ? "store" : "stores"} {areaLabel === "Near you" ? "near you" : `near ${areaLabel}`} ·{" "}
            {formatQty(r.near.units)} {unitWord(r.category, r.sizeMl, r.near.units)}
            <span className="font-normal text-subtle-foreground">· checked {checkedAgo(r.near.checkedAt)}</span>
          </span>
        ) : (
          <span className="text-success">
            In stores · {formatQty(r.statewide.units)} {unitWord(r.category, r.sizeMl, r.statewide.units ?? 0)} statewide
            <span className="text-subtle-foreground"> · DABS {whenLabel(r.statewide.asOf)}</span>
          </span>
        )}
        {tier ? <span className={cn("rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase", tier.className)}>{tier.name}</span> : null}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <TasteLink href={`/product/${r.csc}`} csc={r.csc} rank={rank} mode={mode} className="inline-flex min-h-10 items-center gap-0.5 text-sm font-medium underline decoration-primary underline-offset-4">
          View bottle
        </TasteLink>
        <TasteLink href={`/product/${r.csc}#where-title`} csc={r.csc} rank={rank} mode={mode} className="inline-flex min-h-10 items-center text-sm underline decoration-border underline-offset-4 hover:decoration-primary">
          See stores
        </TasteLink>
        <WatchStar csc={r.csc} name={title} initialWatched={watched} signedIn={signedIn} source={`taste:${mode}`} label className="h-10" />
        <details className="group w-full">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            Why this match
          </summary>
          <dl className="mt-1 space-y-1.5 border-l pl-3 text-[13px]">
            {r.evidence.map((e, i) => (
              <div key={i}>
                <dt className="inline font-medium">{e.attribute}: </dt>
                <dd className="inline">{e.text}</dd>
                <span className="block text-subtle-foreground">{e.sourceLabel}</span>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </li>
  );
}

function Empty({
  outcome,
  areaLabel,
  relax,
  scarce,
}: {
  outcome: TasteOutcome;
  areaLabel: string | null;
  relax: { label: string; href: string }[];
  scarce: boolean;
}) {
  const lines: string[] = [];
  if (scarce && outcome.eligible > 0) {
    // Only the published Utah Drops rating can say "harder to find"; no rating, no claim.
    lines.push("None of these wines has a published Utah Drops rating above Everyday, so we can't honestly call any of them harder to find.");
  }
  if (outcome.eligible === 0 && areaLabel) {
    lines.push(
      outcome.unknownNear + outcome.notNear > 0
        ? `None of the matching pilot wines is on a shelf near ${areaLabel} in our checks from the last ${RECO_STORE_MAX_AGE_HOURS} hours` +
            (outcome.unknownNear ? ` (${outcome.unknownNear} ${outcome.unknownNear === 1 ? "hasn't" : "haven't"} been checked there recently).` : ".")
        : `No pilot wine matches your kind of wine and budget.`
    );
  } else if (outcome.eligible === 0) {
    lines.push("No pilot wine matches your kind of wine and budget.");
  } else if (!scarce) {
    lines.push(
      `${outcome.eligible} ${outcome.eligible === 1 ? "wine matches" : "wines match"} your kind of wine, budget and area, but none has support for the taste you asked for` +
        (outcome.noInfo ? ` (DABS says nothing about that for ${outcome.noInfo} of them).` : ".")
    );
  }
  return (
    <div className="space-y-3 border-y py-5">
      <p className="font-display text-2xl leading-tight">Nothing fits all of that yet.</p>
      {lines.map((l) => (
        <p key={l} className="text-[15px] text-muted-foreground">
          {l}
        </p>
      ))}
      {relax.length ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">You could:</p>
          <ul className="flex flex-wrap gap-2">
            {relax.map((o) => (
              <li key={o.label}>
                <Link prefetch={false} href={o.href} className="inline-flex min-h-10 items-center rounded-md border border-input px-3 text-sm hover:border-primary">
                  {o.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** A small GET form that changes only the area of the current request. */
function AreaForm({
  areas,
  base,
  req,
  defaults,
  current = null,
}: {
  areas: string[];
  base: Params;
  req: TasteRequest;
  defaults: TasteRequest;
  current?: string | null;
}) {
  // Every other part of the request rides along as hidden fields.
  const href = requestHref(base, { ...req, area: null }, defaults, { via: "followup" });
  const hidden = [...new URLSearchParams(href.split("?")[1] ?? "").entries()].filter(([k]) => k !== "area");
  return (
    <form action="/search" className="flex flex-wrap items-center gap-2">
      {hidden.map(([k, v]) => (
        <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
      ))}
      <label className="sr-only" htmlFor="taste-area">
        Area
      </label>
      <select
        id="taste-area"
        name="area"
        defaultValue={current && areas.includes(current) ? current : "any"}
        className="h-10 rounded-md border border-input bg-raised px-3 text-[15px]"
      >
        <option value="any">All of Utah</option>
        {areas.map((a) => (
          <option key={a} value={a}>
            Near {a}
          </option>
        ))}
      </select>
      <button type="submit" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Update
      </button>
    </form>
  );
}

/** An area label (or "me") to coordinates: picker list first, then the visitor's own area. */
export function resolveArea(label: string | null, pickerArea: Area | null, areas: Area[]): Area | null {
  if (!label) return null;
  if (label === "me") return pickerArea;
  if (pickerArea && pickerArea.label.toLowerCase() === label.toLowerCase()) return pickerArea;
  return areas.find((a) => a.label.toLowerCase() === label.toLowerCase()) ?? null;
}

