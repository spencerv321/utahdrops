import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { nextDropDate } from "@/lib/dabs/allocated";
import { getDropListSize } from "@/lib/queries";
import { DropAlertSignup } from "@/components/drop-alert-signup";
import { cn } from "@/lib/utils";

const utc = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

/**
 * The next allocated drop as an event ticket: the date on a perforated stub,
 * a small countdown, what "allocated" means, and one action that matches the
 * real state (list not out yet / list posted / drop day).
 */
export async function DropTicket({
  signedIn,
  optedIn,
  size = "compact",
  explain = true,
  className,
}: {
  signedIn: boolean;
  optedIn: boolean;
  size?: "compact" | "large";
  /** Explain "allocated" for newcomers (skip where the page already does). */
  explain?: boolean;
  className?: string;
}) {
  const now = new Date();
  const next = nextDropDate(now);
  const daysOut = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400_000));
  const listSize = await getDropListSize(next.toISOString().slice(0, 10));
  const large = size === "large";
  const countdown = daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `In ${daysOut} days`;

  return (
    <section
      aria-label="Next allocated drop"
      className={cn(
        "ticket flex rounded-lg bg-brand text-brand-foreground",
        large ? "[--stub:min(8.5rem,38%)] sm:[--stub:11rem]" : "[--stub:min(7rem,34%)]",
        className
      )}
    >
      {/* stub: the date is the headline */}
      <div className="flex w-(--stub) shrink-0 flex-col items-center justify-center px-2 py-5 text-center">
        <span className="kicker text-brand-muted">{utc(next, { weekday: "short" })}</span>
        <span
          className={cn(
            "font-display leading-none text-balance",
            large ? "mt-1 text-[2.6rem] sm:text-6xl" : "mt-1 text-[2.1rem]"
          )}
        >
          {utc(next, { month: "short", day: "numeric" })}
        </span>
        <span className="mt-1.5 text-xs text-brand-muted">{countdown}</span>
      </div>
      <div aria-hidden className="ticket-perf my-3 text-brand-muted/35" />
      <div className={cn("min-w-0 flex-1 space-y-2.5 py-4 pr-4 pl-4", large && "sm:py-6 sm:pr-6 sm:pl-6")}>
        <p className="kicker text-primary">Next allocated drop</p>
        {listPosted(listSize) ? (
          <p className={cn("leading-snug", large ? "text-base" : "text-[15px]")}>
            The list is out: {listSize} bottle{listSize === 1 ? "" : "s"} headed to stores.
          </p>
        ) : daysOut === 0 ? (
          <p className="text-[15px] leading-snug">It&apos;s drop day. Bottles go to the stores on the list.</p>
        ) : (
          <p className={cn("leading-snug text-brand-foreground/95", large ? "text-base" : "text-[15px]")}>
            {explain
              ? "DABS\u2019s rarest bottles (think Blanton\u2019s) go to select stores. The list posts about a week before."
              : "The list of bottles and stores posts about a week before. Turn on alerts and we\u2019ll email it the minute it does."}
          </p>
        )}
        {listPosted(listSize) ? (
          <Link
            href="/drops"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            See the list
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <DropAlertSignup signedIn={signedIn} optedIn={optedIn} />
        )}
      </div>
    </section>
  );
}

const listPosted = (n: number) => n > 0;
