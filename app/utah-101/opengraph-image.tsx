import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";

export const alt = "Utah 101: how alcohol works in Utah, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { fonts, bg } = await ogAssets();
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Independent, not DABS">
        <Kicker>Utah 101</Kicker>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 100, lineHeight: 1 }}>
          <div style={{ display: "flex" }}>How alcohol works</div>
          <div style={{ display: "flex", fontStyle: "italic", color: C.amber }}>in Utah.</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 820, lineHeight: 1.35 }}>
          Liquor stores, grocery beer, bars, drawings and the .05 limit, in plain English.
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
