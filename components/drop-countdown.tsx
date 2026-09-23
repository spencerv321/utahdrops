import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { nextDropDate } from "@/lib/dabs/allocated";
import { getDropListSize } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * "Never miss a drop": days until the next third-Saturday drop, and whether
 * DABS has posted the list yet.
 */
export async function DropCountdown({ size = "compact" }: { size?: "compact" | "large" }) {
  const now = new Date();
  const next = nextDropDate(now);
  const daysOut = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400_000));
  const listSize = await getDropListSize(next.toISOString().slice(0, 10));
  const date = next.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const large = size === "large";

  return (
    <Link
      href="/drops"
      className="group block rounded-3xl bg-brand p-5 text-brand-foreground transition-transform hover:-translate-y-0.5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold tracking-[0.1em] text-gold uppercase">Next allocated drop</p>
          <p className={cn("font-display font-extrabold tracking-[-0.02em]", large ? "text-3xl" : "text-2xl")}>
            {date}
          </p>
          <p className="text-sm text-brand-muted">
            {listSize > 0
              ? `The list is out: ${listSize} bottle${listSize === 1 ? "" : "s"}`
              : "DABS posts the list about a week before"}
          </p>
        </div>
        <div
          className={cn(
            "flex shrink-0 flex-col items-center rounded-2xl bg-brand-raised px-3 py-2",
            large && "px-5 py-3"
          )}
        >
          <span className={cn("font-display leading-none font-extrabold tabular-nums", large ? "text-6xl" : "text-4xl")}>
            {daysOut}
          </span>
          <span className="text-xs text-brand-muted">{daysOut === 1 ? "day" : "days"}</span>
        </div>
      </div>
      <span className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-gold text-[15px] font-bold text-gold-foreground">
        {listSize > 0 ? (
          <>
            See the list
            <ChevronRight className="size-4" aria-hidden />
          </>
        ) : (
          <>
            <Bell className="size-[18px]" aria-hidden />
            Email me when the list posts
          </>
        )}
      </span>
    </Link>
  );
}
