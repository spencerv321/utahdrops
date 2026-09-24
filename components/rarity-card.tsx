import type { ProductRarity, RarityTier } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { RatingFeedback } from "@/components/rating-feedback";

const MT = "America/Denver";

const TIERS: Record<RarityTier, { name: string; className: string }> = {
  everyday: { name: "Everyday", className: "bg-raised text-muted-foreground ring-1 ring-border" },
  uncommon: { name: "Uncommon", className: "bg-success-soft text-success" },
  scarce: { name: "Scarce", className: "bg-clearance-soft text-clearance" },
  rare: { name: "Rare", className: "bg-fresh-soft text-fresh" },
  unicorn: { name: "Unicorn", className: "bg-brand text-brand-foreground ring-1 ring-primary" },
};

function day(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: MT });
}

/** The tier badge alone (lists). Words, never color alone. */
export function RarityBadge({ tier, className }: { tier: RarityTier; className?: string }) {
  const t = TIERS[tier];
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase", t.className, className)}>
      {t.name}
    </span>
  );
}

/**
 * Utah Drops availability rating (beta): a collectible-style badge with a
 * plain-language line, and the evidence behind it. Current stock lives in the
 * price panel and "Where to find it", timestamped separately.
 */
export function RarityCard({ csc, rarity }: { csc: string; rarity: ProductRarity }) {
  const tier = rarity.tier ? TIERS[rarity.tier] : null;
  return (
    <section aria-labelledby="rarity-title" className="space-y-3 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {tier ? (
          <span className={cn("rounded-sm px-2.5 py-1 text-[13px] font-semibold tracking-[0.08em] uppercase", tier.className)}>
            {tier.name}
          </span>
        ) : null}
        <p id="rarity-title" className="kicker text-muted-foreground">
          Utah Drops rating · beta
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-lg font-medium">{tier ? rarity.headline : "Not rated yet"}</p>
        <p className="max-w-prose text-[15px] leading-relaxed text-muted-foreground">{rarity.explanation}</p>
      </div>
      <details className="group border-t pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px]">
          What this is based on
          <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
        </summary>
        <ul className="list-disc space-y-1.5 pb-2 pl-5 text-sm leading-relaxed">
          {rarity.evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-subtle-foreground">
          Our reading of public DABS data (monthly sales reports, drawings, allocated drops) and our own stock checks,
          updated {day(rarity.computedAt)}
          {rarity.reviewedOn ? `, reviewed by hand ${day(rarity.reviewedOn)}` : ""}. Not an official DABS rating, and
          entries per bottle aren&apos;t your odds of winning. Current stock is shown separately.
        </p>
      </details>
      <RatingFeedback csc={csc} tier={rarity.tier} />
    </section>
  );
}
