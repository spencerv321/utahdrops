import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getCategories, getWatchedSet, searchProducts, searchTokens } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { SearchBox } from "@/components/search-box";
import { SearchControls } from "@/components/search-controls";
import { ProductList } from "@/components/product-list";
import { AskResults } from "@/components/nl-search";
import { looksLikeQuestion, roughQuery } from "@/lib/nl/intent";
import { categoryLabel } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/config";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  category?: string;
  status?: string;
  instock?: string;
  sale?: string;
  max?: string;
  sort?: string;
  page?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `“${q}” in Utah state liquor stores` : "Search every bottle",
    alternates: { canonical: "/search" },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filters = {
    category: params.category,
    status: params.status,
    inStock: params.instock === "1",
    sale: params.sale === "1",
    maxPrice: Number(params.max) > 0 ? Number(params.max) : undefined,
    sort: params.sort as never,
    page: parseInt(params.page ?? "1", 10) || 1,
  };
  const [exact, categories, user] = await Promise.all([
    searchProducts({ q, ...filters }),
    getCategories(),
    getCurrentUser(),
  ]);
  // A question rarely matches product names word for word ("peaty scotch
  // under $60"), so fall back to its nouns plus any price cap or status.
  const rough = exact.total === 0 && searchTokens(q).length >= 2 ? roughQuery(q) : null;
  const results =
    rough && (rough.q || rough.status)
      ? await searchProducts({
          ...filters,
          q: rough.q,
          maxPrice: filters.maxPrice ?? rough.maxPrice,
          status: filters.status ?? rough.status,
          // Allocated bottles are usually sold out; show them so people can watch.
          inStock: filters.inStock || !rough.status,
        })
      : exact;
  const watched = await getWatchedSet(user?.id, results.rows.map((r) => r.csc));

  // Questions go to AI search; so do multi-word searches keyword search can't match.
  const ask = q.length >= 2 && (looksLikeQuestion(q) || exact.total === 0) && searchTokens(q).length >= 2;
  const roughLabel =
    results !== exact
      ? [rough?.q, rough?.status === "A" ? "allocated" : rough?.status === "L" ? "limited" : "", rough?.maxPrice ? `under $${rough.maxPrice}` : "", rough?.status ? "" : "in stock"]
          .filter(Boolean)
          .join(" · ")
      : null;

  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));
  const pageLink = (page: number) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][]
    );
    next.set("page", String(page));
    return `/search?${next.toString()}`;
  };

  // Active filters as removable pills, so it's always clear why a list is short.
  const without = (key: string) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([k, v]) => typeof v === "string" && k !== key && k !== "page") as [string, string][]
    );
    return `/search?${next.toString()}`;
  };
  const pills = [
    params.category ? { key: "category", label: categoryLabel(params.category) } : null,
    filters.maxPrice ? { key: "max", label: `Under $${filters.maxPrice}` } : null,
    params.status ? { key: "status", label: `DABS listing: ${STATUS_LABELS[params.status] ?? params.status}` } : null,
  ].filter((p): p is { key: string; label: string } => !!p);

  return (
    <div className="space-y-5 pt-1">
      <h1 className="sr-only">{q ? `Search results for ${q}` : "Search every bottle"}</h1>
      <SearchBox
        defaultValue={q}
        autoFocus={!q && pills.length === 0}
        hidden={{ category: params.category, instock: params.instock, sale: params.sale, max: params.max, sort: params.sort }}
      />
      <div className="space-y-3">
        <Suspense>
          <SearchControls categories={categories} />
        </Suspense>
        {pills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {pills.map((p) => (
              <Link
                key={p.key}
                href={without(p.key)}
                aria-label={`Remove filter: ${p.label}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-md bg-raised px-2.5 hover:bg-card"
              >
                {p.label}
                <X className="size-3.5 text-muted-foreground" aria-hidden />
              </Link>
            ))}
            <Link
              href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
              className="min-h-9 px-1 leading-9 text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear all
            </Link>
          </div>
        ) : null}
      </div>

      {ask ? <AskResults key={q} query={q} keywordHits={results.total} /> : null}

      {results.total > 0 || !ask ? (
        <section className="space-y-2" aria-label="Results">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {roughLabel
              ? `${results.total.toLocaleString()} bottle${results.total === 1 ? "" : "s"}: ${roughLabel}`
              : q
                ? `${results.total.toLocaleString()} match${results.total === 1 ? "" : "es"} for “${q}”`
                : `${results.total.toLocaleString()} bottles`}
            {params.sort ? "" : " · in stock first"}
            {totalPages > 1 ? ` · page ${results.page} of ${totalPages.toLocaleString()}` : ""}
          </p>
          {results.rows.length === 0 ? (
            <div className="space-y-2 border-y py-10 text-center">
              <p className="font-display text-2xl">Nothing on the shelf matches that.</p>
              <p className="text-muted-foreground">
                Try just the brand, like &ldquo;eagle rare&rdquo;{pills.length > 0 ? ", or remove a filter" : ""}.
              </p>
            </div>
          ) : (
            <ProductList rows={results.rows} watched={watched} signedIn={!!user} />
          )}
        </section>
      ) : null}

      {totalPages > 1 ? (
        <nav aria-label="Pages" className="flex justify-center gap-2 pt-2">
          {results.page > 1 ? (
            <Link
              href={pageLink(results.page - 1)}
              className="inline-flex h-11 items-center gap-1 rounded-md border px-4 hover:border-input"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
          ) : null}
          {results.page < totalPages ? (
            <Link
              href={pageLink(results.page + 1)}
              className="inline-flex h-11 items-center gap-1 rounded-md border px-4 hover:border-input"
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
