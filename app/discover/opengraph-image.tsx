import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";

export const alt = "Worth a look: scarce bottles, returns and price drops at Utah's state liquor stores, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { fonts, bg } = await ogAssets();
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Independent, not DABS">
        <Kicker>Worth a look</Kicker>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 100, lineHeight: 1 }}>
          <div style={{ display: "flex" }}>Hard to find,</div>
          <div style={{ display: "flex", fontStyle: "italic", color: C.amber }}>and in stores now.</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 780, lineHeight: 1.35 }}>
          Scarce bottles, returns after a long absence and real price drops, with when each was checked.
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
