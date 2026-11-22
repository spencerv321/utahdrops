import { ArrowRight } from "lucide-react";
import { DiscoverLink } from "@/components/discover-link";
import { HolidayRow } from "@/components/holiday-row";
import { HOLIDAY_GLOW, HolidayLights } from "@/components/holiday-lights";
import { cn } from "@/lib/utils";
import type { Area } from "@/lib/area";
import { nextDropDate } from "@/lib/dabs/allocated";
import { seasonPath, shortDate, upcomingClosures, utahToday, type HolidaySeason } from "@/lib/holiday";
import type { HolidayItem } from "@/lib/holiday-query";

/**
 * Homepage holiday strip, shown only during the season (lib/holiday.ts):
 * the next closure and drop dates, then a few seasonal bottles of different
 * kinds. Outlined and quiet: "Find bottles" stays the one filled button.
 */
export function HolidayStrip({
  season,
  picks,
  total,
  area,
  watched,
  signedIn,
}: {
  season: HolidaySeason;
  picks: HolidayItem[];
  total: number;
  area: Area | null;
  watched: Set<string>;
  signedIn: boolean;
}) {
  const closure = upcomingClosures(season)[0];
  const drop = nextDropDate().toISOString().slice(0, 10);
  const href = seasonPath(season);
  return (
    <section
      className={cn(
        "relative isolate space-y-3 overflow-hidden rounded-lg border border-primary/35 px-4 pt-10 pb-4 sm:px-6 sm:pt-11 sm:pb-5",
        HOLIDAY_GLOW
      )}
      aria-labelledby="holiday-title"
    >
      <HolidayLights className="absolute inset-x-0 top-0 -z-10" />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="kicker text-primary">Holidays {season.year}</p>
          <h2 id="holiday-title" className="mt-1 font-display text-[2rem] leading-none sm:text-4xl">
            The holiday shelf
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {total.toLocaleString()} seasonal bottles and gift sets in stock statewide.
          </p>
        </div>
        <DiscoverLink href={href} source="holiday:guide" className="flex min-h-11 shrink-0 items-center gap-1 text-sm text-foreground hover:text-primary">
          See the holiday guide
          <ArrowRight className="size-4" aria-hidden />
        </DiscoverLink>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
        {closure ? (
          <li>
            <span className="text-muted-foreground">Stores closed </span>
            <span className="font-medium">{shortDate(closure.date)}</span>
            <span className="text-muted-foreground"> ({closure.holiday}) · open until {shortDate(closure.lastDay)}</span>
          </li>
        ) : null}
        <li>
          {drop === utahToday() ? (
            <span className="font-medium">Allocated drop today</span>
          ) : (
            <>
              <span className="text-muted-foreground">Next allocated drop </span>
              <span className="font-medium">{shortDate(drop)}</span>
            </>
          )}
        </li>
      </ul>
      {picks.length > 0 ? (
        <ul className="grid grid-cols-1 divide-y border-t md:grid-cols-2 md:gap-x-8">
          {picks.map((item) => (
            <HolidayRow key={item.csc} item={item} source="holiday:home" area={area} watched={watched.has(item.csc)} signedIn={signedIn} compact showGroup />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
