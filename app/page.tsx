import { Suspense } from "react";
import Link from "next/link";
import { getCategories, getFreshness, searchProducts } from "@/lib/queries";
import { ProductTable } from "@/components/product-table";
import { SearchControls } from "@/components/search-controls";
import { NlSearch } from "@/components/nl-search";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatAsOf } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  category?: string;
  status?: string;
  instock?: string;
  sort?: string;
  page?: string;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [results, categories, freshness] = await Promise.all([
    searchProducts({
      q: params.q,
      category: params.category,
      status: params.status,
      inStock: params.instock === "1",
      sort: params.sort as never,
      page: params.page ? parseInt(params.page, 10) : 1,
    }),
    getCategories(),
    getFreshness(),
  ]);

  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));
  const pageLink = (page: number) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][]
    );
    next.set("page", String(page));
    return `/?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <section className="space-y-1 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Every bottle in Utah&apos;s state stores
        </h1>
        <p className="text-sm text-muted-foreground">
          Stock and prices as of {formatAsOf(freshness)} MT.
        </p>
      </section>

      <NlSearch />

      <Suspense>
        <SearchControls categories={categories} />
      </Suspense>

      <div className="flex items-baseline justify-between text-sm text-muted-foreground">
        <span>
          {results.total.toLocaleString()} product{results.total === 1 ? "" : "s"}
        </span>
        {totalPages > 1 ? (
          <span>
            Page {results.page} of {totalPages.toLocaleString()}
          </span>
        ) : null}
      </div>

      <ProductTable rows={results.rows} />

      {totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          {results.page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageLink(results.page - 1)}>
                <ChevronLeft className="size-4" />
                Previous
              </Link>
            </Button>
          ) : null}
          {results.page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageLink(results.page + 1)}>
                Next
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
