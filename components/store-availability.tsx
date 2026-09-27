"use client";

import { useMemo, useState } from "react";
import { Navigation, Phone } from "lucide-react";
import { checkedAgo, storeLabel } from "@/lib/format";
import { canClaimNone, exceedsStatewide, type Statewide } from "@/lib/store-freshness";
import { milesBetween } from "@/lib/local-availability";
import { cn } from "@/lib/utils";

export interface StoreRow {
  store_id: number;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  qty: number;
}

export interface HomeStore {
  id: number;
  name: string;
  city: string | null;
}

type Coords = { lat: number; lng: number };

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const mapHref = (s: StoreRow) =>
  s.lat != null
    ? `https://maps.google.com/?q=${s.lat},${s.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent([s.address, s.city, "UT"].filter(Boolean).join(", "))}`;

type Row = StoreRow & {
  miles: number | null;
  mine: boolean;
  /** A later statewide count is lower than this store's count: it has sold since. */
  outdated: boolean;
};

/**
 * "Where can I get it?", store by store. Signed in with chosen stores: lead
 * with those. Distances are from the visitor's chosen area (`here`, from the
 * ud_area cookie; chosen in the local answer card above). With an area the
 * card above already names the nearest stock, so only home stores get an
 * answer here; without one, the store with the most bottles does.
 *
 * Every answer says when the stores were checked. "Not at your store" / "none
 * of the stores" only from a check under a day old (lib/store-freshness.ts);
 * a store count higher than the latest statewide count is marked out of date
 * and never offered as the answer.
 */
