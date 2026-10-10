import { ImageResponse } from "next/og";
import { C, Kicker, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";
import { ogBottlePhoto } from "@/lib/og-bottle";
import { getProduct, getStoreAvailability } from "@/lib/queries";
import { categoryLabel, formatPrice, formatQty, productTitle, sizeLabel, unitWord } from "@/lib/format";

export const alt = "Price and stock at Utah state liquor stores, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });

export default async function Image({ params }: { params: Promise<{ csc: string }> }) {
  const { csc } = await params;
  const [{ fonts, bg, bgDim }, product, stores, photo] = await Promise.all([
    ogAssets(),
    getProduct(csc),
    getStoreAvailability(csc),
    ogBottlePhoto(csc),
  ]);

  if (!product) {
    return new ImageResponse(
      (
        <OgCard background={bg} footer="utahdrops.com · Independent, not DABS">
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: 100 }}>Find the bottle.</div>
        </OgCard>
      ),
      { ...size, fonts }
    );
  }

  const title = productTitle(product.name, product.size_ml);
  // With a bottle photo on the right, the text gets ~700px instead of 1000.
  const titleSize = photo
    ? title.length > 26 ? 64 : title.length > 18 ? 80 : 96
    : title.length > 34 ? 72 : title.length > 22 ? 88 : 104;
  // Bottle photo bottom-right on the card: at most 470 tall and 250 wide, so it
  // clears the text column (~700px from the left padding).
  const bottleW = photo ? Math.min(250, Math.round((photo.width / photo.height) * 470)) : 0;
  const bottle = photo ? (
    <img
      src={photo.src}
      alt=""
      width={bottleW}
      height={Math.round((photo.height / photo.width) * bottleW)}
      style={{ position: "absolute", right: 80, bottom: 64 }}
    />
  ) : undefined;
  const kicker = [categoryLabel(product.category), sizeLabel(product.size_ml)].filter(Boolean).join(" · ");
  const storeCount = stores.filter((s) => s.qty > 0).length;
  const units = product.store_qty ?? 0;
  const unit = unitWord(product.category, product.size_ml, units);
  const available = product.in_stock && units > 0;
  const availability = !available
    ? "Not in stores right now"
    : storeCount > 0
      ? `In ${storeCount} ${storeCount === 1 ? "store" : "stores"} · ${formatQty(units)} ${unit}`
      : `In stores · ${formatQty(units)} ${unit} statewide`;

  return new ImageResponse(
    (
      <OgCard background={bgDim} aside={bottle} footer={`Stock & price from DABS, ${shortDate(product.last_seen)} · utahdrops.com`}>
        {kicker ? <Kicker maxWidth={photo ? 700 : undefined}>{kicker}</Kicker> : null}
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: titleSize, lineHeight: 1, maxWidth: photo ? 700 : 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 34 }}>
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: 76, lineHeight: 1 }}>
            {formatPrice(product.current_price)}
          </div>
          <div style={{ display: "flex", width: 2, height: 56, background: C.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 600, color: available ? C.success : C.muted }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: available ? C.success : C.subtle }} />
            {availability}
          </div>
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
