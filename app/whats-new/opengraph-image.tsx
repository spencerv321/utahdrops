import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";

export const alt = "What's new at Utah's state liquor stores: restocks, new listings and price drops, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { fonts, bg } = await ogAssets();
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Independent, not DABS">
        <Kicker>What&apos;s new at DABS</Kicker>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 100, lineHeight: 1 }}>
          <div style={{ display: "flex" }}>Back in stores,</div>
          <div style={{ display: "flex", fontStyle: "italic", color: C.amber }}>new and cheaper.</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 760, lineHeight: 1.35 }}>
          Restocks, new listings and price drops across Utah&apos;s state liquor stores.
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
