import Link from "next/link";
import { nearLabel, type Area } from "@/lib/area";
import { checkedAgo } from "@/lib/format";
import type { WatchSummary } from "@/lib/watch-summary";

/**
 * The signed-in hero line in place of the pitch: "2 of your 8 watched bottles
 * are in stock · 1 at stores near Riverton, checked 5h ago". Local part only when a
 * store check found one (lib/watch-summary.ts); never "none near".
 */
export function WatchStatus({ summary, area }: { summary: WatchSummary; area: Area | null }) {
  const { total, inStock, near } = summary;
  return (
    <p className="max-w-xl text-[17px] leading-relaxed text-muted-foreground">
      <Link prefetch={false} href="/watchlist" className="text-foreground underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
        {inStock} of your {total} watched {total === 1 ? "bottle" : "bottles"} {inStock === 1 ? "is" : "are"} in stock
      </Link>
      {near && area ? (
        <>
          {" · "}
          {near.bottles} at stores {nearLabel(area)}
          <span className="text-subtle-foreground">, checked {checkedAgo(near.checkedAt)}</span>
        </>
      ) : null}
    </p>
  );
}
