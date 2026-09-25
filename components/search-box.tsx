import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Area } from "@/lib/area";
import { AreaPicker } from "@/components/area-picker";

// Queries the product handles today: exact names via keyword search, wine
// descriptions via taste picks (beta), and other questions via AI search.
const EXAMPLES = ["Blanton's", "White wine, not too dry, under $30", "Peaty scotch under $60", "Prosecco"];

/**
 * The one search box. A plain GET form to /search, so it works before any
 * JavaScript loads and keeps the query in the URL.
 */
export function SearchBox({
  defaultValue,
  examples = false,
  autoFocus = false,
  hidden,
  areas,
  area = null,
  guide,
  className,
}: {
  defaultValue?: string;
  examples?: boolean;
  autoFocus?: boolean;
  /** Filters to carry along when searching again from the results page. */
  hidden?: Record<string, string | undefined>;
  /** With areas: one bar with search, area picker and a search button. */
  areas?: Area[];
  area?: Area | null;
  /** Optional control shown with the examples ("Help me choose"). */
  guide?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <form
        action="/search"
        role="search"
        className={cn(
          areas &&
            "flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0 sm:rounded-lg sm:border sm:border-input sm:bg-raised sm:p-1.5 sm:focus-within:border-primary"
        )}
      >
        <div className="relative sm:flex-1">
          <label htmlFor="site-search" className="sr-only">
            Search a bottle, or describe what you&apos;d like
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="site-search"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            defaultValue={defaultValue}
            autoFocus={autoFocus}
            placeholder={areas ? "Search a bottle, or describe what you’d like" : "Search by name, or describe it"}
            className={cn(
              "h-13 w-full rounded-md border border-input bg-raised pr-4 pl-12 text-[17px] text-foreground outline-none placeholder:text-subtle-foreground focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-14",
              areas && "sm:h-12 sm:border-0 sm:focus-visible:outline-0"
            )}
          />
        </div>
        {areas ? (
          <div className="flex gap-2 sm:gap-1.5">
            <AreaPicker
              areas={areas}
              current={area}
              className="min-w-0 flex-1 rounded-md border border-input bg-raised sm:w-52 sm:flex-none sm:rounded-none sm:border-0 sm:border-l sm:bg-transparent"
            />
            <button
              type="submit"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-primary px-5 text-[16px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Search className="size-[18px]" aria-hidden />
              Find bottles
            </button>
          </div>
        ) : null}
        {hidden
          ? Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))
          : null}
      </form>
      {examples ? (
        <p className="flex flex-wrap items-baseline gap-x-1 text-sm text-muted-foreground">
          <span className="mr-1">Try</span>
          {EXAMPLES.map((ex, i) => (
            <span key={ex} className="inline-flex items-baseline">
              <Link prefetch={false}
                href={`/search?q=${encodeURIComponent(ex)}`}
                className="inline-flex min-h-9 items-center text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
              >
                {ex}
              </Link>
              {i < EXAMPLES.length - 1 ? <span aria-hidden className="px-1.5 text-subtle-foreground">·</span> : null}
            </span>
          ))}
        </p>
      ) : null}
      {guide}
    </div>
  );
}
