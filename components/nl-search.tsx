"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { displayName, formatPrice } from "@/lib/format";
import type { NlResult } from "@/lib/nl/search";

const EXAMPLES = [
  "high end white wine near me",
  "peaty scotch under $60",
  "cheap mezcal in stock",
  "allocated bourbon",
];

export function NlSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NlResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let coords: { lat: number; lng: number } | null = null;
      if (/near me|nearby|close to me/i.test(q) && "geolocation" in navigator) {
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
        body: JSON.stringify({ query: q, ...(coords ?? {}) }),
      });
      const data = await res.json();
      if (data.fallback) {
        router.push(`/?q=${encodeURIComponent(q)}`);
        return;
      }
      if (data.error) throw new Error(data.error);
      setResult(data as NlResult);
    } catch {
      setError("Smart search hit a snag — try the regular search below.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) run(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask in plain English — “high end white wine near me”"
          className="h-11 bg-background text-base"
        />
        <Button type="submit" disabled={loading} className="h-11 px-5">
          {loading ? "Thinking…" : "Ask"}
        </Button>
      </form>

      {!result && !loading ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                setQuery(ex);
                run(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Searched for:</span>
            {result.interpretation.map((chip) => (
              <Badge key={chip} variant="secondary" className="font-normal">
                {chip}
              </Badge>
            ))}
            <button
              type="button"
              className="ml-1 text-xs text-muted-foreground underline"
              onClick={() => setResult(null)}
            >
              clear
            </button>
          </div>

          {result.mode === "stores" ? (
            <div className="grid gap-4 md:grid-cols-3">
              {result.stores.map((group) => (
                <div key={group.store_id} className="rounded-lg border bg-background p-3">
                  <div className="mb-2">
                    <div className="text-sm font-semibold">
                      {group.store_name}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {group.distance_mi} mi
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {group.address}, {group.city}
                    </div>
                  </div>
                  {group.products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matches at this store.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {group.products.map((p) => (
                        <li key={p.csc} className="flex items-baseline justify-between gap-2 text-sm">
                          <Link href={`/product/${p.csc}`} className="hover:underline">
                            {displayName(p.name)}
                          </Link>
                          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {formatPrice(p.current_price)} · {p.qty_at_store}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y rounded-lg border bg-background">
              {result.products.length === 0 ? (
                <li className="p-4 text-sm text-muted-foreground">
                  Nothing matched that. Try loosening the price or category.
                </li>
              ) : (
                result.products.map((p) => (
                  <li key={p.csc} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/product/${p.csc}`} className="text-sm font-medium hover:underline">
                        {displayName(p.name)}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.category}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={p.status} />
                      <span className="w-16 text-right tabular-nums">{formatPrice(p.current_price)}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
