import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getCategories, getNearby, getWatchedSet, searchProducts, searchTokens } from "@/lib/queries";
import { getArea, getAreaOptions } from "@/lib/area-server";
import { NEARBY_MILES, nearLabel } from "@/lib/area";
import { getCurrentUser } from "@/lib/supabase/server";
import { SearchBox } from "@/components/search-box";
import { SearchControls } from "@/components/search-controls";
import { ProductList } from "@/components/product-list";
import { SearchShown, type SearchTrack } from "@/components/search-track";
import { searchListKey } from "@/lib/search-list";
import { AskResults } from "@/components/nl-search";
import { looksLikeQuestion, roughQuery } from "@/lib/nl/intent";
import { parseTasteText } from "@/lib/taste/parse";
import { isTasteSearch, TYPE_LABELS } from "@/lib/taste/request";
import { TasteResults } from "@/components/taste-results";
import { getFreshness } from "@/lib/queries";
import { categoryFilterLabel, groupBySlug, groupOf } from "@/lib/categories";
import { STATUS_LABELS } from "@/lib/config";

export const dynamic = "force-dynamic";

interface SearchParams {
  [key: string]: string | string[] | undefined;
  q?: string;
  category?: string;
  group?: string;
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
  const [area, categories, areas] = await Promise.all([getArea(), getCategories(), getAreaOptions()]);
  // ?group= is a broad type ("vodka"); ?category= (a DABS category) narrows it.
  const group = groupBySlug(params.group);
  const filters = {
    category: params.category,
    categoryGroup: group ? categories.filter((c) => groupOf(c)?.slug === group.slug) : undefined,
    status: params.status,
    inStock: params.instock === "1",
    sale: params.sale === "1",
    maxPrice: Number(params.max) > 0 ? Number(params.max) : undefined,
    sort: params.sort as never,
    page: parseInt(params.page ?? "1", 10) || 1,
    near: area ? { lat: area.lat, lng: area.lng, miles: NEARBY_MILES } : undefined,
  };
  const [exact, user, catalogAsOf] = await Promise.all([
    searchProducts({ q, ...filters }),
    getCurrentUser(),
    getFreshness(),
  ]);

  // Taste picks: descriptive wine requests ("white, not too dry, under $30"),
  // the "Help me choose" panel, or follow-ups. Exact names that match stay
  // plain name search. The model step only runs when the rules left words
  // unread and nothing matched by name.
  const typed = q ? parseTasteText(q, areas.map((a) => a.label)) : null;
  const taste = isTasteSearch(typed, params, exact.total, !!process.env.ANTHROPIC_API_KEY);
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
  const cscs = results.rows.map((r) => r.csc);
  const [watched, nearby] = await Promise.all([
    getWatchedSet(user?.id, cscs),
    area ? getNearby(cscs.filter((_, i) => results.rows[i].in_stock), area, NEARBY_MILES) : Promise.resolve(undefined),
  ]);

