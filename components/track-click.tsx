"use client";

import { sendDiscoverEvent } from "@/lib/beacon";

/** Counts a click anywhere inside as `source` (discover_events kind "click"). */
export function TrackClick({ source, className, children }: { source: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} onClickCapture={() => sendDiscoverEvent("click", source)}>
      {children}
    </div>
  );
}
