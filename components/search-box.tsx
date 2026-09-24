import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Queries the product handles today: exact names via keyword search, and
// questions via AI search (with a keyword fallback for price caps and styles).
const EXAMPLES = ["Blanton's", "Dry white wine under $20", "Peaty scotch under $60", "Prosecco"];

/**
 * The one search box. A plain GET form to /search, so it works before any
 * JavaScript loads and keeps the query in the URL.
 */
export function SearchBox({
  defaultValue,
  examples = false,
  autoFocus = false,
  hidden,
  className,
}: {
  defaultValue?: string;
  examples?: boolean;
  autoFocus?: boolean;
  /** Filters to carry along when searching again from the results page. */
  hidden?: Record<string, string | undefined>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <form action="/search" role="search" className="relative">
        <label htmlFor="site-search" className="sr-only">
          Search bottles by name, or describe what you want
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
          placeholder="Search by name, or describe it"
          className="h-13 w-full rounded-md border border-input bg-raised pr-4 pl-12 text-[17px] text-foreground outline-none placeholder:text-subtle-foreground focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-14"
        />
        {hidden
          ? Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))
          : null}
      </form>
      {examples ? (
        <p className="flex flex-wrap items-baseline gap-x-1 text-sm text-muted-foreground">
          <span className="mr-1">Try</span>
          {EXAMPLES.map((ex, i) => (
            <span key={ex} className="inline-flex items-baseline">
              <Link
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
    </div>
  );
}
