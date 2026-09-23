"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
const mapHref = (s: StoreRow) => `https://maps.google.com/?q=${s.lat},${s.lng}`;

/** Per-store stock with a "nearest to me" sort done entirely in the browser. */
export function StoreAvailability({ stores }: { stores: StoreRow[] }) {
  const saved = useSyncExternalStore(subscribe, readSaved, () => null);
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");

  const here: Coords | null = useMemo(() => {
    if (!saved) return null;
    try {
      const c = JSON.parse(saved) as Coords;
      return Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : null;
    } catch {
      return null;
    }
  }, [saved]);

  const rows = useMemo(() => {
    const withDistance = stores.map((s) => ({
      ...s,
      miles: here && s.lat != null && s.lng != null ? milesBetween(here, { lat: s.lat, lng: s.lng }) : null,
    }));
    if (!here) return withDistance;
    // In stock first, then nearest.
    return withDistance.sort(
      (a, b) =>
        Number(b.qty > 0) - Number(a.qty > 0) ||
        (a.miles ?? Infinity) - (b.miles ?? Infinity)
    );
  }, [stores, here]);

  const nearest = here ? rows.find((r) => r.qty > 0 && r.miles != null) : undefined;

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant={here ? "outline" : "default"} onClick={locate} disabled={status === "locating"}>
          <LocateFixed className="size-4" />
          {status === "locating" ? "Finding you…" : here ? "Update my location" : "Nearest to me"}
        </Button>
        {status === "denied" ? (
          <span className="text-sm text-muted-foreground">
            Couldn&apos;t get your location — check your browser&apos;s location permission.
          </span>
        ) : null}
      </div>

      {here ? (
        nearest ? (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            <MapPin className="mr-1 inline size-4 align-[-0.2em] text-success" />
            Nearest with stock: <strong>{nearest.name}</strong>
            {nearest.city ? `, ${nearest.city}` : ""} — {nearest.miles!.toFixed(1)} mi,{" "}
            {nearest.qty} bottle{nearest.qty === 1 ? "" : "s"}.{" "}
            {nearest.phone ? (
              <a className="underline" href={telHref(nearest.phone)}>Call to confirm</a>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            None of the stores we&apos;ve checked have this in stock right now.
          </div>
        )
      ) : null}

      {/* Phones: qty up front, tap-to-call and map, no sideways scroll. */}
      <ul className="divide-y rounded-lg border sm:hidden">
        {rows.map((s) => (
          <li
            key={s.store_id}
            className={cn("flex items-center justify-between gap-3 px-3 py-3", s.qty === 0 && "opacity-60")}
          >
            <div className="min-w-0">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {[s.address, s.city].filter(Boolean).join(", ")}
                {s.miles != null ? ` · ${s.miles.toFixed(1)} mi` : ""}
              </div>
              <div className="mt-1 flex gap-4 text-sm">
                {s.phone ? <a className="underline" href={telHref(s.phone)}>Call</a> : null}
                {s.lat != null ? (
                  <a className="underline" href={mapHref(s)} rel="noopener" target="_blank">Map</a>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-semibold tabular-nums">{s.qty}</div>
              <div className="text-xs text-muted-foreground">bottles</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Store</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Phone</TableHead>
              {here ? <TableHead className="text-right">Distance</TableHead> : null}
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>
                <span className="sr-only">Map</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.store_id} className={s.qty === 0 ? "opacity-60" : ""}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm">{s.address}</TableCell>
                <TableCell className="text-sm">{s.city}</TableCell>
                <TableCell className="text-sm">
                  {s.phone ? <a className="hover:underline" href={telHref(s.phone)}>{s.phone}</a> : null}
                </TableCell>
                {here ? (
                  <TableCell className="text-right text-sm tabular-nums">
                    {s.miles != null ? `${s.miles.toFixed(1)} mi` : "—"}
                  </TableCell>
                ) : null}
                <TableCell className="text-right font-semibold tabular-nums">{s.qty}</TableCell>
                <TableCell>
                  {s.lat != null ? (
                    <a className="text-xs underline" href={mapHref(s)} rel="noopener" target="_blank">
                      map
                    </a>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
