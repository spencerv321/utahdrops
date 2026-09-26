"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { sendDiscoverEvent } from "@/lib/beacon";

/** Search list context carried by result links and watch stars. */
export interface SearchTrack {
  /** "search:exact" | "search:rough" | "search:browse" (lib/discover-events.ts). */
  source: string;
  query: string;
  /** Total matches for this list (all pages). */
  results: number;
  /** Rank of the first row on this page, minus one. */
  offset: number;
}

/**
 * Records that a search result list was shown, once per distinct list and
 * page; results 0 is a zero-result search. Client-side so crawlers rendering
 * the page don't count (bots are dropped at /api/events).
 */
export function SearchShown({ track, page }: { track: SearchTrack; page: number }) {
  const key = `${track.source}|${track.query}|${track.results}|${page}`;
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === key) return;
    sent.current = key;
    sendDiscoverEvent("shown", track.source, null, { results: track.results, query: track.query || undefined });
  }, [key, track]);
  return null;
}

/** A search result link that records the click with its 1-based rank. */
export function SearchResultLink({
  href,
  csc,
  rank,
  track,
  className,
  children,
}: {
  href: string;
  csc: string;
  rank: number;
  track: SearchTrack;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={className}
      onClick={() =>
        sendDiscoverEvent("click", track.source, csc, { rank, results: track.results, query: track.query || undefined })
      }
    >
      {children}
    </Link>
  );
}
