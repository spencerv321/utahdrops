import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getHomeFeed, getNearby, getShortcutCounts, getWatchedSet } from "@/lib/queries";
import { getArea, getAreaOptions } from "@/lib/area-server";
import { NEARBY_MILES } from "@/lib/area";
import { getCurrentUser } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { SearchBox } from "@/components/search-box";
import { TasteGuide } from "@/components/taste-guide";
import type { Area } from "@/lib/area";
import { DropTicket } from "@/components/drop-ticket";
import { HomeFeed } from "@/components/home-feed";
import { Freshness } from "@/components/freshness";
import { SHORTCUTS, shortcutHref } from "@/lib/browse";
import { getAllDiscover } from "@/lib/discover";
import { mixPreview } from "@/lib/discover-rules";
import { DiscoverPreview } from "@/components/discover-preview";
import { WatchStatus } from "@/components/watch-status";
import { watchSummary } from "@/lib/watch-summary";
import { MAKERS, MAKERS_PATH } from "@/lib/makers";
import { BARS_PATH } from "@/lib/bars";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Tells search engines what the site is and how to search it (sitelinks search box).
const SITE_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_TAGLINE,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icon-512.png`,
    description: "An independent guide to Utah's state liquor stores. Not affiliated with Utah DABS.",
  },
];

const SEARCH_PARAMS = ["q", "category", "status", "instock", "sort", "page"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Search used to live at "/?q=…"; keep old links and bookmarks working.
  const params = await searchParams;
  if (SEARCH_PARAMS.some((k) => params[k] != null)) {
    const next = new URLSearchParams();
    for (const k of SEARCH_PARAMS) {
      const v = params[k];
      if (typeof v === "string") next.set(k, v);
    }
    redirect(`/search?${next.toString()}`);
  }

  const area = await getArea();
  const [user, fullFeed, counts, areas, discover] = await Promise.all([
    getCurrentUser(),
    getHomeFeed(10),
    getShortcutCounts(SHORTCUTS),
    getAreaOptions(),
    // The preview is optional: a failure here must never break the homepage.
    getAllDiscover(area?.lat ?? null, area?.lng ?? null).catch((err) => {
      console.error("[home] discover preview failed", err);
      return null;
    }),
  ]);
  const picks = discover ? mixPreview(discover, { hasArea: !!area }) : [];
  // With the preview showing, keep the page about as long as before.
  const feed = picks.length > 0 ? fullFeed.slice(0, 6) : fullFeed;
  const feedCscs = feed.map((e) => e.csc).filter((c): c is string => !!c);
  const [watched, optedIn, nearby, myWatches] = await Promise.all([
    getWatchedSet(user?.id, [...feedCscs, ...picks.map((p) => p.item.csc)]),
    user
      ? (sql`select allocated_email from alert_prefs where user_id = ${user.id}` as unknown as Promise<
          { allocated_email: boolean }[]
        >).then((r) => r[0]?.allocated_email ?? false)
      : Promise.resolve(false),
    area ? getNearby(feedCscs, area, NEARBY_MILES) : Promise.resolve(undefined),
    // The signed-in hero line: optional, so a failure falls back to the pitch.
    user
      ? (
          sql`select w.csc, p.in_stock from watchlist w join products p using (csc)
              where w.user_id = ${user.id}` as unknown as Promise<{ csc: string; in_stock: boolean }[]>
        )
          .then(async (rows) =>
            watchSummary(rows, area && rows.length > 0 ? await getNearby(rows.map((r) => r.csc), area, NEARBY_MILES) : undefined)
          )
          .catch((err) => {
            console.error("[home] watch summary failed", err);
            return null;
          })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-12 sm:space-y-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }} />
      {/* Phones: headline, search, browse, then the drop. Desktop: headline beside the drop, search full width under both. */}
      <section
        className="relative isolate grid grid-cols-1 gap-6 pt-3 sm:pt-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-6 lg:pt-12"
        aria-labelledby="hero-title"
      >
        {/* Park City's Main Street, toned to the espresso palette and faded into the page so text stays readable. */}
        <div aria-hidden className="pointer-events-none absolute -top-6 bottom-16 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden">
          <Image
            src="/hero-main-street.webp"
            alt=""
            fill
            preload
            quality={50}
            sizes="100vw"
            className="object-cover object-[center_40%] opacity-40 lg:opacity-55"
          />
          <div className="absolute inset-0 bg-linear-to-r from-background from-15% via-background/80 via-45% to-background/50" />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 via-50% to-background/40" />
        </div>
        <div className="space-y-3 lg:self-end">
          <h1 id="hero-title" className="text-[2.7rem] leading-[0.98] sm:text-6xl lg:text-7xl">
            Find the bottle.
            <br />
            <em className="text-primary">Then find the store.</em>
          </h1>
          {myWatches && myWatches.total > 0 ? (
            <WatchStatus summary={myWatches} area={area} />
          ) : (
            <p className="max-w-xl text-[17px] leading-relaxed text-muted-foreground">
              Stock and prices at every Utah state liquor store: spirits, wine and beer.
            </p>
          )}
          <Link prefetch={false} href="/utah-101" className="inline-flex min-h-9 items-center gap-1 text-[15px] text-foreground underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
            New to Utah? How alcohol works here
            <ArrowRight className="size-4 text-primary" aria-hidden />
          </Link>
        </div>
        <DropTicket signedIn={!!user} optedIn={optedIn} className="order-last lg:order-none lg:self-end" />
        <div className="space-y-3 lg:col-span-2">
          <SearchBox
            areas={areas}
            area={area}
            guide={<TasteGuide quiet label="Not sure? Pick a wine by taste" areas={guideAreas(areas, area)} initial={{ area: area?.label ?? null }} />}
          />
          <Freshness />
        </div>
        <nav aria-labelledby="browse-title" className="-mx-4 space-y-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:col-span-2">
          <p id="browse-title" className="kicker text-subtle-foreground">In stock statewide</p>
          <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {SHORTCUTS.map((s, i) => (
              <li key={s.label}>
                <Link
                  prefetch={false}
                  href={shortcutHref(s)}
                  className="group inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3.5 text-[15px] whitespace-nowrap hover:border-primary"
                >
                  <span className="font-medium">{s.label}</span>
                  <span className="text-sm text-subtle-foreground tabular-nums">{counts[i].toLocaleString()}</span>
                  <ArrowRight className="size-4 text-subtle-foreground group-hover:text-primary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {picks.length > 0 ? <DiscoverPreview picks={picks} area={area} watched={watched} signedIn={!!user} /> : null}

      <MoreUtah />

      <div className={user ? "max-w-3xl" : "grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14"}>
        <section className="space-y-4" aria-labelledby="feed-title">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <h2 id="feed-title" className="font-display text-[2rem] leading-none sm:text-4xl">
                Just happened
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Restocks, new listings and price drops from recent DABS updates.</p>
            </div>
            <div className="flex shrink-0 gap-4">
              <Link prefetch={false} href="/whats-new" className="flex min-h-11 items-center gap-1 text-sm text-foreground hover:text-primary">
                This week
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link prefetch={false} href="/whats-new?type=all" className="flex min-h-11 items-center gap-1 text-sm text-foreground hover:text-primary">
                All changes
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
          <HomeFeed events={feed} watched={watched} signedIn={!!user} area={area} nearby={nearby} />
        </section>

        {!user ? (
          <aside aria-label="Watchlist">
            <section className="space-y-2 border-t pt-5">
              <p className="font-display text-2xl leading-tight">Hunting one bottle?</p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Save it and we&apos;ll email you when it&apos;s back in stores, statewide or at your store. We check
                DABS several times a day.
              </p>
              <Link prefetch={false} href="/login?next=/watchlist" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-foreground underline decoration-primary underline-offset-4">
                Start a watchlist, no password
              </Link>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// Utah guides beyond the state-store shelf. Outlined cards only: the hero's
// "Find bottles" stays the one filled button.
const MORE_UTAH = [
  {
    href: MAKERS_PATH,
    title: "Utah makers",
    text: `${MAKERS.length} local breweries, distilleries, wineries and cideries, and their bottles in state stores.`,
  },
  { href: BARS_PATH, title: "Bars & taverns", text: "Every licensed bar, tavern and beer venue, and the rules each license sets." },
  { href: "/utah-101", title: "Utah 101", text: "How buying and drinking alcohol works here, in plain English." },
];

function MoreUtah() {
  return (
    <nav aria-labelledby="more-utah-title" className="space-y-3">
      <h2 id="more-utah-title" className="kicker text-subtle-foreground">
        More Utah
      </h2>
      <ul className="grid gap-2 sm:grid-cols-3">
        {MORE_UTAH.map((c) => (
          <li key={c.href}>
            <Link
              prefetch={false}
              href={c.href}
              className="group flex h-full flex-col gap-1 rounded-md border border-input px-4 py-3 hover:border-primary"
            >
              <span className="flex items-center gap-1.5 font-display text-2xl leading-none">
                {c.title}
                <ArrowRight className="size-4 text-subtle-foreground group-hover:text-primary" aria-hidden />
              </span>
              <span className="text-sm leading-snug text-muted-foreground">{c.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Area labels for the guided panel, with the visitor's own ("Near you") first. */
function guideAreas(areas: Area[], area: Area | null): string[] {
  const labels = areas.map((a) => a.label);
  return area && !labels.includes(area.label) ? [area.label, ...labels] : labels;
}
