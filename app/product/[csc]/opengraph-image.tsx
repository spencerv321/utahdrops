import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { getProduct } from "@/lib/queries";
import { displayName, formatPrice, formatSize } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/config";

export const alt = "Product availability on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ csc: string }> }) {
  const { csc } = await params;
  const product = await getProduct(csc);

  if (!product) {
    return new ImageResponse(
      <OgFrame eyebrow="Product" title="Browse Utah's liquor catalog" subtitle="Search 28,000+ DABS products." />,
      { ...size }
    );
  }

  const status = product.status ? STATUS_LABELS[product.status] ?? product.status : null;
  const sizeLabel = formatSize(product.size_ml);
  const eyebrow = [product.category, sizeLabel].filter(Boolean).join(" · ") || "Utah DABS";
  const subtitle = [status, product.in_stock ? "In stock statewide" : "Out of stock"]
    .filter(Boolean)
    .join(" · ");

  return new ImageResponse(
    (
      <OgFrame
        eyebrow={eyebrow}
        title={displayName(product.name)}
        subtitle={subtitle}
        pill={{ label: formatPrice(product.current_price), tone: product.in_stock ? "good" : "bad" }}
      />
    ),
    { ...size }
  );
}
