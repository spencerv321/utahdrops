import { getDataStaleness } from "@/lib/queries";
import { whenLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * When DABS numbers were last pulled (last successful catalog pass, not page
 * load). Green only when fresh; stale data says so in words.
 */
export async function Freshness({ className }: { className?: string }) {
  const { freshness, stale } = await getDataStaleness(24);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", stale ? "bg-warning" : "bg-success")}
        />
        {stale ? (
          <span className="text-warning">Last DABS update {whenLabel(freshness)}. Counts may be out of date.</span>
        ) : (
          <span>Stock &amp; prices from DABS, {whenLabel(freshness)}</span>
        )}
      </span>
      <span aria-hidden>·</span>
      <a href="#about" className="underline decoration-border underline-offset-4 hover:text-foreground">
        Independent, not DABS
      </a>
    </p>
  );
}
