import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "What's new at Utah DABS — restocks, new products, and clearance on BevFinder Utah";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    (
      <OgFrame
        eyebrow="What's new at DABS"
        title="Restocks, new arrivals & clearance."
        subtitle="The feed of every change across Utah's state liquor inventory."
      />
    ),
    { ...size }
  );
}
