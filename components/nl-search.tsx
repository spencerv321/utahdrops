"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { categoryLabel, displayName, formatPrice, productTitle } from "@/lib/format";
import type { NlResult } from "@/lib/nl/search";

type State =
  | { kind: "loading" }
  | { kind: "done"; result: NlResult }
  | { kind: "unavailable" }
  | { kind: "error" };

/**
 * AI answers for question-style searches, shown above the keyword results.
 * Runs once per query. Without an API key (or over the rate limit) the API
 * says "fallback" and this renders nothing: keyword results stand alone.
 */
export function AskResults({ query, keywordHits }: { query: string; keywordHits: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let coords: { lat: number; lng: number } | null = null;
        if (/near me|nearby|close to me/i.test(query) && "geolocation" in navigator) {
          coords = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 4000);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timer);
                resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              },
              () => {
                clearTimeout(timer);
                resolve(null);
              },
              { maximumAge: 600_000, timeout: 3500 }
            );
          });
        }
        const res = await fetch("/api/nl-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, ...(coords ?? {}) }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.fallback) setState({ kind: "unavailable" });
        else if (data.error) setState({ kind: "error" });
        else setState({ kind: "done", result: data as NlResult });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  if ((state.kind === "unavailable" || state.kind === "error") && keywordHits > 0) return null;

  if (state.kind === "unavailable" || state.kind === "error") {
    return (
      <div className="border-y py-8 text-center text-muted-foreground">
        No bottle names match those words. Try just the brand or style, like
        &ldquo;laphroaig&rdquo; or &ldquo;scotch&rdquo;, then use the filters.
      </div>
    );
  }

  return (
    <section aria-live="polite" className="space-y-3 rounded-lg bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" aria-hidden />
        {state.kind === "loading" ? "Reading your question…" : "Matches for your question"}
      </p>

      {state.kind === "loading" ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-raised motion-safe:animate-pulse" />
          ))}
        </div>
      ) : null}

      {state.kind === "done" ? <Answer result={state.result} /> : null}
    </section>
  );
}

function Answer({ result }: { result: NlResult }) {
  return (
    <div className="space-y-3">
      {/* Show what the model understood, so a wrong guess is easy to spot. */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Searched for</span>
        {result.interpretation.map((chip) => (
          <span key={chip} className="rounded-sm bg-raised px-2 py-0.5">
            {chip}
          </span>
        ))}
      </div>

      {result.mode === "stores" ? (
        <div className="grid gap-3 md:grid-cols-3">
          {result.stores.map((group) => (
            <div key={group.store_id} className="border-t pt-3">
              <p className="font-semibold">
                {group.store_name}
                <span className="ml-1.5 font-normal text-muted-foreground">{group.distance_mi} mi</span>
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                {group.address}, {group.city}
              </p>
              {group.products.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches at this store.</p>
              ) : (
                <ul className="space-y-1.5">
                  {group.products.map((p) => (
                    <li key={p.csc} className="flex items-baseline justify-between gap-2 text-sm">
                      <Link prefetch={false} href={`/product/${p.csc}`} className="font-medium hover:underline">
                        {displayName(p.name)}
                      </Link>
                      <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatPrice(p.current_price)} · {p.qty_at_store}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : result.products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matched that. Try loosening the price or category.</p>
      ) : (
        <ul className="divide-y border-y">
          {result.products.map((p) => (
            <li key={p.csc}>
              <Link prefetch={false}
                href={`/product/${p.csc}`}
                className="flex min-h-14 items-center justify-between gap-3 py-2.5 hover:bg-raised/50"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{productTitle(p.name, null)}</span>
                  <span className="block text-xs text-subtle-foreground">{categoryLabel(p.category)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="w-16 text-right font-medium tabular-nums">{formatPrice(p.current_price)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
