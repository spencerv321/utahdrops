import Link from "next/link";
import { EventTag, eventTagKey } from "@/components/event-tag";
import { WatchStar } from "@/components/watch-star";
import { displayName, formatPrice, formatQty, timeAgo } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";

function detailLine(e: FeedEvent): string {
  const price = formatPrice(e.current_price);
  const stock = e.in_stock && e.store_qty ? `${formatQty(e.store_qty)} in stores` : "not in stores yet";
  switch (e.event_type) {
    case "restock":
      return `${stock} · ${price}`;
    case "new_product":
      return `New to Utah · ${price} · ${stock}`;
    case "price_change":
      return `${formatPrice(e.detail.old as number)} → ${formatPrice(e.detail.new as number)}`;
    case "status_change":
      return e.detail.new === "D" ? `Being discontinued · ${stock} left` : `${price} · ${stock}`;
    case "out_of_stock":
      return `Sold out statewide · ${price}`;
    case "allocated_drop":
      return `${String(e.detail.count ?? "")} bottles on this month's list`;
    default:
      return price;
  }
}

/** Event cards: recent restocks, new bottles, price drops, clearance. */
export function HomeFeed({
  events,
  watched,
  signedIn,
  empty = "Quiet week. Restocks, new bottles and price drops show up here as DABS updates.",
}: {
  events: FeedEvent[];
  watched: Set<string>;
  signedIn: boolean;
  empty?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{empty}</p>
    );
  }
  return (
    <ul className="grid gap-2.5 lg:grid-cols-2">
      {events.map((e) => {
        const name = e.csc ? displayName(e.name ?? e.csc) : "Allocated list posted";
        return (
          <li key={e.id} className="flex gap-1 rounded-2xl border bg-card py-3 pr-1.5 pl-4">
            <Link href={e.csc ? `/product/${e.csc}` : "/drops"} className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <EventTag tag={eventTagKey(e.event_type, e.detail)} />
                <span className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
              </div>
              <p className="font-display text-lg leading-tight font-bold tracking-[-0.01em]">{name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{detailLine(e)}</p>
            </Link>
            {e.csc ? (
              <WatchStar csc={e.csc} name={name} initialWatched={watched.has(e.csc)} signedIn={signedIn} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
