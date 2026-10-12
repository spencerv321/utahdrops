import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaPicker } from "@/components/area-picker";
import { ProductList } from "@/components/product-list";
import { checkedLabel } from "@/components/utah-101";
import {
  ClaimText,
  MakerPlaces,
  MakerSection,
  MakerSources,
  MakerWebsite,
  footnotes,
} from "@/components/makers";
import {
  KIND_LABEL,
  makerChecked,
  MAKERS_PATH,
  MAKER_SOURCES,
  citiesLabel,
  getMaker,
  hasCatalogLink,
  kindsLabel,
  makerPath,
  type Maker,
} from "@/lib/makers";
import { getMakerProducts } from "@/lib/maker-products";
import { getAreaOptions, getPageArea } from "@/lib/area-server";
import { NEARBY_MILES, nearLabel } from "@/lib/area";
import { getNearby, getWatchedSet } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { SITE_NAME, SITE_URL } from "@/lib/config";

// Live stock: rendered per request.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ area?: string }> };

const SCHEMA_TYPE: Record<string, string> = {
  brewery: "Brewery",
  distillery: "Distillery",
  winery: "Winery",
  cidery: "LocalBusiness",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const maker = getMaker((await params).slug);
  if (!maker) return { title: "Not found" };
  const title = `${maker.name}: ${kindsLabel(maker.kinds)} in ${citiesLabel(maker)}, Utah`;
  const description = `${maker.summary.t} What they make, visiting, bottles to go, what locals say, and their bottles in Utah state liquor stores.`;
  return {
    title,
    description,
    alternates: { canonical: makerPath(maker.slug) },
    openGraph: { type: "article", siteName: SITE_NAME, title: maker.name, description: maker.summary.t, url: makerPath(maker.slug) },
    twitter: { card: "summary_large_image", title: maker.name, description: maker.summary.t },
  };
}

