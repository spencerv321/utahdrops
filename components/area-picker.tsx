"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import type { Area } from "@/lib/area";
import { locate, rememberArea } from "@/lib/area-client";
import { cn } from "@/lib/utils";

const HERE = "__here";
const ALL = "__all";

/**
 * "Where are you?" beside the search box. A native select (fast, accessible,
 * good on phones) styled as a field. Choosing refreshes the page so counts
 * switch to "near you" without an account.
 */
export function AreaPicker({
  areas,
  current,
  className,
}: {
  areas: Area[];
  current: Area | null;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");

  function apply(area: Area | null) {
    rememberArea(area);
    // A search can carry its own area (?area=, or "near Draper" in the words);
    // the picker's choice replaces it, written into the URL so it wins.
    const url = new URL(window.location.href);
    if (url.pathname === "/search" && (url.searchParams.has("area") || url.searchParams.has("q"))) {
      url.searchParams.set("area", area ? area.label : "any");
      url.searchParams.delete("page");
      startTransition(() => router.replace(`${url.pathname}?${url.searchParams.toString()}`));
      return;
    }
    startTransition(() => router.refresh());
  }

  function onChange(value: string) {
    if (value === ALL) return apply(null);
    if (value === HERE) {
      setStatus("locating");
      locate().then(
        (area) => {
          setStatus("idle");
          apply(area);
        },
        () => setStatus("denied")
      );
      return;
    }
    const area = areas.find((a) => a.label === value);
    if (area) apply(area);
  }

  const label =
    status === "locating" ? "Finding you…" : pending ? "Updating…" : current ? current.label : "All of Utah";
  // Keep the select showing the current choice; "Near you" isn't in the list.
  const value = current ? (current.label === "Near you" ? HERE : current.label) : ALL;

  return (
    <div className={cn("relative", className)}>
      <label className="relative flex h-full min-h-12 w-full items-center gap-2 px-3 text-[16px] text-foreground">
        <MapPin className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <select
          aria-label="Your area, for stock near you"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value={ALL}>All of Utah</option>
          <option value={HERE}>{current?.label === "Near you" ? "Near you" : "Use my location"}</option>
          <optgroup label="Areas with a state store">
            {areas.map((a) => (
              <option key={a.label} value={a.label}>
                {a.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {status === "denied" ? (
        <p role="status" className="absolute top-full left-0 mt-1 text-xs text-warning">
          Couldn&apos;t get your location. Pick an area instead.
        </p>
      ) : null}
    </div>
  );
}
