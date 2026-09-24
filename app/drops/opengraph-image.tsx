import { ImageResponse } from "next/og";
import { C, OgCard, OG_CONTENT_TYPE, OG_SIZE, ogAssets } from "@/lib/og";
import { nextDropDate } from "@/lib/dabs/allocated";

export const alt = "The next allocated drop at Utah's state liquor stores, on Utah Drops";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
// The countdown depends on the current date — refresh hourly so it never goes stale.
export const revalidate = 3600;

// Drop dates are UTC midnight; format in UTC so the day doesn't slip (matches the site).
const utc = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

export default async function Image() {
  const { fonts, bgDim } = await ogAssets();
  const now = new Date();
  const next = nextDropDate(now);
  const daysOut = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400_000));
  const countdown = daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `In ${daysOut} days`;

  return new ImageResponse(
    (
      <OgCard background={bgDim} footer="utahdrops.com · Independent, not DABS">
        {/* the drop "ticket", as on the site */}
        <div style={{ display: "flex", width: 1056, height: 330, borderRadius: 20, background: C.brand, color: C.cream }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 300 }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 5, color: C.brandMuted }}>
              {utc(next, { weekday: "short" }).toUpperCase()}
            </div>
            <div style={{ display: "flex", fontFamily: "Serif", fontSize: 110, lineHeight: 1, marginTop: 8 }}>
              {utc(next, { month: "short", day: "numeric" })}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: C.brandMuted, marginTop: 14 }}>{countdown}</div>
          </div>
          <div style={{ display: "flex", width: 0, height: 290, marginTop: 20, borderLeft: `3px dashed ${C.brandMuted}55` }} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 56px" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 600, letterSpacing: 4, color: C.amber }}>
              NEXT ALLOCATED DROP
            </div>
            <div style={{ display: "flex", fontFamily: "Serif", fontSize: 60, lineHeight: 1.05, marginTop: 16 }}>
              DABS’s rarest bottles, at select stores.
            </div>
            <div style={{ display: "flex", fontSize: 28, color: C.brandMuted, marginTop: 18 }}>
              Get the list by email when it posts.
            </div>
          </div>
        </div>
      </OgCard>
    ),
    { ...size, fonts }
  );
}
