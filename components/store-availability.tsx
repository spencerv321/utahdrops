"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, LocateFixed, Navigation, Phone } from "lucide-react";
import { storeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AREA_EVENT, LOCATION_STORAGE_KEY, locate as locateArea, rememberArea } from "@/lib/area-client";

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

// The visitor's last location (see lib/area-client), so return visits sort by
// distance without asking again. localStorage can throw (private mode) — then
// we just don't remember.
function readSaved(): string | null {
  try {
    return window.localStorage.getItem(LOCATION_STORAGE_KEY);
  } catch {
    return null;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(AREA_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(AREA_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function milesBetween(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const mapHref = (s: StoreRow) =>
  s.lat != null
    ? `https://maps.google.com/?q=${s.lat},${s.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent([s.address, s.city, "UT"].filter(Boolean).join(", "))}`;

type Row = StoreRow & { miles: number | null; mine: boolean };

/**
 * "Where can I get it?" Signed in with chosen stores: lead with those.
 * Otherwise: the nearest store with stock (one tap to share location), and
 * until then, the store with the most bottles.
 */
export function StoreAvailability({
  stores,
  homeStores,
  unit,
}: {
  stores: StoreRow[];
  homeStores: HomeStore[];
  /** "bottle"/"bottles" or "unit"/"units", from the product's category. */
  unit: { one: string; many: string };
}) {
  const saved = useSyncExternalStore(subscribe, readSaved, () => null);
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");
  const [showAll, setShowAll] = useState(false);

  const here: Coords | null = useMemo(() => {
    if (!saved) return null;
    try {
      const c = JSON.parse(saved) as Coords;
      return Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : null;
    } catch {
      return null;
    }
  }, [saved]);

  const homeIds = useMemo(() => new Set(homeStores.map((s) => s.id)), [homeStores]);

  const rows: Row[] = useMemo(() => {
    const withDistance = stores.map((s) => ({
      ...s,
      mine: homeIds.has(s.store_id),
      miles: here && s.lat != null && s.lng != null ? milesBetween(here, { lat: s.lat, lng: s.lng }) : null,
    }));
    // Your stores first, then in stock, then nearest (or most bottles).
    return withDistance.sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        Number(b.qty > 0) - Number(a.qty > 0) ||
        (here ? (a.miles ?? Infinity) - (b.miles ?? Infinity) : b.qty - a.qty)
    );
  }, [stores, here, homeIds]);

  const inStock = rows.filter((r) => r.qty > 0);
  const nearest = here
    ? [...inStock].filter((r) => r.miles != null).sort((a, b) => a.miles! - b.miles!)[0]
    : undefined;
  const mostBottles = [...inStock].sort((a, b) => b.qty - a.qty)[0];
  const mineInStock = inStock.filter((r) => r.mine).sort((a, b) => b.qty - a.qty)[0];

  function locate() {
    setStatus("locating");
    locateArea().then(
      (area) => {
        rememberArea(area);
        setStatus("idle");
      },
      () => setStatus("denied")
    );
  }

  // No location permission needed: pick an area and we measure from its store.
  const areas = useMemo(() => {
    const byCity = new Map<string, Coords>();
    for (const s of stores) {
      if (!s.city || s.lat == null || s.lng == null) continue;
      const city = storeLabel(s.city).title;
      if (!byCity.has(city)) byCity.set(city, { lat: s.lat, lng: s.lng });
    }
    return [...byCity.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [stores]);

  const whereFrom = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={locate}
        disabled={status === "locating"}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-input px-4 text-[15px] hover:bg-card disabled:opacity-60"
      >
        <LocateFixed className="size-[18px]" aria-hidden />
        {status === "locating" ? "Finding you…" : here ? "Update my location" : "Use my location"}
      </button>
      {areas.length > 1 ? (
        <label className="relative inline-flex h-11 items-center gap-2 rounded-md border border-input px-4 text-[15px] hover:bg-card">
          <span>or choose an area</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          <select
            aria-label="Choose an area to sort stores by distance"
            className="absolute inset-0 cursor-pointer opacity-0"
            defaultValue=""
            onChange={(e) => {
              const area = areas.find(([name]) => name === e.target.value);
              if (area) rememberArea({ label: area[0], ...area[1] });
            }}
          >
            <option value="" disabled>
              Choose an area
            </option>
            {areas.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {status === "denied" ? (
        <p className="w-full text-sm text-muted-foreground">
          Couldn&apos;t get your location. Choose an area instead, or{" "}
          <Link prefetch={false} href="/watchlist" className="text-foreground underline underline-offset-4">
            pick your store
          </Link>
          .
        </p>
      ) : null}
    </div>
  );

  // The one-glance answer.
  let answer: React.ReactNode;
  if (homeStores.length > 0) {
    if (mineInStock) {
      answer = <AnswerCard label="At your store" row={mineInStock} unit={unit} />;
    } else {
      const names = homeStores.map((s) => storeLabel(s.name, s.city).title).join(", ");
      const fallback = nearest ?? mostBottles;
      answer = (
        <div className="space-y-3">
          <p className="text-[15px]">
            <strong className="font-medium">Not at your store{homeStores.length > 1 ? "s" : ""}</strong>{" "}
            <span className="text-muted-foreground">({names}) right now.</span>
            {inStock.length === 0 ? <span className="text-muted-foreground"> None of the stores we check have it.</span> : null}
          </p>
          {fallback ? <AnswerCard label={nearest ? "Nearest with stock" : "Most on hand"} row={fallback} unit={unit} /> : null}
        </div>
      );
    }
  } else if (inStock.length === 0) {
    answer = (
      <p className="border-y py-4 text-[15px] text-muted-foreground">
        None of the stores we check have it right now. Watch it and we&apos;ll email you when it&apos;s back.
      </p>
    );
  } else if (nearest) {
    answer = <AnswerCard label="Nearest with stock" row={nearest} unit={unit} />;
  } else {
    answer = mostBottles ? <AnswerCard label="Most on hand" row={mostBottles} unit={unit} /> : null;
  }

  const visible = showAll ? rows : rows.slice(0, 6);

  return (
    <div className="space-y-4">
      {answer}
      {inStock.length > 0 ? whereFrom : null}

      <ul className="divide-y border-y">
        {visible.map((s) => {
          const label = storeLabel(s.name, s.city);
          return (
            <li key={s.store_id} className="flex items-center gap-1 py-2">
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", s.qty === 0 && "text-muted-foreground")}>
                  {label.title}
                  {label.number ? <span className="font-normal text-subtle-foreground"> #{label.number}</span> : null}
                  {s.mine ? <span className="ml-2 text-xs font-medium text-primary">Your store</span> : null}
                </p>
                <p className="truncate text-[13px] text-subtle-foreground">
                  {[s.address, s.miles != null ? `${s.miles.toFixed(1)} mi` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="w-16 pr-1 text-right tabular-nums">
                <span className={cn("block text-lg font-medium leading-tight", s.qty === 0 && "text-muted-foreground")}>
                  {s.qty}
                </span>
                <span className="block text-[11px] text-subtle-foreground">{s.qty === 1 ? unit.one : unit.many}</span>
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

function AnswerCard({ label, row, unit }: { label: string; row: Row; unit: { one: string; many: string } }) {
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
