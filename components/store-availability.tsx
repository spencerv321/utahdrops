"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { LocateFixed, Navigation, Phone } from "lucide-react";
import { storeLabel } from "@/lib/format";
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

// The visitor's last location, remembered so return visits sort by distance
// without asking again. localStorage can throw (private mode) — then we just
// don't remember.
const STORAGE_KEY = "ud_location";
const listeners = new Set<() => void>();
function readSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function save(coords: Coords) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {
    // not persisted; fine
  }
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
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
export function StoreAvailability({ stores, homeStores }: { stores: StoreRow[]; homeStores: HomeStore[] }) {
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
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        save({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("idle");
      },
      () => setStatus("denied"),
      { maximumAge: 600_000, timeout: 8000 }
    );
  }

  const locateButton = (
    <button
      type="button"
      onClick={locate}
      disabled={status === "locating"}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-[15px] font-bold text-background disabled:opacity-60"
    >
      <LocateFixed className="size-[18px]" aria-hidden />
      {status === "locating" ? "Finding you…" : "Find the nearest store"}
    </button>
  );

  // The one-glance answer.
  let answer: React.ReactNode;
  if (homeStores.length > 0) {
    if (mineInStock) {
      answer = <AnswerCard label="At your store" row={mineInStock} />;
    } else {
      const names = homeStores.map((s) => storeLabel(s.name, s.city).title).join(", ");
      const fallback = nearest ?? mostBottles;
      answer = (
        <div className="space-y-3">
          <p className="rounded-2xl border border-dashed p-4 text-[15px]">
            <strong>Not at your store{homeStores.length > 1 ? "s" : ""}</strong> ({names}) right now.
            {" "}
            {inStock.length === 0 ? "None of the stores we check have it." : null}
          </p>
          {fallback ? <AnswerCard label={nearest ? "Nearest with stock" : "Most bottles"} row={fallback} /> : null}
          {!here && inStock.length > 0 ? locateButton : null}
        </div>
      );
    }
  } else if (inStock.length === 0) {
    answer = (
      <p className="rounded-2xl border border-dashed p-4 text-[15px] text-muted-foreground">
        None of the stores we check have it right now. Watch it and we&apos;ll email you when it&apos;s back.
      </p>
    );
  } else if (nearest) {
    answer = <AnswerCard label="Nearest with stock" row={nearest} />;
  } else {
    answer = (
      <div className="space-y-3">
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-[15px]">
            <strong>
              {inStock.length} store{inStock.length === 1 ? "" : "s"}
            </strong>{" "}
            have it. Which is closest to you?
          </p>
          {locateButton}
          {status === "denied" ? (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t get your location. Check your browser&apos;s location permission, or{" "}
              <Link href="/watchlist" className="font-semibold text-primary underline">
                pick your store
              </Link>
              .
            </p>
          ) : null}
        </div>
        {mostBottles ? <AnswerCard label="Most bottles" row={mostBottles} /> : null}
      </div>
    );
  }

  const visible = showAll ? rows : rows.slice(0, 5);

  return (
    <div className="space-y-3">
      {answer}

      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {visible.map((s) => {
          const label = storeLabel(s.name, s.city);
          return (
            <li key={s.store_id} className={cn("flex items-center gap-2 py-2.5 pr-2 pl-4", s.qty === 0 && "text-muted-foreground")}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {label.title}
                  {s.mine ? (
                    <span className="ml-2 rounded-md bg-fresh-soft px-1.5 py-0.5 text-[11px] font-bold text-fresh">
                      Your store
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {[label.number ? `#${label.number}` : null, s.address, s.miles != null ? `${s.miles.toFixed(1)} mi` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="w-10 text-right text-xl font-bold tabular-nums">{s.qty}</span>
              <a
                href={mapHref(s)}
                target="_blank"
                rel="noopener"
                aria-label={`Directions to ${label.title}`}
                className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-secondary"
              >
                <Navigation className="size-5" aria-hidden />
              </a>
              {s.phone ? (
                <a
                  href={telHref(s.phone)}
                  aria-label={`Call ${label.title}`}
                  className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-secondary"
                >
                  <Phone className="size-5" aria-hidden />
                </a>
              ) : (
                <span className="size-11" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 5 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="h-11 w-full rounded-xl border bg-card text-[15px] font-bold text-primary"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length} stores`}
        </button>
      ) : null}
    </div>
  );
}

function AnswerCard({ label, row }: { label: string; row: Row }) {
  const store = storeLabel(row.name, row.city);
  return (
    <div className="space-y-3 rounded-2xl border border-success/25 bg-success-soft p-4">
      <p className="text-xs font-bold tracking-[0.08em] text-success uppercase">{label}</p>
      <div className="flex items-center gap-4">
        <span className="font-display text-6xl leading-[0.85] font-extrabold tracking-[-0.04em] text-success tabular-nums">
          {row.qty}
        </span>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-bold">
            {row.qty === 1 ? "bottle" : "bottles"} at {store.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {[row.miles != null ? `${row.miles.toFixed(1)} mi` : null, row.address].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={mapHref(row)}
          target="_blank"
          rel="noopener"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-success text-[15px] font-bold text-success-soft"
        >
          <Navigation className="size-[18px]" aria-hidden />
          Directions
        </a>
        {row.phone ? (
          <a
            href={telHref(row.phone)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-success/40 bg-card text-[15px] font-bold text-success"
          >
            <Phone className="size-[18px]" aria-hidden />
            Call to confirm
          </a>
        ) : null}
      </div>
    </div>
  );
}
