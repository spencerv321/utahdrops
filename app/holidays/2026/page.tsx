import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarX } from "lucide-react";
import { AreaPicker } from "@/components/area-picker";
import { DropTicket } from "@/components/drop-ticket";
import { HolidayRow } from "@/components/holiday-row";
import { HOLIDAY_GLOW, HolidayLights, HolidaySprig } from "@/components/holiday-sprig";
import { ShareButton } from "@/components/share-button";
import { GuideLink } from "@/components/utah-101";
import { NEARBY_MILES, nearLabel } from "@/lib/area";
import { getAreaOptions, getPageArea } from "@/lib/area-server";
import { getDrawings } from "@/lib/drawings";
import {
  GIFT_BANDS,
  GROUPS,
  HOLIDAY_PAGE_SIZE,
  HOLIDAY_SOURCES,
  inBand,
  parseBand,
  SEASONS,
  shortDate,
  utahToday,
  type HolidayGroup,
} from "@/lib/holiday";
import { getHolidayShelf } from "@/lib/holiday-query";
import { getFreshness, getWatchedSet } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { whenLabel } from "@/lib/format";
import { sql } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SEASON = SEASONS.find((s) => s.year === 2026)!;
const PATH = "/holidays/2026";

type SearchParams = { area?: string; all?: string; band?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const variant = Boolean(sp.area || sp.all || sp.band);
  return {
    title: "Holidays 2026",
    description:
      "Utah state liquor stores over the 2026 holidays: closure days, seasonal bottles and gift sets in stock, and the December allocated drop.",
    alternates: { canonical: PATH },
    ...(variant ? { robots: { index: false, follow: true } } : {}),
  };
}

// Sparkling for New Year's: DABS categories, in stock, through ordinary search.
const SPARKLING = [
  { label: "Champagne", category: "SPARKLING WINE - FRENCH & CHAMPAGNE" },
  { label: "Prosecco", category: "SPARKLING WINE - PROSECCO" },
  { label: "Cava", category: "SPARKLING WINE - SPANISH CAVA" },
  { label: "Domestic sparkling", category: "SPARKLING WINE - DOMESTIC" },
];
const searchHref = (category: string) => `/search?${new URLSearchParams({ instock: "1", category }).toString()}`;

