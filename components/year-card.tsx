import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { YearCard } from "@/lib/year-in-bottles-cards";
import { cn } from "@/lib/utils";

const TONE = {
  plain: "border-border bg-card text-foreground",
  amber: "border-primary bg-primary text-primary-foreground",
  burgundy: "border-brand-raised bg-brand text-brand-foreground",
} as const;

const SUBTLE = {
  plain: "text-subtle-foreground",
  amber: "text-primary-foreground/75",
  burgundy: "text-brand-muted",
} as const;

const BIG = {
  plain: "text-primary",
  amber: "text-primary-foreground",
  burgundy: "text-fresh",
} as const;

const BAR = {
  plain: "bg-primary",
  amber: "bg-primary-foreground",
  burgundy: "bg-fresh",
} as const;

/** One card of the deck: phone-shaped, readable on its own when shared. */
export function YearCardView({
  card,
  index,
  total,
  windowLabel,
  share,
}: {
  card: YearCard;
  index: number;
  total: number;
  windowLabel: string;
  share?: React.ReactNode;
}) {
  const subtle = SUBTLE[card.tone];
  return (
    <article
      aria-labelledby={`card-${card.slug}-title`}
      className={cn("flex aspect-[9/14] w-full flex-col justify-between gap-5 overflow-hidden rounded-xl border p-6", TONE[card.tone])}
    >
      <div className={cn("flex items-center justify-between gap-3 text-xs font-semibold tracking-[0.12em] uppercase", subtle)}>
        <span>{card.kicker}</span>
        <span className="tabular-nums">
          {index + 1} / {total}
        </span>
      </div>

      <div className="space-y-3">
        {card.big ? (
          <p id={`card-${card.slug}-title`} className={cn("font-display text-[3.4rem] leading-[0.95] tabular-nums sm:text-6xl", BIG[card.tone])}>
            {card.big}
          </p>
        ) : null}
        {card.headline ? (
          <h2 id={card.big ? undefined : `card-${card.slug}-title`} className="font-display text-[2.1rem] leading-[1.02] text-balance">
            {card.headline}
          </h2>
        ) : null}
        <p className="text-[15px] leading-snug">{card.body}</p>
        {card.points ? (
          <ul className="space-y-1.5 text-[15px] leading-snug">
            {card.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className={subtle}>
                  ·
                </span>
                {p}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-3">
        {card.chart?.type === "shares" ? (
          <ul className="space-y-1.5" aria-label={card.foot}>
            {card.chart.rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                <span className="truncate">{r.label}</span>
                <span className="h-2 rounded-sm bg-current/10">
                  <span className={cn("block h-2 rounded-sm", BAR[card.tone])} style={{ width: `${Math.max(2, r.share * 100)}%` }} />
                </span>
                <span className={cn("text-right tabular-nums", subtle)}>{Math.round(r.share * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : null}
        {card.chart?.type === "months" ? (
          <MonthBars chart={card.chart} bar={BAR[card.tone]} subtle={subtle} label={card.foot} />
        ) : null}
        {card.cta ? (
          <Link
            prefetch={false}
            href={card.cta.href}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            {card.cta.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
        <div className={cn("flex items-end justify-between gap-3 text-xs leading-snug", subtle)}>
          <p>
            {card.foot}
            <br />
            {windowLabel} · DABS sales reports
          </p>
          {share}
        </div>
      </div>
    </article>
  );
}

function MonthBars({
  chart,
  bar,
  subtle,
  label,
}: {
  chart: { labels: string[]; values: number[]; peak: number };
  bar: string;
  subtle: string;
  label: string;
}) {
  const max = Math.max(...chart.values);
  return (
    <figure aria-label={label} className="space-y-1">
      <div className="grid h-20 grid-cols-12 items-end gap-1">
        {chart.values.map((v, i) => (
          <span
            key={i}
            className={cn("block rounded-t-sm", i === chart.peak ? "bg-current" : bar, i === chart.peak ? "" : "opacity-70")}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <div className={cn("grid grid-cols-12 gap-1 text-center text-[10px]", subtle)}>
        {chart.labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </figure>
  );
}