  // Questions go to AI search; so do multi-word searches keyword search can't match.
  // The search bar's area control shows the taste request's area when it has
  // one ("near Draper" typed, or ?area=), so the two never disagree.
  const tasteAreaLabel = taste ? tasteArea(params, typed?.request.area ?? null) : undefined;
  const barArea =
    tasteAreaLabel === undefined
      ? area
      : tasteAreaLabel === null
        ? null
        : (areas.find((a) => a.label.toLowerCase() === tasteAreaLabel.toLowerCase()) ?? area);
  const ask = !taste && q.length >= 2 && (looksLikeQuestion(q) || exact.total === 0) && searchTokens(q).length >= 2;
  const roughLabel =
    results !== exact
      ? [rough?.q, rough?.status === "A" ? "allocated" : rough?.status === "L" ? "limited" : "", rough?.maxPrice ? `under $${rough.maxPrice}` : "", rough?.status ? "" : "in stock"]
          .filter(Boolean)
          .join(" · ")
      : null;

  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));
  // Search analytics (discover_events surface "search"): which list, how many
  // matches (0 = zero-result search), and each row's rank across pages.
  const source = results !== exact ? "search:rough" : q ? "search:exact" : "search:browse";
  const track: SearchTrack = {
    source,
    query: q,
    results: results.total,
    offset: (results.page - 1) * results.pageSize,
    listKey: searchListKey(source, params, area, results.total),
  };
  const searched = q !== "" || Object.keys(params).some((k) => k !== "page" && k !== "q");
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
  // Removing a style keeps its broad type ("Imported vodka" → "Vodka").
  function categoryUp(category: string) {
    const next = new URLSearchParams(
      Object.entries(params).filter(([k, v]) => typeof v === "string" && k !== "category" && k !== "page") as [string, string][]
    );
    const g = groupOf(category);
    if (g && g.slug !== "other") next.set("group", g.slug);
    return `/search?${next.toString()}`;
  }
  const pills = [
    params.category
      ? { key: "category", label: categoryFilterLabel(params.category), href: categoryUp(params.category) }
      : group
        ? { key: "group", label: group.label }
        : null,
    filters.maxPrice ? { key: "max", label: `Under $${filters.maxPrice}` } : null,
    params.status ? { key: "status", label: `DABS listing: ${STATUS_LABELS[params.status] ?? params.status}` } : null,
  ].filter((p): p is { key: string; label: string; href?: string } => !!p);

  return (
    <div className="space-y-5 pt-1">
      <h1 className="sr-only">{q ? `Search results for ${q}` : "Search every bottle"}</h1>
      <SearchBox
        defaultValue={q}
        autoFocus={!q && pills.length === 0}
        areas={areas}
        area={barArea}
        hidden={{ category: params.category, group: params.group, instock: params.instock, sale: params.sale, max: params.max, sort: params.sort }}
      />
      <div className="space-y-3">
        <Suspense>
          <SearchControls categories={categories} />
        </Suspense>
        {pills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {pills.map((p) => (
              <Link prefetch={false}
                key={p.key}
                href={p.href ?? without(p.key)}
                aria-label={`Remove filter: ${p.label}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-md bg-raised px-2.5 hover:bg-card"
              >
                {p.label}
                <X className="size-3.5 text-muted-foreground" aria-hidden />
              </Link>
            ))}
            <Link prefetch={false}
              href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
              className="min-h-9 px-1 leading-9 text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear all
            </Link>
          </div>
        ) : null}
      </div>

      {searched && !(taste && !q) ? <SearchShown track={track} /> : null}

      {ask ? <AskResults key={q} query={q} keywordHits={results.total} /> : null}

      {taste ? (
        <Suspense fallback={<TasteLoading />}>
          <TasteResults
            q={q}
            typed={typed}
            params={params}
            pickerArea={area}
            areas={areas}
            userId={user?.id}
            catalogAsOf={catalogAsOf}
          />
        </Suspense>
      ) : null}

      {taste && !q ? (
        <p className="text-sm text-muted-foreground">
          Want every bottle, not just the picks?{" "}
          <Link prefetch={false} href={browseHref(params)} className="text-foreground underline decoration-primary underline-offset-4">
            Browse all in-stock {tasteTypeLabel(params)}
          </Link>
        </p>
      ) : (taste ? results.total > 0 : results.total > 0 || !ask) ? (
        <section className="space-y-2" aria-label="Results">
          {taste ? <h2 className="pt-2 text-[15px] font-medium">All matches for your words (not taste-ranked)</h2> : null}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {roughLabel
              ? `${results.total.toLocaleString()} bottle${results.total === 1 ? "" : "s"}: ${roughLabel}`
              : q
                ? `${results.total.toLocaleString()} match${results.total === 1 ? "" : "es"} for “${q}”`
                : `${results.total.toLocaleString()} bottles`}
            {params.sort ? "" : q ? " · best match first" : area ? ` · ${nearLabel(area)} first` : " · in stock first"}
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
            <ProductList
              rows={results.rows}
              watched={watched}
              signedIn={!!user}
              area={area}
              nearby={nearby}
              track={track}
            />
          )}
        </section>
      ) : null}

      {totalPages > 1 ? (
        <nav aria-label="Pages" className="flex justify-center gap-2 pt-2">
          {results.page > 1 ? (
            <Link prefetch={false}
              href={pageLink(results.page - 1)}
              className="inline-flex h-11 items-center gap-1 rounded-md border px-4 hover:border-input"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
          ) : null}
          {results.page < totalPages ? (
            <Link prefetch={false}
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

function TasteLoading() {
  return (
    <div className="space-y-2 rounded-lg bg-card p-4 sm:p-5" aria-hidden>
      <div className="h-5 w-64 rounded bg-raised motion-safe:animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-md bg-raised motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

const GROUP_FOR_TYPE: Record<string, string> = { white: "white-wine", red: "red-wine", rose: "rose", sparkling: "sparkling" };

/** Ordinary browse for the guided panel's kind of wine and budget. */
function browseHref(params: SearchParams): string {
  const next = new URLSearchParams({ instock: "1" });
  const wine = typeof params.wine === "string" ? params.wine : "";
  if (GROUP_FOR_TYPE[wine]) next.set("group", GROUP_FOR_TYPE[wine]);
  if (typeof params.max === "string" && Number(params.max) > 0) next.set("max", params.max);
  return `/search?${next.toString()}`;
}

function tasteTypeLabel(params: SearchParams): string {
  const wine = typeof params.wine === "string" ? params.wine : "";
  const label = TYPE_LABELS[wine as keyof typeof TYPE_LABELS];
  const max = typeof params.max === "string" && Number(params.max) > 0 ? ` under $${params.max}` : "";
  return `${label ? (wine === "rose" ? "rosés" : label.toLowerCase() + "s") : "wines"}${max}`;
}

/** The taste request's own area: ?area= wins over typed words; undefined = none set (use the cookie). */
function tasteArea(params: SearchParams, typedArea: string | null): string | null | undefined {
  const fromUrl = typeof params.area === "string" ? params.area : undefined;
  if (fromUrl === "any") return null;
  if (fromUrl) return fromUrl;
  if (typedArea && typedArea !== "me") return typedArea;
  return undefined;
}
