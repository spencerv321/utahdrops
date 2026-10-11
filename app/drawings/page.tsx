import type { Metadata } from "next";
import Link from "next/link";
import { drawingTitle, getDrawings, type Drawing, type DrawingItem } from "@/lib/drawings";
import { formatPrice } from "@/lib/format";
import { DABS_RHDP_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Utah DABS drawing odds: Pappy, Antique Collection, DRC",
  description:
    "The odds of winning each Utah DABS rare-bottle drawing, from DABS's own bottle and entry counts, with each bottle compared to the year before.",
  alternates: { canonical: "/drawings" },
};

const n = (v: number) => v.toLocaleString("en-US");

const tidy = drawingTitle;

const odds = (v: number | null) => (v == null ? "—" : v === 1 ? "Everyone" : `1 in ${n(v)}`);

export default async function DrawingsPage() {
  const drawings = await getDrawings();
  const open = drawings.filter((d) => d.section !== "past");
  const lead = drawings.find((d) => d.entriesChange && d.section === "past");

  return (
    <div className="space-y-12 pt-2 sm:pt-6">
      <header className="max-w-3xl space-y-3">
        <p className="kicker text-muted-foreground">Lottery bottles</p>
        <h1 className="text-5xl leading-[0.95] sm:text-6xl">The odds of DABS&apos;s drawings</h1>
        <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">
          Utah&apos;s rarest bottles, like Pappy Van Winkle and the Buffalo Trace Antique Collection, never reach a
          shelf. DABS holds a drawing: you sign up for each bottle, and winners get the right to buy one. DABS posts how
          many bottles and entries each had. We turn that into odds and keep the history after DABS takes a drawing down.
        </p>
        {lead?.entriesChange && (
          <p className="max-w-prose text-[17px] leading-relaxed">
            In the {lead.year} {tidy(lead.name).replace(/\s*\b20\d\d\b\s*/, " ").trim()} drawing, entries were{" "}
            {changeWords(lead.entriesChange.now, lead.entriesChange.before)} {lead.entriesChange.year} for the same
            bottles.
          </p>
        )}
      </header>

      <div className="max-w-3xl rounded-md border px-4 py-3 text-sm">
        {open.length > 0 ? (
          <p>
            <span className="font-medium">Open now:</span> {open.map((d) => tidy(d.name)).join(", ")}.{" "}
            <a className="underline underline-offset-4" href={DABS_RHDP_URL} rel="noopener">
              Enter on DABS
            </a>
            .
          </p>
        ) : (
          <p className="text-muted-foreground">
            No drawing is open right now. DABS announces them on its{" "}
            <a className="underline underline-offset-4" href={DABS_RHDP_URL} rel="noopener">
              drawing page
            </a>
            ; you need a DABS account to enter.
          </p>
        )}
      </div>

      {drawings.length === 0 ? (
        <p className="border-y py-10 text-center text-muted-foreground">No drawings recorded yet.</p>
      ) : (
        drawings.map((d) => <DrawingSection key={d.name} d={d} />)
      )}

      <p className="max-w-3xl text-xs text-subtle-foreground">
        &ldquo;1 in N&rdquo; is entries divided by bottles: your chance on that bottle if each winner gets one bottle and
        everyone enters once. DABS publishes the counts, not the odds. Source:{" "}
        <a className="underline underline-offset-4" href={DABS_RHDP_URL} rel="noopener">
          DABS Rare High Demand Products
        </a>
        . Not affiliated with DABS.
      </p>
    </div>
  );
}

function changeWords(now: number, before: number): string {
  const pct = Math.round((now / before - 1) * 100);
  if (pct === 0) return "about the same as in";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on`;
}

function DrawingSection({ d }: { d: Drawing }) {
  const id = `drawing-${d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="max-w-3xl space-y-3" aria-labelledby={id}>
      <div className="space-y-1">
        <h2 id={id} className="font-display text-[2rem] leading-none sm:text-4xl">
          {tidy(d.name)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {[
            d.section === "current" ? "Open now" : d.section === "future" ? "Coming up" : null,
            `${d.items.length} bottle type${d.items.length === 1 ? "" : "s"}`,
            d.bottles ? `${n(d.bottles)} bottle${d.bottles === 1 ? "" : "s"}` : null,
            d.entriesChange ? `entries ${changeWords(d.entriesChange.now, d.entriesChange.before)} ${d.entriesChange.year}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <ul className="divide-y border-y">
        {d.items.map((it) => (
          <ItemRow key={it.code} it={it} />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ it }: { it: DrawingItem }) {
  const title = tidy(it.name);
  const p = it.previous;
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        {it.listed ? (
          <Link prefetch={false} href={`/product/${it.code}`} className="font-medium underline-offset-4 hover:underline">
            {title}
          </Link>
        ) : (
          <p className="font-medium">{title}</p>
        )}
        <p className="text-[13px] text-muted-foreground">
          {[
            formatPrice(it.price),
            it.bottles != null ? `${n(it.bottles)} bottle${it.bottles === 1 ? "" : "s"}` : null,
            it.entries != null ? `${n(it.entries)} entries` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-2xl leading-none tabular-nums">{odds(it.oneIn)}</p>
        {p && p.oneIn != null && (
          <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
            {p.year}: {odds(p.oneIn)}
          </p>
        )}
      </div>
    </li>
  );
}
