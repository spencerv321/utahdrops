import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { YearDeck } from "@/components/year-deck";
import { DABS_SALES_URL, monthYear, windowLabel, type YearCard, type YearEdition } from "@/lib/year-in-bottles-cards";

/** /year-in-bottles/<edition> and its per-card share links (same page, opened on that card). */
export function YearInBottles({ snapshot, cards, focus }: { snapshot: YearEdition; cards: YearCard[]; focus?: string }) {
  const label = windowLabel(snapshot);
  return (
    <div className="space-y-8 sm:space-y-12">
      <header className="space-y-3 sm:space-y-4">
        <p className="kicker text-primary">Utah Drops · {label}</p>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-[2.75rem] leading-[0.95] text-balance sm:text-6xl">Utah&apos;s Year in Bottles</h1>
          <ShareButton
            title="Utah's Year in Bottles"
            surface="year"
            path={`/year-in-bottles/${snapshot.edition}`}
            label="Share the whole year"
            className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full border border-input hover:border-primary"
          />
        </div>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-[17px]">
          What Utah&apos;s state liquor stores sold over 12 months, from {monthYear(snapshot.window.from)} through{" "}
          {monthYear(snapshot.window.through)}. Every number comes from DABS&apos;s own monthly sales reports. Swipe through, and
          share the cards you like.
        </p>
      </header>

      <YearDeck cards={cards} edition={snapshot.edition} windowLabel={label} focus={focus} />

      <section aria-labelledby="how-title" className="max-w-2xl space-y-3 border-t pt-6 text-[15px] leading-relaxed text-muted-foreground">
        <h2 id="how-title" className="font-display text-3xl text-foreground">
          How we counted
        </h2>
        <p>
          DABS publishes a{" "}
          <a href={DABS_SALES_URL} className="text-foreground underline decoration-primary underline-offset-4" target="_blank" rel="noreferrer">
            sales report
          </a>{" "}
          every month with each item&apos;s bottles and dollars sold statewide. These cards add up the latest 12 (the newest posted
          when we built this), so it&apos;s a year, not calendar {snapshot.edition}. Reports cover the whole state, not single
          stores or cities.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>&ldquo;Bottles&rdquo; are DABS&apos;s bottle counts, which include cans.</li>
          <li>
            Year-over-year changes compare only the months we have from both years ({snapshot.yoy?.months.length ?? 0} months),
            added together, because single months swing with the calendar.
          </li>
          <li>Style groups (red wine, premixed cocktails) are ours, the same ones search uses.</li>
          <li>
            Utah brands are the makers on our{" "}
            <Link prefetch={false} href="/makers" className="text-foreground underline decoration-primary underline-offset-4">
              Utah makers
            </Link>{" "}
            list. A few of them now brew out of state.
          </li>
          <li>Numbers are frozen as of {snapshot.builtAt}, so a card you share won&apos;t change later.</li>
        </ul>
        <p className="text-sm">
          Utah Drops is independent and not affiliated with DABS. Reports used:{" "}
          {snapshot.sources.map((s, i) => (
            <span key={s.month}>
              {i ? ", " : ""}
              <a href={s.url} className="underline underline-offset-2 hover:text-foreground" target="_blank" rel="noreferrer">
                {s.fiscalLabel}
              </a>
            </span>
          ))}
          .
        </p>
      </section>

      <nav aria-label="Keep going" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link prefetch={false} href="/drops" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium hover:text-primary">
          This month&apos;s allocated drop <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link prefetch={false} href="/discover" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium hover:text-primary">
          Worth a look right now <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link prefetch={false} href="/makers" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium hover:text-primary">
          Utah makers <ArrowRight className="size-4" aria-hidden />
        </Link>
      </nav>
    </div>
  );
}
