import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";
import { ARTICLES, getArticle } from "@/lib/utah-101";

export const alt = "A Utah 101 guide on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const [{ fonts, bg }, { slug }] = await Promise.all([ogAssets(), params]);
  const article = getArticle(slug);
  const title = article?.title ?? "How alcohol works in Utah";
  const titleSize = title.length > 52 ? 64 : title.length > 36 ? 76 : 92;
  return new ImageResponse(
    (
      <OgCard background={bg} footer="utahdrops.com · Utah 101 · Independent, not DABS">
        <Kicker>{`Utah 101 · ${article?.kicker ?? "Guide"}`}</Kicker>
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: titleSize, lineHeight: 1.02, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted, maxWidth: 860, lineHeight: 1.35 }}>
          {article?.ogLine ?? "Plain-English guides, every fact sourced."}
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
