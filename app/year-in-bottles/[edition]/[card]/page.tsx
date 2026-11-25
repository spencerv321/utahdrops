import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YearInBottles } from "@/components/year-in-bottles";
import { EDITIONS, cardPath, editionPath, getEdition } from "@/lib/year-in-bottles-cards";

// One page per card, so a shared card unfurls with its own image and opens on it.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(EDITIONS).flatMap((edition) => getEdition(edition)!.cards.map((c) => ({ edition, card: c.slug })));
}

type Props = { params: Promise<{ edition: string; card: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edition, card: slug } = await params;
  const year = getEdition(edition);
  const card = year?.cards.find((c) => c.slug === slug);
  if (!year || !card) return { title: "Not found" };
  const title = `${card.kicker} · Utah's Year in Bottles`;
  return {
    title,
    description: card.ogLine,
    // The deck is one page; card links exist for sharing.
    alternates: { canonical: editionPath(edition) },
    openGraph: { title: "Utah's Year in Bottles", description: card.ogLine, url: cardPath(edition, slug) },
    twitter: { card: "summary_large_image", title: "Utah's Year in Bottles", description: card.ogLine },
  };
}

export default async function YearInBottlesCardPage({ params }: Props) {
  const { edition, card: slug } = await params;
  const year = getEdition(edition);
  if (!year || !year.cards.some((c) => c.slug === slug)) notFound();
  return <YearInBottles snapshot={year.snapshot} cards={year.cards} focus={slug} />;
}
