import type { Metadata } from "next";
import Link from "next/link";
import { getEvents, getWatchedSet } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { HomeFeed } from "@/components/home-feed";
import { WeekSummary } from "@/components/week-summary";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What's new at Utah's liquor stores",
  description:
    "This week at Utah's state liquor stores: what's back on shelves, new listings, real price drops, newly allocated bottles and what sold out, plus every change DABS makes.",
  alternates: { canonical: "/whats-new" },
};

// "" is the weekly summary (it was /this-week); "all" is every change.
const TABS = [
  { key: "", label: "This week" },
  { key: "all", label: "Every change" },
  { key: "restock", label: "Back in stock" },
  { key: "new_product", label: "New" },
  { key: "price_change", label: "Price changes" },
  { key: "status_change", label: "Status changes" },
  { key: "out_of_stock", label: "Sold out" },
] as const;

export default async function WhatsNewPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; special?: string }>;
}) {
  const { type, special } = await searchParams;
  const active = TABS.find((t) => t.key === (type ?? ""))?.key ?? "";
  const withSpecial = special === "1";
  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key) p.set("type", key);
    if (withSpecial && key) p.set("special", "1");
    const q = p.toString();
    return q ? `/whats-new?${q}` : "/whats-new";
  };
  const user = await getCurrentUser();

  return (
    <div className="space-y-5">
      <section className="space-y-2 pt-2 sm:pt-6">
        <h1 className="text-5xl leading-none sm:text-6xl">What&apos;s new</h1>
        <p className="text-muted-foreground">
          What changed at Utah&apos;s state liquor stores: restocks, new listings, price moves and sell-outs.
        </p>
      </section>

      <nav aria-label="Filter" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((tab) => (
          <Link prefetch={false}
            key={tab.key}
            href={tabHref(tab.key)}
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

      {active === "" ? (
        <div className="pt-4">
          <WeekSummary user={user} />
        </div>
      ) : (
        <ChangeLog
          type={active}
          label={TABS.find((t) => t.key === active)!.label}
          withSpecial={withSpecial}
          userId={user?.id}
        />
      )}
    </div>
  );
}

async function ChangeLog({
  type,
  label,
  withSpecial,
  userId,
}: {
  type: string;
  label: string;
  withSpecial: boolean;
  userId?: string;
}) {
  const toggle = new URLSearchParams({ type });
  if (!withSpecial) toggle.set("special", "1");
  const events = await getEvents(type === "all" ? undefined : type, 100, withSpecial);
  const watched = await getWatchedSet(
    userId,
    events.map((e) => e.csc).filter((c): c is string => !!c)
  );

  return (
    <>
      {/* The feed's day labels are h3s. */}
      <h2 className="sr-only">{label}</h2>
      <p className="text-sm text-muted-foreground">
        {withSpecial
          ? "Showing special orders too. Those are usually a customer's order arriving and rarely stay on a shelf. "
          : "Special orders are hidden: they're usually a customer's order arriving, not shelf stock. "}
        <Link prefetch={false} href={`/whats-new?${toggle.toString()}`} className="underline underline-offset-2 hover:text-foreground">
          {withSpecial ? "Hide special orders" : "Show special orders"}
        </Link>
      </p>

      <HomeFeed
        events={events}
        watched={watched}
        signedIn={!!userId}
        empty="Nothing here yet. Changes show up once DABS updates its numbers."
      />
    </>
  );
}
