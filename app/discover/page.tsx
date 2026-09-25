import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getAllDiscover, backCoverage } from "@/lib/discover";
import { DISCOVER, parseView, rankView, shortDay, VIEWS, type DiscoverView } from "@/lib/discover-rules";
import { getAreaOptions, getPageArea } from "@/lib/area-server";
import { NEARBY_MILES, nearLabel } from "@/lib/area";
import { getFreshness, getWatchedSet } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { whenLabel } from "@/lib/format";
import { AreaPicker } from "@/components/area-picker";
import { DiscoverRow } from "@/components/discover-results";
import { DiscoverUseful } from "@/components/discover-useful";
import { ShareButton } from "@/components/share-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = { view?: string; area?: string; near?: string; n?: string };

const DESCRIPTION =
  "Scarce bottles, returns after a long absence, and real price drops at Utah's state liquor stores, reported in stock now, with when each was checked.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  // One indexable page; area / nearby / "show more" variants point back to it.
  const variant = Boolean(sp.area || sp.near || sp.n);
  return {
    title: "Worth a look",
    description: DESCRIPTION,
    alternates: { canonical: "/discover" },
    ...(variant ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const view = parseView(sp.view);
  const [{ area, label }, areas, user, freshness] = await Promise.all([
    getPageArea(sp.area),
    getAreaOptions(),
    getCurrentUser(),
    getFreshness(),
  ]);
  const hasArea = !!area;
  const nearbyOnly = hasArea && sp.near === "1";
  const all = await getAllDiscover(area?.lat ?? null, area?.lng ?? null);
  const ranked = Object.fromEntries(
    VIEWS.map((v) => [v.key, rankView(all[v.key], v.key, { hasArea, nearbyOnly })])
  ) as Record<DiscoverView, ReturnType<typeof rankView>>;
  // "Back after a while" stays hidden until our history can confirm a return.
  const backAvailable = all.back.length > 0;
  const tabs = VIEWS.filter((v) => v.key !== "back" || backAvailable);
  const limit = Math.min(Math.max(Number(sp.n) || DISCOVER.pageSize, DISCOVER.pageSize), DISCOVER.maxResults);
  const results = ranked[view];
  const shown = results.slice(0, limit);
  const [watched, coverage] = await Promise.all([
    getWatchedSet(user?.id, shown.map((i) => i.csc)),
    backAvailable ? Promise.resolve(null) : backCoverage(),
  ]);
  const nearCount = hasArea ? ranked[view].filter((i) => i.near && i.near.stores > 0).length : 0;
  const statewideCount = rankView(all[view], view, { hasArea }).length;

  const href = (p: { view?: DiscoverView; near?: boolean; n?: number }) => {
    const q = new URLSearchParams();
    const v = p.view ?? view;
    if (v !== "scarce") q.set("view", v);
    if (label) q.set("area", label);
    if (p.near ?? nearbyOnly) q.set("near", "1");
    if (p.n && p.n > DISCOVER.pageSize) q.set("n", String(p.n));
    const qs = q.toString();
    return qs ? `/discover?${qs}` : "/discover";
  };
  const meta = VIEWS.find((v) => v.key === view)!;

  return (
    <div className="space-y-6 pt-2 sm:pt-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-5xl leading-none sm:text-6xl">Worth a look</h1>
          <p className="max-w-2xl text-muted-foreground">
            Bottles you might not have been searching for: hard to find, just back, or noticeably cheaper, and reported
            in stores now. Our rating is about how hard a bottle is to find, not how good it is.
          </p>
        </div>
        <ShareButton
          title="Worth a look on Utah Drops"
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
        />
      </header>

      <nav aria-label="Views" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t) => (
          <Link
            prefetch={false}
            key={t.key}
            href={href({ view: t.key, n: 0 })}
            aria-current={view === t.key ? "page" : undefined}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-sm transition-colors",
              view === t.key ? "border-primary bg-primary/12" : "border-border hover:border-input"
            )}
          >
            {t.label}
            <span className="text-subtle-foreground tabular-nums">{ranked[t.key].length}</span>
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AreaPicker
          areas={areas}
          current={area}
          urlParam="area"
          className="rounded-md border border-input bg-raised sm:w-64"
        />
        {hasArea ? (
          <Link
            prefetch={false}
            href={href({ near: !nearbyOnly, n: 0 })}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-md border px-4 text-[15px] transition-colors",
              nearbyOnly ? "border-primary bg-primary/12" : "border-input hover:border-primary"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                nearbyOnly ? "bg-primary" : "bg-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-background transition-all",
                  nearbyOnly ? "left-[18px]" : "left-0.5"
                )}
              />
            </span>
            Nearby only
            <span className="sr-only">{nearbyOnly ? " (on)" : " (off)"}</span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Pick an area to put bottles near you first.</p>
        )}
      </div>

      <div className="space-y-1 border-b pb-3 text-sm text-muted-foreground">
        <p>{meta.blurb}</p>
        <p className="text-subtle-foreground">
          {hasArea
            ? nearbyOnly
              ? `Only bottles reported at a store within ${NEARBY_MILES} miles in the last ${DISCOVER.nearbyMaxAgeHours} hours.`
              : results.length > 0
                ? `${nearCount} of ${results.length} reported ${nearLabel(area!)} in the last ${DISCOVER.nearbyMaxAgeHours} hours; the rest are statewide only.`
                : `Nearby means a store within ${NEARBY_MILES} miles, checked in the last ${DISCOVER.nearbyMaxAgeHours} hours.`
            : "Across Utah."}{" "}
          Statewide stock from DABS {whenLabel(freshness)}. Stock changes; confirm with the store before you go.
        </p>
      </div>

      {view === "back" && !backAvailable ? (
        <BackUnavailable since={coverage?.since ?? null} earliest={coverage?.earliest ?? null} href={href} />
      ) : shown.length === 0 ? (
        <Empty
          nearbyOnly={nearbyOnly}
          areaText={hasArea ? nearLabel(area!) : null}
          statewideCount={statewideCount}
          statewideHref={href({ near: false, n: 0 })}
          otherViews={tabs.filter((t) => t.key !== view).map((t) => ({ label: t.label, href: href({ view: t.key, n: 0 }) }))}
        />
      ) : (
        <>
          <ul className="divide-y">
            {shown.map((item) => (
              <DiscoverRow
                key={item.csc}
                item={item}
                view={view}
                surface="discover"
                area={area}
                watched={watched.has(item.csc)}
                signedIn={!!user}
              />
            ))}
          </ul>
          {results.length > shown.length ? (
            <Link
              prefetch={false}
              scroll={false}
              href={href({ n: limit + DISCOVER.pageSize })}
              className="inline-flex h-11 items-center gap-1 rounded-md border border-input px-4 text-sm hover:border-primary"
            >
              Show {Math.min(DISCOVER.pageSize, results.length - shown.length)} more
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </>
      )}

      <section aria-labelledby="how-title" className="space-y-4 border-t pt-6">
        <DiscoverUseful source={`discover:${view}`} />
        <details className="group max-w-3xl">
          <summary id="how-title" className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-medium">
            How bottles get on this page
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="space-y-3 pb-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              Every bottle here is reported in stores by DABS&apos;s statewide count from the last{" "}
              {DISCOVER.statewideMaxAgeHours} hours and sold at ordinary retail: special orders, bottles DABS releases
              by drawing, and unlisted products are left out. Allocated-drop lists and drawing quantities are never
              counted as bottles on shelves.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="text-foreground">Scarce bottles in stores:</span> our availability rating (beta) says
                Scarce, Rare or Unicorn, including hand-reviewed corrections. The rating is about how often a bottle is
                on shelves, not taste or value.
              </li>
              <li>
                <span className="text-foreground">Back after a while:</span> out of stock statewide for at least{" "}
                {DISCOVER.back.absenceDays} days while our checks were running (a gap in our checks doesn&apos;t
                count), and first seen back in the last {DISCOVER.back.returnedWithinDays} days.
                {coverage?.earliest
                  ? ` Not shown yet: our checks have run without a break only since ${shortDay(coverage.since!)}, so the first confirmed returns can appear around ${shortDay(coverage.earliest)}.`
                  : ""}
              </li>
              <li>
                <span className="text-foreground">Price drops:</span> DABS&apos;s price fell at least{" "}
                {Math.round(DISCOVER.price.minPct * 100)}% and ${DISCOVER.price.minDollars} from the price we saw one
                update earlier, in the last {DISCOVER.price.withinDays} days, and is still at the lower price. Same
                product code only; codes DABS reuses for different vintages are left out.
              </li>
              <li>
                <span className="text-foreground">Nearby:</span> a store within {NEARBY_MILES} miles of your area had it at our
                last successful store check, within the last {DISCOVER.nearbyMaxAgeHours} hours. Stores are checked in
                rotation, so many bottles have no recent nearby check; that&apos;s shown as not checked, not as none.
              </li>
            </ul>
            <p>Reported stock can sell out between checks. Always confirm with the store.</p>
          </div>
        </details>
      </section>
    </div>
  );
}

