import { ImageResponse } from "next/og";
import { C, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";

export const alt = "Utah Drops: find the bottle, then find the store. Stock and prices at every Utah state liquor store.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { fonts, bg } = await ogAssets();
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Independent, not DABS">
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 112, lineHeight: 0.98 }}>
          <div style={{ display: "flex" }}>Find the bottle.</div>
          <div style={{ display: "flex", fontStyle: "italic", color: C.amber }}>Then find the store.</div>
        </div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 32, color: C.muted, maxWidth: 760, lineHeight: 1.35 }}>
          Stock and prices at every Utah state liquor store, updated several times a day.
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
