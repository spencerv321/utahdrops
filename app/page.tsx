import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getHomeFeed, getShortcutCounts, getWatchedSet } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { SearchBox } from "@/components/search-box";
import { DropTicket } from "@/components/drop-ticket";
import { HomeFeed } from "@/components/home-feed";
import { Freshness } from "@/components/freshness";
import { SHORTCUTS, shortcutHref } from "@/lib/browse";

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

  const [user, feed, counts] = await Promise.all([
    getCurrentUser(),
    getHomeFeed(10),
    getShortcutCounts(SHORTCUTS),
  ]);
  const [watched, optedIn] = await Promise.all([
    getWatchedSet(user?.id, feed.map((e) => e.csc).filter((c): c is string => !!c)),
    user
      ? (sql`select allocated_email from alert_prefs where user_id = ${user.id}` as unknown as Promise<
          { allocated_email: boolean }[]
        >).then((r) => r[0]?.allocated_email ?? false)
      : Promise.resolve(false),
  ]);

  return (
    <div className="space-y-12 sm:space-y-16">
      <div className="grid grid-cols-1 gap-7 pt-3 sm:pt-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-14 lg:pt-12">
        <section className="space-y-5" aria-labelledby="hero-title">
          <div className="space-y-3">
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
          <SearchBox examples />
          <Freshness />
        </section>
        <DropTicket signedIn={!!user} optedIn={optedIn} />
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14">
        <section className="space-y-4" aria-labelledby="feed-title">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <h2 id="feed-title" className="font-display text-[2rem] leading-none sm:text-4xl">
                Just happened
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Restocks, new listings and price drops from recent DABS updates.</p>
            </div>
            <Link href="/whats-new" className="flex min-h-11 shrink-0 items-center gap-1 text-sm text-foreground hover:text-primary">
              All changes
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <HomeFeed events={feed} watched={watched} signedIn={!!user} />
        </section>

        <aside className="order-first space-y-8 lg:order-none" aria-labelledby="browse-title">
          <section className="space-y-3">
            <div>
              <h2 id="browse-title" className="font-display text-[2rem] leading-none sm:text-4xl">
                Start somewhere
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                No bottle in mind? A few plain starting points, all in stores now.
              </p>
            </div>
            <ul className="divide-y border-y">
              {SHORTCUTS.map((s, i) => (
                <li key={s.label}>
                  <Link href={shortcutHref(s)} className="group flex min-h-12 items-center gap-3 py-2.5">
                    <span className="flex-1 font-medium group-hover:underline group-hover:underline-offset-4">{s.label}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">{counts[i].toLocaleString()} in stock</span>
                    <ArrowRight className="size-4 text-subtle-foreground group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          {!user ? (
            <section className="space-y-2 border-t pt-5" aria-label="Watchlist">
              <p className="font-display text-2xl leading-tight">Hunting one bottle?</p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Save it and we&apos;ll email you when it&apos;s back in stores, statewide or at your store. We check
                DABS several times a day.
              </p>
              <Link href="/login?next=/watchlist" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-foreground underline decoration-primary underline-offset-4">
                Start a watchlist, no password
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