function Empty({
  nearbyOnly,
  areaText,
  statewideCount,
  statewideHref,
  otherViews,
}: {
  nearbyOnly: boolean;
  areaText: string | null;
  statewideCount: number;
  statewideHref: string;
  otherViews: { label: string; href: string }[];
}) {
  const link = "inline-flex min-h-11 items-center gap-1 text-[15px] font-medium underline decoration-primary underline-offset-4";
  return (
    <div className="space-y-3 border-b py-8">
      {nearbyOnly && areaText ? (
        <>
          <p className="font-display text-2xl leading-tight">Nothing confirmed {areaText} in the last 24 hours</p>
          <p className="max-w-prose text-[15px] text-muted-foreground">
            We check stores in rotation, so a bottle can be on a nearby shelf without a recent check.
            {statewideCount > 0 ? ` ${statewideCount} bottles in this list are reported statewide.` : ""}
          </p>
          <div className="flex flex-wrap gap-x-5">
            {statewideCount > 0 ? (
              <Link prefetch={false} href={statewideHref} className={link}>
                <MapPin className="size-4" aria-hidden /> See statewide results
              </Link>
            ) : null}
            <Link prefetch={false} href="/search" className={link}>
              Search for a bottle
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="font-display text-2xl leading-tight">Nothing qualifies right now</p>
          <p className="max-w-prose text-[15px] text-muted-foreground">
            We only list bottles with current evidence, so this list is sometimes short or empty.
          </p>
          <div className="flex flex-wrap gap-x-5">
            {otherViews.map((v) => (
              <Link key={v.href} prefetch={false} href={v.href} className={link}>
                {v.label}
              </Link>
            ))}
            <Link prefetch={false} href="/search" className={link}>
              Search for a bottle
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function BackUnavailable({
  since,
  earliest,
  href,
}: {
  since: Date | null;
  earliest: Date | null;
  href: (p: { view?: DiscoverView; n?: number }) => string;
}) {
  return (
    <div className="space-y-3 border-b py-8">
      <p className="font-display text-2xl leading-tight">Not enough history yet</p>
      <p className="max-w-prose text-[15px] text-muted-foreground">
        To say a bottle is back after {DISCOVER.back.absenceDays}+ days, we need to have watched it the whole time.
        {since
          ? ` Our statewide checks have run without a break since ${shortDay(since)}, so the first confirmed returns can show up around ${earliest ? shortDay(earliest) : "a month later"}.`
          : ""}
      </p>
      <Link
        prefetch={false}
        href={href({ view: "scarce", n: 0 })}
        className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium underline decoration-primary underline-offset-4"
      >
        See scarce bottles in stores
      </Link>
    </div>
  );
}
