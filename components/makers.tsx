import { ExternalLink, MapPin } from "lucide-react";
import { checkedLabel } from "@/components/utah-101";
import { citedSources, type Claim, type Maker } from "@/lib/makers";
import { CONTACT_EMAIL } from "@/lib/config";

/** Footnote number for each source id, in first-cited order (matches the Sources list). */
export function footnotes(maker: Maker): Map<string, number> {
  return new Map(citedSources(maker).map((s, i) => [s.id, i + 1]));
}

/** A sentence in our words, followed by links to the sources it relies on. */
export function ClaimText({ claim, notes }: { claim: Claim; notes: Map<string, number> }) {
  return (
    <>
      {claim.t}
      {claim.s.map((id) => {
        const n = notes.get(id);
        return n ? (
          <sup key={id} className="ml-0.5 text-[0.7em]">
            <a href={`#source-${n}`} aria-label={`Source ${n}`} className="text-primary no-underline hover:underline">
              [{n}]
            </a>
          </sup>
        ) : null;
      })}
    </>
  );
}

/** One section of a maker page; says plainly when we couldn't confirm anything. */
export function MakerSection({
  id,
  title,
  claims,
  notes,
  empty,
  children,
}: {
  id: string;
  title: string;
  claims: Claim[];
  notes: Map<string, number>;
  empty: string;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2">
      <h2 id={`${id}-title`} className="font-display text-[2rem] leading-none">
        {title}
      </h2>
      {claims.length > 0 ? (
        <ul className="space-y-2 text-[17px] leading-relaxed">
          {claims.map((c, i) => (
            <li key={i}>
              <ClaimText claim={c} notes={notes} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-muted-foreground">{empty}</p>
      )}
      {children}
    </section>
  );
}

/** Addresses, with a map link per place. */
export function MakerPlaces({ maker }: { maker: Maker }) {
  return (
    <ul className="space-y-2">
      {maker.places.map((p, i) => {
        const where = [p.address, p.city, "UT"].filter(Boolean).join(", ");
        return (
          <li key={i} className="flex items-start gap-2 text-[15px]">
            <MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="block font-medium">{p.name}</span>
              <span className="block text-muted-foreground">
                {p.address ? `${p.address}, ` : ""}
                {p.city}
                {" · "}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${maker.name}, ${where}`)}`}
                  rel="noopener"
                  className="underline decoration-border underline-offset-4 hover:decoration-primary"
                >
                  Map
                </a>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function MakerWebsite({ maker }: { maker: Maker }) {
  if (!maker.website) return null;
  const host = maker.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  return (
    <a
      href={maker.website}
      rel="noopener"
      className="inline-flex items-center gap-1 text-[15px] underline decoration-border underline-offset-4 hover:decoration-primary"
    >
      {host}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

export function MakerSources({ maker, checked }: { maker: Maker; checked: string }) {
  return (
    <section aria-labelledby="sources-title" className="space-y-3 border-t pt-6">
      <h2 id="sources-title" className="font-display text-3xl leading-none">
        Sources
      </h2>
      <p className="text-sm text-muted-foreground">
        Every fact on this page comes from one of these, read on {checkedLabel(checked)}. Hours, menus and lineups
        change often, so check {maker.website ? "their website" : "with them"} before you go. Spot something out of
        date? Tell us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-subtle-foreground">
        {citedSources(maker).map(({ id, source: s }, i) => (
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
  );
}

