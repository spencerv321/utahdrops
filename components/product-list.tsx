import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { WatchStar } from "@/components/watch-star";
import { displayName, formatPrice, formatQty, formatSize } from "@/lib/format";
import type { ProductRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

function stockLine(p: ProductRow): { text: string; tone: "good" | "none" } {
  if (p.in_stock) return { text: `In stores now · ${formatQty(p.store_qty)} bottles statewide`, tone: "good" };
  if ((p.on_order_qty ?? 0) > 0) return { text: `Out of stock · ${formatQty(p.on_order_qty)} on order`, tone: "none" };
  return { text: "Out of stock · watch to get alerted", tone: "none" };
}

/** Search results as tappable cards: name, price, status, stock, watch. */
export function ProductList({
  rows,
  watched,
  signedIn,
}: {
  rows: ProductRow[];
  watched: Set<string>;
  signedIn: boolean;
}) {
  return (
    <ul className="grid gap-2.5 lg:grid-cols-2">
      {rows.map((p) => {
        const name = displayName(p.name);
        const stock = stockLine(p);
        return (
          <li key={p.csc} className="flex gap-1 rounded-2xl border bg-card py-3 pr-1.5 pl-4">
            <Link href={`/product/${p.csc}`} className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-lg leading-tight font-bold tracking-[-0.01em]">{name}</p>
                <p className="shrink-0 font-bold tabular-nums">
                  {formatPrice(p.current_price)}
                  {p.is_spa ? (
                    <span className="ml-1 text-xs font-semibold text-price-drop" title="Special Price Allowance (on sale)">
                      SALE
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                <StatusBadge status={p.status} />
                <span>{[p.category && displayName(p.category), formatSize(p.size_ml)].filter(Boolean).join(" · ")}</span>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  stock.tone === "good" ? "text-success" : "text-muted-foreground"
                )}
              >
                {stock.text}
              </p>
            </Link>
            <WatchStar csc={p.csc} name={name} initialWatched={watched.has(p.csc)} signedIn={signedIn} />
          </li>
        );
      })}
    </ul>
  );
}
