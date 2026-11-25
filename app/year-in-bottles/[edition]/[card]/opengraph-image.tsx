import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";
import { EDITIONS, getEdition, windowLabel } from "@/lib/year-in-bottles-cards";

export const alt = "A card from Utah's Year in Bottles on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return Object.keys(EDITIONS).flatMap((edition) => getEdition(edition)!.cards.map((c) => ({ edition, card: c.slug })));
}

export default async function Image({ params }: { params: Promise<{ edition: string; card: string }> }) {
  const [{ fonts, bg }, { edition, card: slug }] = await Promise.all([ogAssets(), params]);
  const year = getEdition(edition)!;
  const card = year.cards.find((c) => c.slug === slug) ?? year.cards[0];
  const headline = card.headline ?? "";
  const headlineSize = headline.length > 36 ? 72 : 88;
  return new ImageResponse(
    (
      <OgCard background={bg} footer={`utahdrops.com · Utah's Year in Bottles · ${windowLabel(year.snapshot)}`}>
        <Kicker>{card.kicker}</Kicker>
        {card.big ? (
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: 168, lineHeight: 0.9, color: C.amber }}>{card.big}</div>
        ) : (
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: headlineSize, lineHeight: 1.02, maxWidth: 1000 }}>{headline}</div>
        )}
        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: C.cream, maxWidth: 1000, lineHeight: 1.3 }}>
          {card.big ? card.body.charAt(0).toUpperCase() + card.body.slice(1) : card.body}
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
