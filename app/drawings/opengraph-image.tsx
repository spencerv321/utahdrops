import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";
import { drawingTitle, getDrawings } from "@/lib/drawings";

export const alt = "The odds of winning Utah DABS's rare-bottle drawings, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
// Drawings change a few times a year; a daily refresh is plenty.
export const revalidate = 86400;

export default async function Image() {
  const { fonts, bg } = await ogAssets();
  // The hardest bottle in the newest finished drawing; plain card if the DB is unreachable.
  let top: { odds: string; name: string; year: number } | null = null;
  try {
    const d = (await getDrawings()).find((x) => x.section === "past" && x.items[0]?.oneIn);
    const it = d?.items[0];
    if (d && it?.oneIn) {
      top = {
        odds: `1 in ${it.oneIn.toLocaleString("en-US")}`,
        name: drawingTitle(it.name),
        year: d.year,
      };
    }
  } catch {
    top = null;
  }

  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Independent, not DABS">
        <Kicker>DABS drawing odds</Kicker>
        {top ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Serif", fontSize: 150, lineHeight: 1, color: C.amber }}>{top.odds}</div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 40, lineHeight: 1.25, maxWidth: 960 }}>
              {`${top.name}, ${top.year} drawing`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: 100, lineHeight: 1 }}>What are the odds?</div>
        )}
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 860, lineHeight: 1.35 }}>
          Every Utah rare-bottle drawing, with each bottle&apos;s odds and how they changed from last year.
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
