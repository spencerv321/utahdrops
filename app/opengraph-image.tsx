import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "BevFinder Utah — search, track, and get alerts for Utah liquor inventory";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    (
      <OgFrame
        eyebrow="Every bottle in Utah's state stores"
        title="Find it, track it, get alerted."
        subtitle="Fast search, price history, restock & allocated-drop alerts."
      />
    ),
    { ...size }
  );
}
