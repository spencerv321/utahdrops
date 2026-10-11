import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ARTICLES, SOURCES, UTAH_101_PATH, articlePath, type SourceId, type Utah101Article } from "@/lib/utah-101";
import { CONTACT_EMAIL } from "@/lib/config";
import { cn } from "@/lib/utils";

/** "Oct 11, 2026" from an ISO date, in Utah time. */
export const checkedLabel = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });

/** Inline link to a cited source (opens DABS, a news story, etc.). */
export function Cite({ id, children }: { id: SourceId; children: React.ReactNode }) {
  return (
    <a href={SOURCES[id].url} rel="noopener" className="underline decoration-border underline-offset-4 hover:decoration-primary">
      {children}
    </a>
  );
}

/** Inline link to another Utah 101 page (optionally a glossary term). */
export function GuideLink({ slug, hash, children }: { slug: string; hash?: string; children: React.ReactNode }) {
  return (
    <Link prefetch={false} href={`${articlePath(slug)}${hash ? `#${hash}` : ""}`} className="underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
      {children}
    </Link>
  );
}

/** A boxed aside: tips, "the short version", warnings. */
export function Callout({ title, tone = "plain", children }: { title: string; tone?: "plain" | "amber" | "brand"; children: React.ReactNode }) {
  return (
    <aside
      className={cn(
        "not-prose my-6 rounded-lg border p-4 sm:p-5",
        tone === "amber" && "border-primary/40 bg-fresh-soft/40",
        tone === "brand" && "border-brand-raised bg-brand/25",
        tone === "plain" && "bg-card"
      )}
    >
      <p className="kicker mb-2 text-primary">{title}</p>
      <div className="space-y-2 text-[15px] leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </aside>
  );
}

/** One myth and what's actually true, for the myths page. */
export function MythCard({ myth, children }: { myth: string; children: React.ReactNode }) {
  return (
    <div className="not-prose grid gap-2 border-t py-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] sm:gap-8">
      <p className="font-display text-2xl leading-tight text-muted-foreground">
        <span className="kicker mb-1 block font-sans text-destructive">Myth</span>
        &ldquo;{myth}&rdquo;
      </p>
      <div className="space-y-2 text-[15px] leading-relaxed">
        <span className="kicker block text-success">Actually</span>
        {children}
      </div>
    </div>
  );
}

/** Small "card" grid used for side-by-side comparisons. */
export function FactGrid({ items }: { items: { label: string; value: React.ReactNode; note?: React.ReactNode }[] }) {
  return (
    <dl className="not-prose my-6 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-y-0 sm:[&>div:nth-child(n+3)]:border-t sm:[&>div:nth-child(odd)]:pr-6 sm:[&>div:nth-child(even)]:border-l sm:[&>div:nth-child(even)]:pl-6">
      {items.map((it) => (
        <div key={it.label} className="py-4">
          <dt className="kicker text-muted-foreground">{it.label}</dt>
          <dd className="mt-1 font-display text-2xl leading-tight">{it.value}</dd>
          {it.note ? <dd className="mt-1 text-sm text-muted-foreground">{it.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Article page frame: breadcrumb, heading, body, sources, what to read next. */
export function ArticleShell({ article, children }: { article: Utah101Article; children: React.ReactNode }) {
  // The next three guides in hub order, wrapping around.
  const at = ARTICLES.findIndex((a) => a.slug === article.slug);
  const next = [1, 2, 3].map((k) => ARTICLES[(at + k) % ARTICLES.length]);
  return (
    <article className="mx-auto max-w-3xl space-y-8 pt-2 sm:pt-6">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link prefetch={false} href={UTAH_101_PATH} className="hover:text-foreground">
            Utah 101
          </Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">{article.name}</span>
        </nav>
        <p className="kicker text-primary">{article.kicker}</p>
        <h1 className="text-[2.75rem] leading-[0.98] sm:text-6xl">{article.title}</h1>
        <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">{article.description}</p>
        <p className="text-sm text-subtle-foreground">
          Sources last checked {checkedLabel(article.checked)} · General info, not legal advice
        </p>
      </header>

      <div className="guide-prose">{children}</div>

      <SourcesList article={article} />

      <section aria-labelledby="next-title" className="space-y-3">
        <h2 id="next-title" className="font-display text-3xl leading-none">
          Keep reading
        </h2>
        <ul className="divide-y border-y">
          {next.map((a) => (
            <li key={a.slug}>
              <Link prefetch={false} href={articlePath(a.slug)} className="group flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block font-medium group-hover:text-primary">{a.name}</span>
                  <span className="block text-sm text-muted-foreground">{a.teaser}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function SourcesList({ article }: { article: Utah101Article }) {
  return (
    <section aria-labelledby="sources-title" className="space-y-3 border-t pt-6">
      <h2 id="sources-title" className="font-display text-3xl leading-none">
        Sources
      </h2>
      <p className="text-sm text-muted-foreground">
        Every fact on this page comes from one of these, re-read on {checkedLabel(article.checked)}. Utah changes its
        alcohol laws most years (new ones usually start in May), so DABS and the{" "}
        <a href="https://le.utah.gov/xcode/Title32B/32B.html" rel="noopener" className="underline underline-offset-4">
          Utah Code
        </a>{" "}
        have the final word. Spot something out of date? Tell us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-subtle-foreground">
        {article.sources.map((id) => {
          const s = SOURCES[id];
          return (
            <li key={id}>
              <a href={s.url} rel="noopener" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-primary">
                {s.title}
              </a>
              {" · "}
              {s.publisher}
              {"date" in s && s.date ? `, ${s.date}` : ""}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
