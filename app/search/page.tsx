import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCategories, getWatchedSet, searchProducts, searchTokens } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { SearchBox } from "@/components/search-box";
import { SearchControls } from "@/components/search-controls";
import { ProductList } from "@/components/product-list";
import { AskResults } from "@/components/nl-search";
import { looksLikeQuestion, roughQuery } from "@/lib/nl/intent";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  category?: string;
  status?: string;
  instock?: string;
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
  const supabase = await createClient();
  const filters = {
    category: params.category,
    status: params.status,
    inStock: params.instock === "1",
    sort: params.sort as never,
    page: parseInt(params.page ?? "1", 10) || 1,
  };
  const [exact, categories, { data: { user } }] = await Promise.all([
    searchProducts({ q, ...filters }),
    getCategories(),
    supabase.auth.getUser(),
  ]);
  // A question rarely matches product names word for word ("peaty scotch
  // under $60"), so fall back to its nouns plus any price cap or status.
  const rough = exact.total === 0 && searchTokens(q).length >= 2 ? roughQuery(q) : null;
  const results =
    rough && (rough.q || rough.status)
      ? await searchProducts({
          ...filters,
          q: rough.q,
          maxPrice: rough.maxPrice,
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

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{q ? `Search results for ${q}` : "Search every bottle"}</h1>
      <SearchBox defaultValue={q} autoFocus={!q} />
      <Suspense>
        <SearchControls categories={categories} />
      </Suspense>

      {ask ? <AskResults key={q} query={q} keywordHits={results.total} /> : null}

      {results.total > 0 || !ask ? (
        <section className="space-y-3" aria-label="Results">
          <p className="text-sm text-muted-foreground">
            {roughLabel
              ? `${results.total.toLocaleString()} bottle${results.total === 1 ? "" : "s"}: ${roughLabel}`
              : q
                ? `${results.total.toLocaleString()} bottle${results.total === 1 ? "" : "s"} match “${q}”`
                : `${results.total.toLocaleString()} bottles`}
            {params.sort ? "" : " · in stock first"}
            {totalPages > 1 ? ` · page ${results.page} of ${totalPages.toLocaleString()}` : ""}
          </p>
          {results.rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              No bottles match. Try just the brand, like &ldquo;eagle rare&rdquo;, or turn off a filter.
            </div>
          ) : (
            <ProductList rows={results.rows} watched={watched} signedIn={!!user} />
          )}
        </section>
      ) : null}

      {totalPages > 1 ? (
        <nav aria-label="Pages" className="flex justify-center gap-2">
          {results.page > 1 ? (
            <Link
              href={pageLink(results.page - 1)}
              className="inline-flex h-11 items-center gap-1 rounded-full border bg-card px-4 font-semibold"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
          ) : null}
          {results.page < totalPages ? (
            <Link
              href={pageLink(results.page + 1)}
              className="inline-flex h-11 items-center gap-1 rounded-full border bg-card px-4 font-semibold"
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
