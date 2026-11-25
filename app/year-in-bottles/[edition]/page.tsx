import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YearInBottles } from "@/components/year-in-bottles";
import { EDITIONS, editionPath, getEdition, windowLabel } from "@/lib/year-in-bottles-cards";

// Frozen snapshots: only these editions exist.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(EDITIONS).map((edition) => ({ edition }));
}

type Props = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const year = getEdition((await params).edition);
  if (!year) return { title: "Not found" };
  const title = "Utah's Year in Bottles";
  const description = `What Utah's state liquor stores sold, ${windowLabel(year.snapshot)}: the #1 bottle, the biggest month, the riser, Utah brands and more, from DABS's own sales reports.`;
  return {
    title,
    description,
    alternates: { canonical: editionPath(year.snapshot.edition) },
    openGraph: { title, description, url: editionPath(year.snapshot.edition) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function YearInBottlesPage({ params }: Props) {
  const year = getEdition((await params).edition);
  if (!year) notFound();
  return <YearInBottles snapshot={year.snapshot} cards={year.cards} />;
}
