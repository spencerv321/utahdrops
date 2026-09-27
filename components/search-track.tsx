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
  /** lib/search-list.ts searchListKey: words, filters, sort, page, area and count. */
  listKey: string;
}

/**
 * Records one impression each time a different result list is displayed
 * (track.listKey: any change to words, filters, sort, page or area counts,
 * even with the same number of matches); results 0 is a zero-result list.
 * Client-side so crawlers rendering the page don't count (bots are dropped
 * at /api/events).
 */
export function SearchShown({ track }: { track: SearchTrack }) {
  const key = track.listKey;
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
