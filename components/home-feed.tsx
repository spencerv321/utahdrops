import Link from "next/link";
import { WatchStar } from "@/components/watch-star";
import { BottleGlyph } from "@/components/bottle-glyph";
import {
  categoryLabel,
  dayKey,
  dayLabel,
  formatPrice,
  formatQty,
  productKind,
  productTitle,
  sizeLabel,
  unitWord,
} from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** What changed, as a short colored label (always words, never color alone). */
function change(e: FeedEvent): { label: string; tone: string } {
  const d = e.detail;
  switch (e.event_type) {
    case "restock":
      return { label: "Back in stores", tone: "text-success" };
    case "new_product":
      return { label: "New listing", tone: "text-fresh" };
    case "price_change":
      return Number(d.new) < Number(d.old)
        ? { label: `Price drop from ${formatPrice(d.old as number)}`, tone: "text-price-drop" }
        : { label: `Price up from ${formatPrice(d.old as number)}`, tone: "text-muted-foreground" };
    case "status_change":
      if (d.new === "D") return { label: "Clearance: being discontinued", tone: "text-clearance" };
      if (d.new === "A") return { label: "Now allocated", tone: "text-fresh" };
      if (d.new === "L") return { label: "Now limited", tone: "text-fresh" };
      return { label: "Listing changed", tone: "text-muted-foreground" };
    case "out_of_stock":
      return { label: "Sold out statewide", tone: "text-muted-foreground" };
    case "allocated_drop":
      return { label: "Allocated list posted", tone: "text-primary" };
    default:
      return { label: e.event_type, tone: "text-muted-foreground" };
  }
}

function availability(e: FeedEvent): string {
  if (!e.csc) return `${String(e.detail.count ?? "")} bottles on this month's list`;
  // Present tense, so a past event ("sold out") never reads as a contradiction.
  if (!e.in_stock || !e.store_qty) return "none in stores now";
  return `${formatQty(e.store_qty)} ${unitWord(e.category, e.size_ml, e.store_qty)} in stores now`;
}

/**
 * Activity as compact rows grouped by day: the bottle, what changed, price,
 * how many are in stores, and a watch star. One heading per day instead of a
 * timestamp and badge on every item.
 */
export function HomeFeed({
  events,
  watched,
  signedIn,
  empty = "Quiet stretch. Restocks, new listings and price drops show up here after each DABS update.",
}: {
  events: FeedEvent[];
  watched: Set<string>;
  signedIn: boolean;
  empty?: string;
}) {
  if (events.length === 0) {
    return <p className="border-y py-8 text-center text-muted-foreground">{empty}</p>;
  }

  const days: { key: string; label: string; items: FeedEvent[] }[] = [];
  for (const e of events) {
    const key = dayKey(new Date(e.created_at));
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(e);
    else days.push({ key, label: dayLabel(e.created_at), items: [e] });
  }

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h3 className="kicker border-b pb-2 text-subtle-foreground">{day.label}</h3>
          <ul className="divide-y">
            {day.items.map((e) => {
              const name = e.csc ? productTitle(e.name ?? e.csc, e.size_ml) : "This month's allocated list";
              const c = change(e);
              const meta = [sizeLabel(e.size_ml), categoryLabel(e.category)].filter(Boolean).join(" · ");
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <Link
                    href={e.csc ? `/product/${e.csc}` : "/drops"}
                    className="group flex min-w-0 flex-1 items-center gap-3"
                  >
                    <BottleGlyph kind={productKind(e.category, e.size_ml)} className="h-12 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="line-clamp-2 font-medium group-hover:underline group-hover:underline-offset-4">
                          {name}
                        </span>
                        {e.current_price ? (
                          <span className="shrink-0 font-medium tabular-nums">{formatPrice(e.current_price)}</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug">
                        <span className={cn("font-medium", c.tone)}>{c.label}</span>
                        <span className="text-muted-foreground"> · {availability(e)}</span>
                      </span>
                      {meta ? <span className="block truncate text-xs text-subtle-foreground">{meta}</span> : null}
                    </span>
                  </Link>
                  {e.csc ? (
                    <WatchStar csc={e.csc} name={name} initialWatched={watched.has(e.csc)} signedIn={signedIn} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
