import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";
import { MAKERS, citiesLabel, getMaker, kindsLabel } from "@/lib/makers";

export const alt = "A Utah maker on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return MAKERS.map((m) => ({ slug: m.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const [{ fonts, bg }, { slug }] = await Promise.all([ogAssets(), params]);
  const maker = getMaker(slug);
  const title = maker?.name ?? "Made in Utah";
  const titleSize = title.length > 40 ? 72 : title.length > 26 ? 86 : 100;
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Utah makers · Independent, not DABS">
        <Kicker>{maker ? `${kindsLabel(maker.kinds)} · ${citiesLabel(maker)}` : "Utah makers"}</Kicker>
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: titleSize, lineHeight: 1.02, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: C.muted, maxWidth: 900, lineHeight: 1.35 }}>
          {maker?.summary.t ?? "Breweries, distilleries, wineries and cideries."}
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
