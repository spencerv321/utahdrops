import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Star } from "lucide-react";
import { getFreshness, getHomeFeed, getWatchedSet } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { SearchBox } from "@/components/search-box";
import { DropCountdown } from "@/components/drop-countdown";
import { HomeFeed } from "@/components/home-feed";
import { formatAsOf } from "@/lib/format";

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

  const supabase = await createClient();
  const [{ data: { user } }, feed, freshness] = await Promise.all([
    supabase.auth.getUser(),
    getHomeFeed(),
    getFreshness(),
  ]);
  const watched = await getWatchedSet(
    user?.id,
    feed.map((e) => e.csc).filter((c): c is string => !!c)
  );

  return (
    <div className="space-y-10">
      <div className="grid gap-6 pt-2 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-12 lg:pt-8">
        <section className="space-y-4">
          <h1 className="text-[34px] leading-none sm:text-6xl sm:leading-[0.98]">
            Find any bottle in Utah&apos;s state stores.
          </h1>
          <p className="text-[17px] text-muted-foreground sm:text-xl">
            Get alerted when it&apos;s back. Never miss a drop.
          </p>
          <SearchBox examples className="pt-1" />
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            Stock and prices as of {formatAsOf(freshness)} MT · not affiliated with DABS
          </p>
        </section>
        <aside className="space-y-4">
          <DropCountdown size="large" />
          {!user ? (
            <div className="hidden space-y-2 rounded-3xl border bg-card p-5 lg:block">
              <WatchPitch />
            </div>
          ) : null}
        </aside>
      </div>

      <section className="space-y-3" aria-labelledby="feed-title">
        <div className="flex items-baseline justify-between">
          <h2 id="feed-title" className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
            Just happened
          </h2>
          <Link href="/whats-new" className="flex items-center text-sm font-bold text-primary">
            See everything
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <HomeFeed events={feed} watched={watched} signedIn={!!user} />
      </section>

      {!user ? (
        <div className="space-y-2 rounded-3xl border bg-card p-5 lg:hidden">
          <WatchPitch />
        </div>
      ) : null}
    </div>
  );
}

function WatchPitch() {
  return (
    <>
      <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Chasing a bottle?</p>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Tap the <Star className="inline size-4 align-[-0.15em] text-primary" aria-label="star" /> on
        anything. We check stock several times a day and email you when it&apos;s back, statewide
        or at your store.
      </p>
      <Link href="/login" className="inline-block text-[15px] font-bold text-primary">
        Start a watchlist (no password)
      </Link>
    </>
  );
}
