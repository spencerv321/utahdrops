import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES = ["Blanton's", "Weller", "peaty scotch under $60", "allocated bourbon"];

/**
 * The one search box. Brand names go to keyword search; questions ("peaty
 * scotch under $60 near me") are answered by AI search on the results page.
 * A plain GET form, so it works before any JavaScript loads.
 */
export function SearchBox({
  defaultValue,
  examples = false,
  autoFocus = false,
  className,
}: {
  defaultValue?: string;
  examples?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <form action="/search" role="search" className="relative">
        <label htmlFor="site-search" className="sr-only">
          Search every bottle, or ask a question
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-[22px] -translate-y-1/2 text-foreground"
        />
        <input
          id="site-search"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder="Blanton's, Weller, peaty scotch…"
          className="h-14 w-full rounded-2xl border-2 border-foreground bg-card pr-4 pl-12 text-[17px] shadow-[0_3px_0_var(--foreground)] outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring/30 sm:h-16 sm:text-lg"
        />
      </form>
      {examples ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Try</span>
          {EXAMPLES.map((ex) => (
            <Link
              key={ex}
              href={`/search?q=${encodeURIComponent(ex)}`}
              className="inline-flex h-9 items-center rounded-full border bg-card px-3.5 font-medium transition-colors hover:border-foreground"
            >
              {ex}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
