import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";

export const alt = "This week at Utah's state liquor stores: restocks, new listings and price drops, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { fonts, bg } = await ogAssets();
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Independent, not DABS">
        <Kicker>This week</Kicker>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 100, lineHeight: 1 }}>
          <div style={{ display: "flex" }}>The week at</div>
          <div style={{ display: "flex", fontStyle: "italic", color: C.amber }}>Utah&apos;s liquor stores.</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 820, lineHeight: 1.35 }}>
          What&apos;s back on shelves, new listings, real price drops and what sold out, hard-to-find bottles first.
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
