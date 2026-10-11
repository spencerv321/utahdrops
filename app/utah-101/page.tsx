import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ARTICLES, UTAH_101_PATH, articlePath } from "@/lib/utah-101";

export const metadata: Metadata = {
  title: "Utah 101: How Alcohol Works in Utah",
  description:
    "Plain-English guides to buying and drinking alcohol in Utah: liquor stores and grocery beer, bars and restaurants, the .05 DUI limit, rare-bottle drawings, myths and quirks.",
  alternates: { canonical: UTAH_101_PATH },
  openGraph: {
    title: "Utah 101: how alcohol works in Utah",
    description: "Plain-English guides for visitors, newcomers and anyone who's ever been confused by a Utah liquor store.",
    url: UTAH_101_PATH,
  },
};

/** The three doors in, by who's reading. */
const START = [
  {
    who: "Just visiting",
    line: "Skiing, hiking, in town for a conference? Ten things to know, readable in a lift line.",
    slug: "visitor-guide",
    cta: "The visitor cheat sheet",
  },
  {
    who: "Just moved here",
    line: "Where to buy what, when stores are open, and why the state runs them.",
    slug: "buying-alcohol",
    cta: "How buying works",
  },
  {
    who: "Heard the stories",
    line: "Memberships, 3.2 beer, the Zion curtain: what's outdated, and what's still true.",
    slug: "myths-and-quirks",
    cta: "Myths & quirks",
  },
];

export default function Utah101Hub() {
  return (
    <div className="space-y-14 pt-2 sm:pt-6">
      <header className="max-w-3xl space-y-3">
        <p className="kicker text-primary">Utah 101</p>
        <h1 className="text-5xl leading-[0.95] sm:text-7xl">
          How alcohol works <span className="italic text-primary">in Utah</span>
        </h1>
        <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">
          The state runs the liquor stores, the grocery store sells beer but not wine, and the restaurant wants to know
          if you&apos;re eating. None of it is hard once someone explains it. Plain-English guides for visitors,
          newcomers and anyone new to all of this, with every fact sourced.
        </p>
      </header>

      <section aria-labelledby="start-title" className="space-y-4">
        <h2 id="start-title" className="kicker text-muted-foreground">
          Start here
        </h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {START.map((s) => (
            <li key={s.slug}>
              <Link
                prefetch={false}
                href={articlePath(s.slug)}
                className="group flex h-full flex-col justify-between gap-6 rounded-lg border bg-card p-5 transition-colors hover:border-primary/60"
              >
                <span className="space-y-2">
                  <span className="block font-display text-3xl leading-none">{s.who}</span>
                  <span className="block text-[15px] leading-relaxed text-muted-foreground">{s.line}</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  {s.cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="all-title" className="max-w-3xl space-y-3">
        <h2 id="all-title" className="font-display text-[2rem] leading-none sm:text-4xl">
          All the guides
        </h2>
        <ol className="divide-y border-y">
          {ARTICLES.map((a, i) => (
            <li key={a.slug}>
              <Link prefetch={false} href={articlePath(a.slug)} className="group flex gap-4 py-4">
                <span className="w-6 shrink-0 font-display text-2xl leading-none text-primary tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-medium leading-snug group-hover:text-primary">{a.title}</span>
                  <span className="mt-0.5 block text-[15px] text-muted-foreground">{a.teaser}</span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <p className="max-w-3xl text-sm text-subtle-foreground">
        Utah Drops is independent and isn&apos;t affiliated with DABS. These guides are general information, not legal
        advice; every article lists its sources and the date we last checked them. Laws change most years, and{" "}
        <a href="https://abs.utah.gov" rel="noopener" className="underline underline-offset-4">
          DABS
        </a>{" "}
        has the final word. Please drink responsibly.
      </p>
    </div>
  );
}
