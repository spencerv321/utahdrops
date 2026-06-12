import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { thirdSaturday } from "@/lib/dabs/allocated";

export const alt = "Utah DABS allocated & rare drop tracker on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
// The countdown depends on the current date — refresh hourly so it never goes stale.
export const revalidate = 3600;

export default function Image() {
  // Next third-Saturday drop (mirrors the countdown on /drops).
  const now = new Date();
  let next = thirdSaturday(now.getUTCFullYear(), now.getUTCMonth());
  if (now.getTime() > next.getTime() + 86400_000) {
    next = thirdSaturday(now.getUTCFullYear(), now.getUTCMonth() + 1);
  }
  const daysOut = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400_000));
  // thirdSaturday() returns UTC midnight; format in UTC so the calendar date
  // doesn't slip back a day (matches the /drops page).
  const dateLabel = next.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return new ImageResponse(
    (
      <OgFrame
        eyebrow="Allocated &amp; Rare"
        title={`Next drop: ${dateLabel}`}
        subtitle="The list, store assignments, and an alert the moment it posts."
        pill={{ label: daysOut === 0 ? "Today" : `${daysOut} days out`, tone: "amber" }}
      />
    ),
    { ...size }
  );
}
