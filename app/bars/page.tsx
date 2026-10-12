import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { checkedLabel } from "@/components/utah-101";
import { BAR_GROUPS, BARS_PATH, barSources, groupOfType, type BarClaim, type BarGroupKey } from "@/lib/bars";
import { getBars, makerAt, type BarRow } from "@/lib/bars-query";
import { displayName } from "@/lib/licensees";
import { makerPath } from "@/lib/makers";
import { articlePath } from "@/lib/utah-101";
import { CONTACT_EMAIL } from "@/lib/config";
import { cn } from "@/lib/utils";

// Reads the licensees table (refreshed weekly).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Utah Bars & Taverns: Every Licensed Bar, Tavern and Beer Venue",
  description:
    "Every bar, tavern, beer-only venue and airport lounge DABS licenses in Utah, by county and town, with what each license means: 21+, food rules, beer only and hours.",
  alternates: { canonical: BARS_PATH },
  openGraph: {
    title: "Bars & taverns in Utah",
    description: "Every licensed bar, tavern and beer venue, with the house rules each license type sets.",
    url: BARS_PATH,
  },
};

type Props = { searchParams: Promise<{ type?: string; county?: string; q?: string }> };

export default async function BarsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { rows, pulledAt } = await getBars();
  const type = BAR_GROUPS.some((g) => g.key === sp.type) ? (sp.type as BarGroupKey) : null;
  const counties = [...new Set(rows.map((r) => r.county).filter(Boolean) as string[])].sort();
  const county = counties.includes(sp.county ?? "") ? sp.county! : null;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 60);
  const shown = rows.filter(
    (r) =>
      (!type || groupOfType(r.type)?.key === type) &&
      (!county || r.county === county) &&
      (!q || `${r.business_name} ${r.city ?? ""} ${r.address ?? ""}`.toLowerCase().includes(q))
  );
  const notes = new Map(barSources().map((s, i) => [s.id, i + 1]));
  const byPlace = groupBy(shown, (r) => `${r.county ?? "Unknown county"}|${r.city ?? ""}`);
  const href = (p: { type?: string | null; county?: string | null }) => {
    const u = new URLSearchParams();
    const t = p.type === undefined ? type : p.type;
    const c = p.county === undefined ? county : p.county;
    if (t) u.set("type", t);
    if (c) u.set("county", c);
    if (q) u.set("q", q);
    const s = u.toString();
    return s ? `${BARS_PATH}?${s}` : BARS_PATH;
  };

  return (
    <div className="space-y-10 pt-2 sm:pt-6">
      <header className="max-w-3xl space-y-3">
        <p className="kicker text-primary">Where to drink</p>
        <h1 className="text-5xl leading-[0.95] sm:text-7xl">
          Bars &amp; taverns <span className="italic text-primary">in Utah</span>
        </h1>
        <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">
          Every bar, tavern, beer-only venue and airport lounge that DABS currently licenses
          <Ref n={notes.get("licenseeList")!} />, by county and town. In Utah the license decides the house rules
          (who gets in, whether you need to eat, beer only or a full bar), so each type&apos;s rules are below.
          Restaurants aren&apos;t listed: they can only serve you if you&apos;re dining.
        </p>
        <p className="text-sm text-subtle-foreground">
          {rows.length.toLocaleString()} licenses
          {pulledAt ? ` · DABS list read ${checkedLabel(pulledAt.toISOString().slice(0, 10))}` : ""} · refreshed weekly
        </p>
      </header>

      <section aria-labelledby="rules-title" className="space-y-4">
        <h2 id="rules-title" className="sr-only">
          House rules by license type
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {BAR_GROUPS.map((g) => (
            <div key={g.key} className="rounded-lg border bg-card p-4">
              <p className="font-display text-2xl leading-none">{g.label}</p>
              <ul className="mt-2 space-y-1 text-[15px] leading-relaxed">
                {g.rules.map((r, i) => (
                  <li key={i}>
                    <Claim c={r} notes={notes} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          More on hours, pours and ID in{" "}
          <Link prefetch={false} href={articlePath("bars-and-restaurants")} className="underline underline-offset-4">
            Utah 101: bars &amp; restaurants
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="list-title" className="space-y-4">
        <h2 id="list-title" className="font-display text-[2rem] leading-none sm:text-4xl">
          The list
        </h2>
        <nav aria-label="Filter by type" className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip href={href({ type: null })} active={!type} label="All" n={rows.filter((r) => !county || r.county === county).length} />
          {BAR_GROUPS.map((g) => (
            <Chip
              key={g.key}
              href={href({ type: g.key })}
              active={type === g.key}
              label={g.label}
              n={rows.filter((r) => groupOfType(r.type)?.key === g.key && (!county || r.county === county)).length}
            />
          ))}
        </nav>
        <form action={BARS_PATH} className="flex flex-col gap-2 sm:flex-row">
          {type ? <input type="hidden" name="type" value={type} /> : null}
          <select
            name="county"
            defaultValue={county ?? ""}
            aria-label="County"
            className="h-12 rounded-md border border-input bg-raised px-3 text-[15px] sm:w-56"
          >
            <option value="">All counties</option>
            {counties.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or town"
            aria-label="Name or town"
            className="h-12 w-full rounded-md border border-input bg-raised px-3 text-[15px] sm:flex-1"
          />
          <button type="submit" className="h-12 rounded-md border border-input px-5 text-[15px] hover:border-primary">
            Show
          </button>
        </form>

        <p className="text-sm text-subtle-foreground" aria-live="polite">
          {shown.length.toLocaleString()} {shown.length === 1 ? "place" : "places"}
        </p>

        {[...byPlace].map(([key, list]) => {
          const [cty, city] = key.split("|");
          return (
            <section key={key} className="space-y-1">
              <h3 className="kicker pt-3 text-muted-foreground">
                {city ? `${city} · ` : ""}
                {cty}
              </h3>
              <ul className="divide-y border-y">
                {list.map((r) => (
                  <BarItem key={r.license_number} r={r} />
                ))}
              </ul>
            </section>
          );
        })}
      </section>

      <section aria-labelledby="sources-title" className="max-w-3xl space-y-3 border-t pt-6">
        <h2 id="sources-title" className="font-display text-3xl leading-none">
          Sources
        </h2>
        <p className="text-sm text-muted-foreground">
          The list is DABS&apos;s own license data, read weekly; a license on it means the place may serve, not that
          it&apos;s open or good. Names and addresses are as DABS has them. House rules come from DABS and the Utah Code
          (checked with Utah 101). Corrections:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-subtle-foreground">
          {barSources().map(({ id, source: s }, i) => (
            <li key={id} id={`source-${i + 1}`} className="scroll-mt-20">
              <a href={s.url} rel="noopener" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-primary">
                {s.title}
              </a>
              {" · "}
              {s.publisher}
              {s.date ? `, ${s.date}` : ""}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function BarItem({ r }: { r: BarRow }) {
  const maker = makerAt(r);
  const year = r.original_issue_date?.slice(0, 4);
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[16px] font-medium">{displayName(r.business_name)}</span>
          {r.new_this_month ? <span className="text-[12px] font-medium text-success">New this month</span> : null}
        </span>
        <span className="block text-[13px] text-subtle-foreground">
          {groupOfType(r.type)?.one ?? r.type}
          {r.type === "Licensed as a Bar (LB)" ? " (DABS: “Licensed as a Bar”)" : ""}
          {year ? ` · licensed since ${year}` : ""}
          {maker ? (
            <>
              {" · "}
              <Link prefetch={false} href={makerPath(maker.slug)} className="underline underline-offset-4">
                Utah maker: {maker.name}
              </Link>
            </>
          ) : null}
        </span>
        {r.address ? <span className="block text-[13px] text-muted-foreground">{r.address}</span> : null}
      </span>
      {r.address ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.business_name}, ${r.address}`)}`}
          rel="noopener"
          aria-label={`Map: ${displayName(r.business_name)}`}
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <MapPin className="size-4" aria-hidden />
        </a>
      ) : null}
    </li>
  );
}

function Claim({ c, notes }: { c: BarClaim; notes: Map<string, number> }) {
  return (
    <>
      {c.t}
      {c.s.map((id) => (
        <Ref key={id} n={notes.get(id)!} />
      ))}
    </>
  );
}

function Ref({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 text-[0.7em]">
      <a href={`#source-${n}`} aria-label={`Source ${n}`} className="text-primary no-underline hover:underline">
        [{n}]
      </a>
    </sup>
  );
}

function Chip({ href, active, label, n }: { href: string; active: boolean; label: string; n: number }) {
  return (
    <Link
      prefetch={false}
      href={href}
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

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}
