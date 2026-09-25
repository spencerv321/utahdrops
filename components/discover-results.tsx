import { MapPin } from "lucide-react";
import { BottleGlyph } from "@/components/bottle-glyph";
import { DiscoverLink } from "@/components/discover-link";
import { RarityBadge } from "@/components/rarity-card";
import { WatchStar } from "@/components/watch-star";
import { nearLabel, type Area } from "@/lib/area";
import { isFreshStoreCheck } from "@/lib/config";
import {
  nearState,
  reasonFor,
  VIEW_KICKER,
  type DiscoverItem,
  type DiscoverView,
  type Surface,
} from "@/lib/discover-rules";
import { checkedAgo, formatPrice, formatQty, productKind, productTitle, sizeLabel, unitWord, whenLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Where it is, honestly: nearby only from fresh successful store checks,
 * "none nearby" only when the bottle was fully checked in the window, and
 * otherwise "not checked" (unknown, never zero). Statewide stock is a
 * separate line with its own DABS timestamp.
 */
function Availability({ item, area }: { item: DiscoverItem; area: Area | null }) {
  const s = nearState(item, !!area);
  const units = (n: number) => unitWord(item.category, item.sizeMl, n);
  return (
    <div className="space-y-0.5 text-[13px] leading-snug">
      {area && s.kind === "near" ? (
        <p className="flex items-start gap-1 font-medium text-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Reported at {s.stores} {s.stores === 1 ? "store" : "stores"} {nearLabel(area)} · {formatQty(s.units)}{" "}
            {units(s.units)}
            <span className="font-normal text-subtle-foreground"> · checked {checkedAgo(s.checkedAt)}</span>
          </span>
        </p>
      ) : area && s.kind === "not-near" ? (
        <p className="flex items-start gap-1 text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Statewide only: none reported {nearLabel(area)} at the last store check
            <span className="text-subtle-foreground"> · {checkedAgo(s.checkedAt)}</span>
          </span>
        </p>
      ) : area ? (
        <p className="flex items-start gap-1 text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>Statewide only: stores {nearLabel(area)} not checked in the last 24 hours</span>
        </p>
      ) : null}
      <p className="text-muted-foreground">
        {formatQty(item.storeQty)} {units(item.storeQty)} in stores statewide
        <span className="text-subtle-foreground"> · DABS count {whenLabel(item.statewideAt)}</span>
      </p>
    </div>
  );
}

export function DiscoverRow({
  item,
  view,
  surface,
  area,
  watched,
  signedIn,
  compact = false,
}: {
  item: DiscoverItem;
  view: DiscoverView;
  surface: Surface;
  area: Area | null;
  watched: boolean;
  signedIn: boolean;
  compact?: boolean;
}) {
  const source = `${surface}:${view}`;
  const name = productTitle(item.name, item.sizeMl);
  const size = sizeLabel(item.sizeMl);
  const hasStores = isFreshStoreCheck(item.storeCheckedAt);
  return (
    <li className={cn("flex gap-3", compact ? "py-3" : "py-4")}>
      <BottleGlyph kind={productKind(item.category, item.sizeMl)} className="mt-0.5 h-12 w-9" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          {item.tier ? <RarityBadge tier={item.tier} /> : null}
          <span className="kicker text-primary">{VIEW_KICKER[view]}</span>
        </p>
        <div className="flex items-baseline justify-between gap-3">
          <DiscoverLink
            href={`/product/${item.csc}`}
            csc={item.csc}
            source={source}
            className="line-clamp-2 font-medium hover:underline hover:underline-offset-4"
          >
            {name}
            {size ? <span className="font-normal text-muted-foreground"> · {size}</span> : null}
          </DiscoverLink>
          <span className="shrink-0 text-right font-medium tabular-nums">
            {formatPrice(item.price)}
            {item.isSpa ? <span className="block text-[11px] font-normal text-price-drop">on sale</span> : null}
          </span>
        </div>
        <p className="text-[14px] leading-snug">{reasonFor(view, item)}</p>
        <Availability item={item} area={area} />
        {compact ? null : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <DiscoverLink
              href={hasStores ? `/product/${item.csc}#where-title` : `/product/${item.csc}`}
              csc={item.csc}
              source={source}
              className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {hasStores ? "See stores" : "View bottle"}
            </DiscoverLink>
            <WatchStar
              csc={item.csc}
              name={name}
              initialWatched={watched}
              signedIn={signedIn}
              source={source}
              label
            />
          </div>
        )}
      </div>
      {compact ? (
        <WatchStar csc={item.csc} name={name} initialWatched={watched} signedIn={signedIn} source={source} className="-mr-2" />
      ) : null}
    </li>
  );
}