export function StoreAvailability({
  stores,
  homeStores,
  unit,
  checkedAt,
  statewide,
  here,
}: {
  stores: StoreRow[];
  homeStores: HomeStore[];
  /** "bottle"/"bottles" or "unit"/"units", from the product's category. */
  unit: { one: string; many: string };
  /** When these store counts were checked (one DABS page gives every store). */
  checkedAt: string;
  /** Latest catalog pass: statewide shelf count and when it was seen. */
  statewide: Statewide;
  /** The chosen area's coordinates, or null with no area. */
  here: Coords | null;
}) {
  const [showAll, setShowAll] = useState(false);

  const homeIds = useMemo(() => new Set(homeStores.map((s) => s.id)), [homeStores]);

  const rows: Row[] = useMemo(() => {
    const withDistance = stores.map((s) => ({
      ...s,
      mine: homeIds.has(s.store_id),
      outdated: exceedsStatewide(s.qty, statewide, checkedAt),
      miles: here && s.lat != null && s.lng != null ? milesBetween(here, { lat: s.lat, lng: s.lng }) : null,
    }));
    // Your stores first, then in stock, then nearest (or most bottles).
    const stocked = (r: Row) => Number(r.qty > 0 && !r.outdated);
    return withDistance.sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        stocked(b) - stocked(a) ||
        (here ? (a.miles ?? Infinity) - (b.miles ?? Infinity) : b.qty - a.qty)
    );
  }, [stores, here, homeIds, statewide, checkedAt]);

  const inStock = rows.filter((r) => r.qty > 0 && !r.outdated);
  const outdated = rows.filter((r) => r.outdated);
  const ago = checkedAgo(checkedAt);
  const recent = canClaimNone(checkedAt);
  const nearest = here
    ? [...inStock].filter((r) => r.miles != null).sort((a, b) => a.miles! - b.miles!)[0]
    : undefined;
  const mostBottles = [...inStock].sort((a, b) => b.qty - a.qty)[0];
  const mineInStock = inStock.filter((r) => r.mine).sort((a, b) => b.qty - a.qty)[0];

  // The one-glance answer.
  let answer: React.ReactNode;
  // Nothing on a shelf we can vouch for: say why, without a stale "none".
  const noneNote =
    outdated.length > 0
      ? `Our store counts from ${ago} are out of date: DABS now shows fewer ${unit.many} statewide than we counted at ${outdated.length === 1 ? "one store" : "some stores"}.`
      : recent
        ? `None of the stores we check had it when we checked ${ago}.`
        : `None of the stores we check had it when we last checked, ${ago}. That's too long ago to rule a store out.`;

  if (homeStores.length > 0) {
    if (mineInStock) {
      answer = <AnswerCard label="At your store" row={mineInStock} unit={unit} checked={ago} />;
    } else {
      const names = homeStores.map((s) => storeLabel(s.name, s.city).title).join(", ");
      const plural = homeStores.length > 1 ? "s" : "";
      const fallback = nearest ?? mostBottles;
      const mineOutdated = outdated.some((r) => r.mine);
      answer = (
        <div className="space-y-3">
          <p className="text-[15px]">
            {mineOutdated ? (
              <>
                <strong className="font-medium">
                  {homeStores.length > 1 ? "Your stores\u2019 counts are" : "Your store\u2019s count is"} out of date
                </strong>{" "}
                <span className="text-muted-foreground">
                  ({names}): it&apos;s more than DABS now shows statewide. Call before you go.
                </span>
              </>
            ) : recent ? (
              <>
                <strong className="font-medium">Not at your store{plural}</strong>{" "}
                <span className="text-muted-foreground">
                  ({names}) when we checked {ago}.
                </span>
              </>
            ) : (
              <>
                <strong className="font-medium">None at your store{plural} when we last checked</strong>{" "}
                <span className="text-muted-foreground">
                  ({names}, {ago}). That&apos;s too long ago to rule it out; call the store.
                </span>
              </>
            )}
            {inStock.length === 0 && !mineOutdated ? <span className="text-muted-foreground"> {noneNote}</span> : null}
          </p>
          {fallback ? (
            <AnswerCard label={nearest ? "Nearest with stock" : "Most on hand"} row={fallback} unit={unit} checked={ago} />
          ) : null}
        </div>
      );
    }
  } else if (here) {
    // The local answer card above covers "near you"; the list is the detail.
    answer = null;
  } else if (inStock.length === 0) {
    answer = (
      <p className="border-y py-4 text-[15px] text-muted-foreground">
        {noneNote} Watch it and we&apos;ll email you when it&apos;s back.
      </p>
    );
  } else {
    answer = mostBottles ? <AnswerCard label="Most on hand" row={mostBottles} unit={unit} checked={ago} /> : null;
  }

  const visible = showAll ? rows : rows.slice(0, 6);

  return (
    <div className="space-y-4">
      {answer}

      <ul className="divide-y border-y">
        {visible.map((s) => {
          const label = storeLabel(s.name, s.city);
          return (
            <li key={s.store_id} className="flex items-center gap-1 py-2">
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", (s.qty === 0 || s.outdated) && "text-muted-foreground")}>
                  {label.title}
                  {label.number ? <span className="font-normal text-subtle-foreground"> #{label.number}</span> : null}
                  {s.mine ? <span className="ml-2 text-xs font-medium text-primary">Your store</span> : null}
                </p>
                <p className="truncate text-[13px] text-subtle-foreground">
                  {[s.address, s.miles != null ? `${s.miles.toFixed(1)} mi` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="w-16 pr-1 text-right tabular-nums">
                <span
                  className={cn(
                    "block text-lg font-medium leading-tight",
                    (s.qty === 0 || s.outdated) && "text-muted-foreground",
                    s.outdated && "line-through"
                  )}
                >
                  {s.qty}
                </span>
                <span className="block text-[11px] text-subtle-foreground">
                  {s.outdated ? "out of date" : s.qty === 1 ? unit.one : unit.many}
                </span>
              </span>
              <a
                href={mapHref(s)}
                target="_blank"
                rel="noopener"
                aria-label={`Directions to ${label.title}${label.number ? ` #${label.number}` : ""}`}
                className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <Navigation className="size-[18px]" aria-hidden />
              </a>
              {s.phone ? (
                <a
                  href={telHref(s.phone)}
                  aria-label={`Call ${label.title}${label.number ? ` #${label.number}` : ""}`}
                  className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <Phone className="size-[18px]" aria-hidden />
                </a>
              ) : (
                <span className="size-11" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 6 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="h-11 w-full rounded-md border text-[15px] hover:border-input"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length} stores`}
        </button>
      ) : null}
    </div>
  );
}

function AnswerCard({
  label,
  row,
  unit,
  checked,
}: {
  label: string;
  row: Row;
  unit: { one: string; many: string };
  /** "5h ago" / "Sep 22": when this count was checked. */
  checked: string;
}) {
  const store = storeLabel(row.name, row.city);
  return (
    <div className="space-y-3 rounded-lg bg-card p-4">
      <p className="kicker text-success">{label}</p>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-5xl leading-none text-success tabular-nums">{row.qty}</span>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-medium">
            {row.qty === 1 ? unit.one : unit.many} at {store.title}
            {store.number ? <span className="font-normal text-muted-foreground"> #{store.number}</span> : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {[row.miles != null ? `${row.miles.toFixed(1)} mi away` : null, row.address].filter(Boolean).join(" · ")}
          </p>
          <p className="text-sm text-subtle-foreground">Checked {checked}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={mapHref(row)}
          target="_blank"
          rel="noopener"
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-input text-[15px] hover:bg-raised"
        >
          <Navigation className="size-4" aria-hidden />
          Directions
        </a>
        {row.phone ? (
          <a
            href={telHref(row.phone)}
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-input text-[15px] hover:bg-raised"
          >
            <Phone className="size-4" aria-hidden />
            Call first
          </a>
        ) : null}
      </div>
    </div>
  );
}
