import Link from "next/link";
import { Check } from "lucide-react";
import { WatchStar } from "@/components/watch-star";
import { BottleGlyph } from "@/components/bottle-glyph";
import {
  categoryLabel,
  formatPrice,
  formatQty,
  listingNote,
  productKind,
  productTitle,
  sizeLabel,
  unitWord,
} from "@/lib/format";
import type { Nearby, ProductRow } from "@/lib/queries";
import type { Area } from "@/lib/area";
import { NearbyStock } from "@/components/nearby-stock";
import { SearchResultLink, type SearchTrack } from "@/components/search-track";

/**
 * Results as compact rows: which bottle (name, size, style), what it costs,
 * whether it's on a shelf anywhere, and a watch action. Warehouse counts and
 * codes live on the product page. `track` (search results only) records
 * result clicks with their rank and attributes watches to the search list.
 */
export function ProductList({
  rows,
  watched,
  signedIn,
  area,
  nearby,
  track,
}: {
  rows: ProductRow[];
  watched: Set<string>;
  signedIn: boolean;
  area?: Area | null;
  nearby?: Map<string, Nearby>;
  track?: SearchTrack;
}) {
  return (
    <ul className="divide-y border-y">
      {rows.map((p, i) => {
        const name = productTitle(p.name, p.size_ml);
        const meta = [sizeLabel(p.size_ml), categoryLabel(p.category)].filter(Boolean).join(" · ");
        const note = listingNote(p.status);
        return (
          <li key={p.csc} className="flex items-center gap-3 py-3">
            <RowLink href={`/product/${p.csc}`} csc={p.csc} rank={track ? track.offset + i + 1 : 0} track={track}>
              <BottleGlyph kind={productKind(p.category, p.size_ml)} className="mt-0.5 h-14 w-10 lg:mt-0" />
              {/* Phones: stacked. Desktop: bottle | availability | price, like a shelf list. */}
              <span className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem_6rem] lg:items-center lg:gap-6">
                <span className="block min-w-0">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="line-clamp-2 text-[16px] font-medium group-hover:underline group-hover:underline-offset-4">
                      {name}
                    </span>
                    <span className="shrink-0 text-[16px] font-medium tabular-nums lg:hidden">
                      {formatPrice(p.current_price)}
                    </span>
                  </span>
                  {meta ? <span className="block truncate text-[13px] text-subtle-foreground">{meta}</span> : null}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] lg:mt-0 lg:flex-col lg:items-start">
                  {p.in_stock && (p.store_qty ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-success">
                      <Check className="size-3.5" aria-hidden />
                      In stores · {formatQty(p.store_qty)} {unitWord(p.category, p.size_ml, p.store_qty ?? 0)} statewide
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {/* DABS flags some bottles in stock with none on store shelves (warehouse only). */}
                      {p.in_stock ? "Not on store shelves" : "Not in stores"}
                      {(p.on_order_qty ?? 0) > 0 ? ` · ${formatQty(p.on_order_qty)} on order` : ""}
                    </span>
                  )}
                  {p.in_stock ? (
                    <NearbyStock area={area} nearby={nearby?.get(p.csc)} category={p.category} sizeMl={p.size_ml} />
                  ) : null}
                  {p.is_spa || note ? (
                    <span className="inline-flex gap-2">
                      {p.is_spa ? <span className="font-medium text-price-drop">On sale</span> : null}
                      {note ? <span className="text-subtle-foreground">{note}</span> : null}
                    </span>
                  ) : null}
                </span>
                <span className="hidden text-right text-[16px] font-medium tabular-nums lg:block">
                  {formatPrice(p.current_price)}
                </span>
              </span>
            </RowLink>
            <WatchStar
              csc={p.csc}
              name={name}
              initialWatched={watched.has(p.csc)}
              signedIn={signedIn}
              source={track?.source}
            />
          </li>
        );
      })}
    </ul>
  );
}

const ROW_LINK = "group flex min-w-0 flex-1 items-start gap-3 lg:items-center";

/** The row's link: a tracked search result, or a plain link elsewhere (watchlist). */
function RowLink({
  href,
  csc,
  rank,
  track,
  children,
}: {
  href: string;
  csc: string;
  rank: number;
  track?: SearchTrack;
  children: React.ReactNode;
}) {
  return track ? (
    <SearchResultLink href={href} csc={csc} rank={rank} track={track} className={ROW_LINK}>
      {children}
    </SearchResultLink>
  ) : (
    <Link prefetch={false} href={href} className={ROW_LINK}>
      {children}
    </Link>
  );
}
