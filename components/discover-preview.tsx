import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DiscoverRow } from "@/components/discover-results";
import type { Area } from "@/lib/area";
import type { DiscoverItem, DiscoverView } from "@/lib/discover-rules";

/**
 * Homepage entry to /discover: up to three different bottles, each with the
 * reason it qualifies. The caller omits it when nothing qualifies.
 */
export function DiscoverPreview({
  picks,
  area,
  watched,
  signedIn,
}: {
  picks: { view: DiscoverView; item: DiscoverItem }[];
  area: Area | null;
  watched: Set<string>;
  signedIn: boolean;
}) {
  return (
    <section className="space-y-3" aria-labelledby="discover-title">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="discover-title" className="font-display text-[2rem] leading-none sm:text-4xl">
            Worth a look
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Hard to find, back after a while, or cheaper, and reported in stores now.
          </p>
        </div>
        <Link prefetch={false} href="/discover" className="flex min-h-11 shrink-0 items-center gap-1 text-sm text-foreground hover:text-primary">
          See all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-1 divide-y border-y md:grid-cols-3 md:gap-x-8 md:divide-y-0">
        {picks.map(({ view, item }) => (
          <DiscoverRow
            key={item.csc}
            item={item}
            view={view}
            surface="home"
            area={area}
            watched={watched.has(item.csc)}
            signedIn={signedIn}
            compact
          />
        ))}
      </ul>
    </section>
  );
}
