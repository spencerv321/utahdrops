import type { Metadata } from "next";
import Link from "next/link";
import { getEvents, getWatchedSet } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { HomeFeed } from "@/components/home-feed";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What's new",
  description:
    "New products, restocks, clearance flags, and price changes across Utah's state liquor system.",
};

const TABS = [
  { key: "", label: "Everything" },
  { key: "restock", label: "Back in stock" },
  { key: "new_product", label: "New" },
  { key: "price_change", label: "Price changes" },
  { key: "status_change", label: "Status changes" },
  { key: "out_of_stock", label: "Sold out" },
] as const;

export default async function WhatsNewPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const active = TABS.find((t) => t.key === (type ?? ""))?.key ?? "";
  const supabase = await createClient();
  const [events, { data: { user } }] = await Promise.all([
    getEvents(active || undefined),
    supabase.auth.getUser(),
  ]);
  const watched = await getWatchedSet(
    user?.id,
    events.map((e) => e.csc).filter((c): c is string => !!c)
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2 pt-2 sm:pt-6">
        <h1 className="text-5xl leading-none sm:text-6xl">What&apos;s new</h1>
        <p className="text-muted-foreground">
          Every change we spot between DABS updates: restocks, new listings, price moves and sell-outs.
        </p>
      </section>

      <nav aria-label="Filter" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key ? `/whats-new?type=${tab.key}` : "/whats-new"}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-md border px-3.5 text-sm transition-colors",
              active === tab.key ? "border-primary bg-primary/12" : "border-border hover:border-input"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <HomeFeed
        events={events}
        watched={watched}
        signedIn={!!user}
        empty="Nothing here yet. Changes show up once DABS updates its numbers."
      />
    </div>
  );
}
