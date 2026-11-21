import Link from "next/link";
import { BottlePhoto } from "@/components/bottle-photo";
import { Availability } from "@/components/discover-results";
import { WatchStar } from "@/components/watch-star";
import type { Area } from "@/lib/area";
import { GROUPS } from "@/lib/holiday";
import type { HolidayItem } from "@/lib/holiday-query";
import { formatPrice, listingNote, productKind, productTitle, sizeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One holiday bottle: group kicker, name, price, DABS listing note, where it is. */
export function HolidayRow({
  item,
  area,
  watched,
  signedIn,
  compact = false,
  showGroup = false,
}: {
  item: HolidayItem;
  area: Area | null;
  watched: boolean;
  signedIn: boolean;
  compact?: boolean;
  showGroup?: boolean;
}) {
  const name = productTitle(item.name, item.sizeMl);
  const size = sizeLabel(item.sizeMl);
  // DABS buys most seasonal bottles as "T, Trial Distribution", so "Trial
  // listing" would sit on nearly every row here and say nothing. Keep only
  // the notes that change what a shopper does: it's leaving DABS.
  const note = ["D", "X", "U"].includes(item.status ?? "") ? listingNote(item.status) : null;
  return (
    <li className={cn("flex gap-3", compact ? "py-3" : "py-4")}>
      <BottlePhoto csc={item.csc} kind={productKind(item.category, item.sizeMl)} className="mt-0.5 h-12 w-9" />
      <div className="min-w-0 flex-1 space-y-1.5">
        {showGroup || note ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {showGroup ? <span className="kicker text-primary">{GROUPS.find((g) => g.key === item.group)?.label}</span> : null}
            {note ? <span className="text-subtle-foreground">{note}</span> : null}
          </p>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <Link prefetch={false} href={`/product/${item.csc}`} className="line-clamp-2 font-medium hover:underline hover:underline-offset-4">
            {name}
            {size ? <span className="font-normal text-muted-foreground"> · {size}</span> : null}
          </Link>
          <span className="shrink-0 text-right font-medium tabular-nums">
            {formatPrice(item.price)}
            {item.isSpa ? <span className="block text-[11px] font-normal text-price-drop">on sale</span> : null}
          </span>
        </div>
        <Availability item={item} area={area} />
      </div>
      <WatchStar csc={item.csc} name={name} initialWatched={watched} signedIn={signedIn} className="-mr-2" />
    </li>
  );
}