export default async function Holidays2026({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [{ area, label }, areas, user, freshness, drawings] = await Promise.all([
    getPageArea(sp.area),
    getAreaOptions(),
    getCurrentUser(),
    getFreshness(),
    getDrawings().catch(() => []),
  ]);
  const shelf = await getHolidayShelf(area?.lat ?? null, area?.lng ?? null);
  const band = parseBand(sp.band);
  const lists = Object.fromEntries(
    GROUPS.map((g) => [g.key, g.key === "gift" && band ? shelf.gift.filter((i) => inBand(i.price, band)) : shelf[g.key]])
  ) as typeof shelf;
  const groups = GROUPS.filter((g) => shelf[g.key].length > 0);
  const shown = (g: HolidayGroup) => (sp.all === g ? lists[g] : lists[g].slice(0, HOLIDAY_PAGE_SIZE));
  const [watched, optedIn] = await Promise.all([
    getWatchedSet(user?.id, groups.flatMap((g) => shown(g.key).map((i) => i.csc))),
    user
      ? (sql`select allocated_email from alert_prefs where user_id = ${user.id}` as unknown as Promise<{ allocated_email: boolean }[]>).then(
          (r) => r[0]?.allocated_email ?? false
        )
      : Promise.resolve(false),
  ]);
  const openDrawings = drawings.filter((d) => d.section === "current");
  const today = utahToday();
  const href = (p: { all?: string; band?: string | null }) => {
    const q = new URLSearchParams();
    if (label) q.set("area", label);
    if (p.all) q.set("all", p.all);
    const b = p.band === undefined ? band : p.band;
    if (b) q.set("band", b);
    const qs = q.toString();
    return qs ? `${PATH}?${qs}` : PATH;
  };

  return (
    <div className="space-y-10 pt-2 sm:pt-6">
      <header
        className={cn(
          "relative isolate -mx-4 flex items-start justify-between gap-4 overflow-hidden px-4 pt-11 pb-4 sm:mx-0 sm:rounded-lg sm:px-6 sm:pt-12",
          HOLIDAY_GLOW
        )}
      >
        <HolidayLights className="absolute inset-x-0 top-0 -z-10" />
        <HolidaySprig width={130} className="absolute -top-2 right-10 -z-10 text-primary sm:hidden" />
        <HolidaySprig width={200} className="absolute -top-4 right-24 -z-10 hidden text-primary sm:block" />
        <div className="space-y-2">
          <p className="kicker text-primary">Utah state liquor stores</p>
          <h1 className="text-5xl leading-none sm:text-6xl">Holidays 2026</h1>
          <p className="max-w-2xl text-muted-foreground">
            When stores are closed, the seasonal bottles and gift sets on shelves now, and the December drop. Bottles here
            are chosen by what DABS lists, not by us.
          </p>
        </div>
        <ShareButton
          title="Holidays 2026 on Utah Drops"
          surface="holidays"
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
        />
      </header>

      <nav aria-label="On this page" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[
          { id: "closures", label: "Closed days" },
          ...groups.map((g) => ({ id: g.key, label: g.label })),
          { id: "drop", label: "December drop" },
          { id: "hosting", label: "Hosting & New Year's" },
        ].map((l) => (
          <a key={l.id} href={`#${l.id}`} className="inline-flex h-11 shrink-0 items-center rounded-md border border-border px-3.5 text-sm hover:border-input">
            {l.label}
          </a>
        ))}
      </nav>

      <section id="closures" aria-labelledby="closures-title" className="scroll-mt-20 space-y-3">
        <h2 id="closures-title" className="font-display text-[2rem] leading-none sm:text-4xl">
          Closed days
        </h2>
        <p className="max-w-2xl text-[15px] text-muted-foreground">
          State liquor stores close on Sundays and{" "}
          <a href={HOLIDAY_SOURCES.dabsClosures.url} className="underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
            state holidays
          </a>
          , and{" "}
          <a href={HOLIDAY_SOURCES.utahCode.url} className="underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
            Utah law
          </a>{" "}
          makes these three state holidays. Hours vary by store, so check yours before a late run.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {SEASON.closures.map((c) => {
            const past = c.date < today;
            return (
              <li key={c.date} className={cn("rounded-md border border-input px-4 py-3", past && "opacity-50")}>
                <p className="flex items-center gap-1.5 kicker text-subtle-foreground">
                  <CalendarX className="size-3.5" aria-hidden />
                  {c.holiday}
                </p>
                <p className="mt-1 font-display text-3xl leading-none">Closed {shortDate(c.date)}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {past ? "Passed." : <>Last day to buy before it: <span className="text-foreground">{shortDate(c.lastDay)}</span></>}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-subtle-foreground">
          Christmas and New Year&apos;s Day fall on Fridays, so stores open the Saturday after each, then close Sunday.
        </p>
      </section>

      <section aria-label="Seasonal bottles" className="space-y-10">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center">
          <AreaPicker areas={areas} current={area} urlParam="area" className="rounded-md border border-input bg-raised sm:w-64" />
          <p className="text-sm text-muted-foreground">
            {area
              ? `Bottles reported at a store ${nearLabel(area)} (within ${NEARBY_MILES} miles, checked in the last 24 hours) come first.`
              : "Pick an area to put bottles near you first."}{" "}
            Statewide stock from DABS {whenLabel(freshness)}.
          </p>
        </div>

        {groups.map((g) => {
          const list = lists[g.key];
          const rows = shown(g.key);
          return (
            <section key={g.key} id={g.key} aria-labelledby={`${g.key}-title`} className="scroll-mt-20 space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <h2 id={`${g.key}-title`} className="font-display text-[2rem] leading-none sm:text-4xl">
                    {g.label}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {g.blurb} <span className="text-subtle-foreground">{shelf[g.key].length} in stock statewide.</span>
                  </p>
                </div>
              </div>
              {g.key === "gift" ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link prefetch={false} scroll={false} href={`${href({ band: null })}#gift`} className={chip(!band)}>
                    Any price
                  </Link>
                  {GIFT_BANDS.map((b) => (
                    <Link prefetch={false} scroll={false} key={b.key} href={`${href({ band: b.key })}#gift`} className={chip(band === b.key)}>
                      {b.label}
                      <span className="text-subtle-foreground tabular-nums">{shelf.gift.filter((i) => inBand(i.price, b.key)).length}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {rows.length > 0 ? (
                <ul className="grid grid-cols-1 divide-y border-y md:grid-cols-2 md:gap-x-8">
                  {rows.map((item) => (
                    <HolidayRow key={item.csc} item={item} area={area} watched={watched.has(item.csc)} signedIn={!!user} />
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">None in this price range right now.</p>
              )}
              {list.length > rows.length ? (
                <Link
                  prefetch={false}
                  scroll={false}
                  href={`${href({ all: g.key })}#${g.key}`}
                  className="inline-flex h-11 items-center gap-1 rounded-md border border-input px-4 text-sm hover:border-primary"
                >
                  Show all {list.length}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </section>
          );
        })}
        <p className="text-sm text-subtle-foreground">
          Seasonal bottles come and go. Tap the star on one that&apos;s sold out and we&apos;ll email you if it comes back.
        </p>
      </section>

      <section id="drop" aria-labelledby="drop-title" className="scroll-mt-20 space-y-3">
        <h2 id="drop-title" className="font-display text-[2rem] leading-none sm:text-4xl">
          The December drop
        </h2>
        <p className="max-w-2xl text-[15px] text-muted-foreground">
          DABS releases allocated bottles on the third Saturday of each month; in December that&apos;s the Saturday before
          Christmas. The list posts about a week ahead.
        </p>
        <DropTicket signedIn={!!user} optedIn={optedIn} size="large" className="max-w-2xl" />
        {openDrawings.length > 0 ? (
          <Link prefetch={false} href="/drawings" className="inline-flex min-h-11 items-center gap-1 text-[15px] underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
            {openDrawings.length === 1 ? "A rare-bottle drawing is open" : `${openDrawings.length} rare-bottle drawings are open`}: see the odds
            <ArrowRight className="size-4 text-primary" aria-hidden />
          </Link>
        ) : null}
      </section>

      <section id="hosting" aria-labelledby="hosting-title" className="scroll-mt-20 space-y-3">
        <h2 id="hosting-title" className="font-display text-[2rem] leading-none sm:text-4xl">
          Hosting &amp; New Year&apos;s
        </h2>
        <div className="flex flex-wrap gap-2">
          {SPARKLING.map((s) => (
            <Link prefetch={false} key={s.category} href={searchHref(s.category)} className={chip(false)}>
              {s.label}
              <ArrowRight className="size-4 text-subtle-foreground" aria-hidden />
            </Link>
          ))}
        </div>
        <ul className="max-w-2xl list-disc space-y-1.5 pl-5 text-[15px] text-muted-foreground">
          <li>
            Throwing a party at home? <GuideLink slug="hosting-and-events">Hosting &amp; events</GuideLink> covers private
            parties, kegs and when you need a permit.
          </li>
          <li>
            Standard drinks and serving guests safely: <GuideLink slug="new-to-drinking">New to drinking</GuideLink>.
          </li>
          <li>
            Gifts from here: <Link prefetch={false} href="/makers" className="underline decoration-primary/60 underline-offset-4 hover:decoration-primary">Utah makers</Link> and their bottles in state stores.
          </li>
        </ul>
      </section>
    </div>
  );
}

function chip(active: boolean) {
  return cn(
    "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-sm transition-colors",
    active ? "border-primary bg-primary/12" : "border-border hover:border-input"
  );
}
