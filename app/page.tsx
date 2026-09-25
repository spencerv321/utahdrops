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

export const dynamic = "force-dynamic";

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
  const [watched, optedIn, nearby] = await Promise.all([
    getWatchedSet(user?.id, [...feedCscs, ...picks.map((p) => p.item.csc)]),
    user
      ? (sql`select allocated_email from alert_prefs where user_id = ${user.id}` as unknown as Promise<
          { allocated_email: boolean }[]
        >).then((r) => r[0]?.allocated_email ?? false)
      : Promise.resolve(false),
    area ? getNearby(feedCscs, area, NEARBY_MILES) : Promise.resolve(undefined),
  ]);

  return (
    <div className="space-y-12 sm:space-y-16">
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
            priority
            sizes="100vw"
            className="object-cover object-[center_40%] opacity-40 lg:opacity-70"
          />
          <div className="absolute inset-0 bg-linear-to-r from-background from-15% via-background/80 via-45% to-background/10" />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 via-50% to-background/40" />
        </div>
        <div className="space-y-3 lg:self-end">
          <h1 id="hero-title" className="text-[2.7rem] leading-[0.98] sm:text-6xl lg:text-7xl">
            Find the bottle.
            <br />
            <em className="text-primary">Then find the store.</em>
          </h1>
          <p className="max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            Stock and prices at every Utah state liquor store: spirits, wine and beer. Save a bottle and
            we&apos;ll email you when it&apos;s back.
          </p>
        </div>
        <DropTicket signedIn={!!user} optedIn={optedIn} className="order-last lg:order-none lg:self-end" />
        <div className="space-y-3 lg:col-span-2">
          <SearchBox
            examples
            areas={areas}
            area={area}
            guide={<TasteGuide areas={guideAreas(areas, area)} initial={{ area: area?.label ?? null }} />}
          />
          <Freshness />
        </div>
        <nav aria-label="Browse quickly" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:col-span-2">
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

      <div className={user ? "max-w-3xl" : "grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14"}>
        <section className="space-y-4" aria-labelledby="feed-title">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <h2 id="feed-title" className="font-display text-[2rem] leading-none sm:text-4xl">
                Just happened
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Restocks, new listings and price drops from recent DABS updates.</p>
            </div>
            <Link prefetch={false} href="/whats-new" className="flex min-h-11 shrink-0 items-center gap-1 text-sm text-foreground hover:text-primary">
              All changes
              <ArrowRight className="size-4" aria-hidden />
            </Link>
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

/** Area labels for the guided panel, with the visitor's own ("Near you") first. */
function guideAreas(areas: Area[], area: Area | null): string[] {
  const labels = areas.map((a) => a.label);
  return area && !labels.includes(area.label) ? [area.label, ...labels] : labels;
}