export default async function MakerPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const maker = getMaker(slug);
  if (!maker) notFound();

  const [{ area }, areas, products, user] = await Promise.all([
    getPageArea(sp.area),
    getAreaOptions(),
    getMakerProducts(maker),
    getCurrentUser(),
  ]);
  const inStock = products.listed.filter((p) => p.in_stock).map((p) => p.csc);
  const [nearby, watched] = await Promise.all([
    area ? getNearby(inStock, area, NEARBY_MILES) : Promise.resolve(undefined),
    getWatchedSet(user?.id, [...products.listed, ...products.other].map((p) => p.csc)),
  ]);
  const notes = footnotes(maker);
  const pkg = notes.get("dabsPackageAgencies");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(maker)).replace(/</g, "\\u003c") }}
      />
      <article className="mx-auto max-w-3xl space-y-10 pt-2 sm:pt-6">
        <header className="space-y-3">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link prefetch={false} href={MAKERS_PATH} className="hover:text-foreground">
              Utah makers
            </Link>
            <span aria-hidden> / </span>
            <span className="text-foreground">{maker.name}</span>
          </nav>
          <p className="kicker text-primary">
            {kindsLabel(maker.kinds)} · {citiesLabel(maker)}
          </p>
          <h1 className="text-[2.75rem] leading-[0.98] sm:text-6xl">{maker.name}</h1>
          <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">
            <ClaimText claim={maker.summary} notes={notes} />
          </p>
          <div className="grid gap-4 border-y py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <MakerPlaces maker={maker} />
            <MakerWebsite maker={maker} />
          </div>
          <p className="text-sm text-subtle-foreground">
            {maker.dabs.length > 0 ? (
              <>
                On DABS&apos;s{" "}
                <a href={MAKER_SOURCES.dabsProudlyUtah.url} rel="noopener" className="underline underline-offset-4">
                  Proudly Utah
                </a>{" "}
                list as{" "}
                {maker.dabs.map((d, i) => (
                  <span key={i}>
                    {i > 0 ? " and " : ""}
                    {d.listedAs} ({KIND_LABEL[d.kind].one.toLowerCase()}, {d.address})
                  </span>
                ))}
                .
              </>
            ) : (
              <>
                Not on DABS&apos;s Proudly Utah list. Licensed by DABS (
                <a href={MAKER_SOURCES.licenseeList.url} rel="noopener" className="underline underline-offset-4">
                  license list
                </a>
                ):{" "}
                {(maker.licenses ?? []).map((l, i) => (
                  <span key={l.number}>
                    {i > 0 ? "; " : ""}
                    {l.type} {l.number}, {l.address}, since {l.since.slice(0, 4)}
                  </span>
                ))}
                .
              </>
            )}{" "}
            Sources read {checkedLabel(makerChecked(maker))}.
          </p>
        </header>

        <MakerSection id="makes" title="What they make" claims={maker.makes} notes={notes} empty={`We couldn't confirm more than the DABS ${maker.dabs.length > 0 ? "listing" : "license"} yet.`} />
        <MakerSection
          id="visit"
          title="Visiting"
          claims={maker.visit}
          notes={notes}
          empty="We couldn't confirm taproom or tasting-room details from a source yet. Check their website or call before you go."
        />
        <MakerSection
          id="to-go"
          title="Bottles to go"
          claims={maker.toGo}
          notes={notes}
          empty="Their own sources don't say whether they sell bottles or cans to go. Ask before you go."
        >
          <p className="text-sm text-muted-foreground">
            Utah lets a brewery, winery or distillery sell its own packaged products on site through a &ldquo;Type 5&rdquo;
            package agency
            {pkg ? (
              <sup className="ml-0.5 text-[0.7em]">
                <a href={`#source-${pkg}`} aria-label={`Source ${pkg}`} className="text-primary no-underline hover:underline">
                  [{pkg}]
                </a>
              </sup>
            ) : null}
            ; anything else comes from a state liquor store.
          </p>
        </MakerSection>
        <MakerSection
          id="locals"
          title="What locals say"
          claims={maker.locals}
          notes={notes}
          empty="We haven't found local press or reader polls about them yet."
        >
          <p className="text-sm text-subtle-foreground">
            Summarized in our words from local press and reader polls. We don&apos;t copy reviews.
          </p>
        </MakerSection>

        {maker.notes.length > 0 ? (
          <section aria-labelledby="notes-title" className="space-y-3">
            <h2 id="notes-title" className="font-display text-[2rem] leading-none">
              From our visits
            </h2>
            {maker.notes.map((n, i) => (
              <figure key={i} className="rounded-lg border bg-card p-4">
                <blockquote className="text-[17px] leading-relaxed">{n.text}</blockquote>
                <figcaption className="mt-2 text-sm text-muted-foreground">
                  {n.by}, {checkedLabel(n.date)}
                </figcaption>
              </figure>
            ))}
          </section>
        ) : null}

        <section aria-labelledby="stores-title" className="space-y-4">
          <div className="space-y-1">
            <h2 id="stores-title" className="font-display text-[2rem] leading-none">
              In Utah state liquor stores
            </h2>
            <p className="text-[15px] text-muted-foreground">
              {hasCatalogLink(maker)
                ? "Bottles DABS lists for this maker, by vendor or brand name. Statewide counts are from the latest catalog check; store-by-store counts show when each was checked."
                : "We haven't matched any DABS listings to this maker."}
            </p>
          </div>
          {products.listed.length > 0 ? (
            <>
              <AreaPicker areas={areas} current={area} urlParam="area" className="rounded-md border border-input bg-raised sm:w-64" />
              {area ? (
                <p className="text-sm text-subtle-foreground">
                  Showing stock {nearLabel(area)} (within {NEARBY_MILES} miles).
                </p>
              ) : null}
              <ProductList rows={products.listed} watched={watched} signedIn={!!user} area={area} nearby={nearby} />
            </>
          ) : hasCatalogLink(maker) ? (
            <p className="text-[15px]">None of their bottles are regular state-store listings right now.</p>
          ) : null}
          {products.other.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer text-[15px] text-primary underline-offset-4 hover:underline">
                {products.other.length} special-order or past listing{products.other.length === 1 ? "" : "s"}
              </summary>
              <div className="mt-3">
                <ProductList rows={products.other} watched={watched} signedIn={!!user} />
              </div>
            </details>
          ) : null}
        </section>

        <MakerSources maker={maker} checked={makerChecked(maker)} />
      </article>
    </>
  );
}

function jsonLd(maker: Maker) {
  const url = `${SITE_URL}${makerPath(maker.slug)}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": SCHEMA_TYPE[maker.kinds[0]] ?? "LocalBusiness",
      name: maker.name,
      description: maker.summary.t,
      url,
      ...(maker.website ? { sameAs: [maker.website] } : {}),
      address: maker.places
        .filter((p) => p.address)
        .map((p) => ({ "@type": "PostalAddress", streetAddress: p.address, addressLocality: p.city, addressRegion: "UT", addressCountry: "US" })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Utah makers", item: `${SITE_URL}${MAKERS_PATH}` },
        { "@type": "ListItem", position: 2, name: maker.name, item: url },
      ],
    },
  ];
}
