import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";
import { EDITIONS, compact, getEdition, money, windowLabel } from "@/lib/year-in-bottles-cards";

export const alt = "Utah's Year in Bottles: what Utah's state liquor stores sold, from DABS sales reports, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return Object.keys(EDITIONS).map((edition) => ({ edition }));
}

export default async function Image({ params }: { params: Promise<{ edition: string }> }) {
  const [{ fonts, bg }, { edition }] = await Promise.all([ogAssets(), params]);
  const year = getEdition(edition)!;
  const s = year.snapshot;
  return new ImageResponse(
    (
      <OgCard background={bg} footer={`utahdrops.com · ${windowLabel(s)} · From DABS sales reports`}>
        <Kicker>Year in review</Kicker>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 104, lineHeight: 0.98 }}>
          <div style={{ display: "flex" }}>Utah&apos;s Year</div>
          <div style={{ display: "flex", fontStyle: "italic", color: C.amber }}>in Bottles</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 900, lineHeight: 1.35 }}>
          {`${compact(s.totals.units)} bottles and cans, ${money(s.totals.dollars)} in sales. The #1 bottle, the biggest month, and what's rising.`}
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
