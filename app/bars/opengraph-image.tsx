import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";

export const alt = "Bars and taverns in Utah, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { fonts, bg } = await ogAssets();
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · From DABS's license list · Independent, not DABS">
        <Kicker>Where to drink</Kicker>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 100, lineHeight: 1 }}>
          <div style={{ display: "flex" }}>Bars &amp; taverns</div>
          <div style={{ display: "flex", fontStyle: "italic", color: C.amber }}>in Utah.</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 880, lineHeight: 1.35 }}>
          Every licensed bar, tavern and beer venue, and the house rules each license sets.
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
