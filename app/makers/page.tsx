import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { checkedLabel } from "@/components/utah-101";
import {
  KIND_LABEL,
  KIND_ORDER,
  MAKERS,
  MAKERS_CHECKED,
  MAKERS_PATH,
  MAKER_SOURCES,
  REGIONS,
  citiesLabel,
  kindsLabel,
  makerPath,
  regionOf,
  type MakerKind,
} from "@/lib/makers";
import { getMakerShelfCounts } from "@/lib/maker-products";
import { CONTACT_EMAIL } from "@/lib/config";
import { cn } from "@/lib/utils";

// Shelf counts are live.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Utah Breweries, Distilleries, Wineries & Cideries: The Makers Directory",
  description:
    "Every Utah brewery, distillery, winery and cidery on DABS's Proudly Utah list: what they make, taprooms and tasting rooms, bottles to go, what locals say, and their bottles in state liquor stores.",
  alternates: { canonical: MAKERS_PATH },
  openGraph: {
    title: "Utah makers: breweries, distilleries, wineries & cideries",
    description: "Every local maker on DABS's Proudly Utah list, with sourced facts and their bottles in state stores.",
    url: MAKERS_PATH,
  },
};

type Props = { searchParams: Promise<{ kind?: string }> };

export default async function MakersIndex({ searchParams }: Props) {
  const { kind: kindParam } = await searchParams;
  const kind = KIND_ORDER.includes(kindParam as MakerKind) ? (kindParam as MakerKind) : null;
  const counts = await getMakerShelfCounts().catch(() => new Map<string, number>());
  const shown = MAKERS.filter((m) => !kind || m.kinds.includes(kind));
  const listings = MAKERS.flatMap((m) => m.dabs);
  const licensedOnly = MAKERS.filter((m) => m.dabs.length === 0).length;

  return (
    <div className="space-y-12 pt-2 sm:pt-6">
      <header className="max-w-3xl space-y-3">
        <p className="kicker text-primary">Utah makers</p>
        <h1 className="text-5xl leading-[0.95] sm:text-7xl">
          Made <span className="italic text-primary">in Utah</span>
        </h1>
        <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">
          Every brewery, distillery, winery and cidery on DABS&apos;s{" "}
          <a href={MAKER_SOURCES.dabsProudlyUtah.url} rel="noopener" className="underline underline-offset-4">
            Proudly Utah
          </a>{" "}
          list, plus licensed makers that list leaves out: what they make, whether you can visit, whether they sell
          bottles to go, what locals say, and which of their bottles are on state store shelves near you. Every fact
          is sourced.
        </p>
      </header>

      <nav aria-label="Filter by kind" className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <KindLink kind={null} active={kind === null} label="All" n={MAKERS.length} />
        {KIND_ORDER.map((k) => (
          <KindLink
            key={k}
            kind={k}
            active={kind === k}
            label={KIND_LABEL[k].many}
            n={MAKERS.filter((m) => m.kinds.includes(k)).length}
          />
        ))}
      </nav>

      {REGIONS.map((r) => {
        const inRegion = shown.filter((m) => regionOf(m) === r.key);
        if (inRegion.length === 0) return null;
        return (
          <section key={r.key} aria-labelledby={`region-${r.key}`} className="max-w-3xl space-y-3">
            <h2 id={`region-${r.key}`} className="font-display text-[2rem] leading-none sm:text-4xl">
              {r.label}
            </h2>
            <ul className="divide-y border-y">
              {inRegion.map((m) => {
                const n = counts.get(m.slug) ?? 0;
                return (
                  <li key={m.slug}>
                    <Link prefetch={false} href={makerPath(m.slug)} className="group flex gap-4 py-4">
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-medium leading-snug group-hover:text-primary">{m.name}</span>
                        <span className="block text-[13px] text-subtle-foreground">
                          {kindsLabel(m.kinds)} · {citiesLabel(m)}
                          {n > 0 ? (
                            <span className="text-success">
                              {" "}
                              · {n} {n === 1 ? "bottle" : "bottles"} in state stores
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-[15px] text-muted-foreground">{m.summary.t}</span>
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="max-w-3xl text-sm text-subtle-foreground">
        DABS lists {listings.length} makers ({KIND_ORDER.map((k) => `${listings.filter((d) => d.kind === k).length} ${KIND_LABEL[k].many.toLowerCase()}`).join(", ")}
        ) on Proudly Utah; a few are one business listed twice, so they share a page here.
        {licensedOnly > 0
          ? ` ${licensedOnly} more hold a DABS manufacturing license but aren't on that list; we found them in DABS's license list.`
          : ""}{" "}
        Sources read {checkedLabel(MAKERS_CHECKED)}.
        &ldquo;Bottles in state stores&rdquo; counts listings on a store shelf statewide at the latest catalog check.
        Utah Drops is independent and isn&apos;t affiliated with DABS or any maker. Corrections are welcome at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}

function KindLink({ kind, active, label, n }: { kind: MakerKind | null; active: boolean; label: string; n: number }) {
  return (
    <Link
      prefetch={false}
      href={kind ? `${MAKERS_PATH}?kind=${kind}` : MAKERS_PATH}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-sm transition-colors",
        active ? "border-primary bg-primary/12" : "border-border hover:border-input"
      )}
    >
      {label}
      <span className="text-subtle-foreground tabular-nums">{n}</span>
    </Link>
  );
}
