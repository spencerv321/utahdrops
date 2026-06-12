import { SITE_NAME } from "@/lib/config";

/**
 * Shared 1200×630 Open Graph frame for all `opengraph-image` routes.
 *
 * Hard-coded hex (not the app's oklch tokens) because Satori — the renderer
 * behind `next/og` — does not support oklch. Colors below are eyeballed
 * equivalents of the whiskey-amber palette in `globals.css`. No emoji and no
 * custom fonts so generation stays offline-safe at build/request time.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const CREAM = "#f7f1e7";
const MUTED = "#c6b7a1";
const AMBER = "#e0a458";
const AMBER_DEEP = "#b06a2c";

/** A small drawn "rocks glass" mark — divs only, so no emoji font needed. */
function GlassMark({ scale = 1 }: { scale?: number }) {
  const w = 40 * scale;
  return (
    <div
      style={{
        display: "flex",
        width: w,
        height: w * 1.1,
        flexDirection: "column",
        justifyContent: "flex-end",
        borderLeft: `${4 * scale}px solid ${AMBER}`,
        borderRight: `${4 * scale}px solid ${AMBER}`,
        borderBottom: `${4 * scale}px solid ${AMBER}`,
        borderRadius: `${3 * scale}px ${3 * scale}px ${6 * scale}px ${6 * scale}px`,
      }}
    >
      <div style={{ display: "flex", height: "45%", background: AMBER_DEEP, borderRadius: `0 0 ${3 * scale}px ${3 * scale}px` }} />
    </div>
  );
}

export interface OgFrameProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Optional pill (e.g. price, status, countdown) shown beside the subtitle. */
  pill?: { label: string; tone?: "amber" | "good" | "bad" | "neutral" };
}

const PILL_TONES: Record<string, { bg: string; fg: string }> = {
  amber: { bg: "#3a2715", fg: AMBER },
  good: { bg: "#16301f", fg: "#7fd6a0" },
  bad: { bg: "#3a1a16", fg: "#e89a8c" },
  neutral: { bg: "#2b231b", fg: MUTED },
};

/** The default-exported JSX for an ImageResponse. Wrap with new ImageResponse(<OgFrame .../>, {...OG_SIZE}). */
export function OgFrame({ eyebrow, title, subtitle, pill }: OgFrameProps) {
  const titleSize = title.length > 46 ? 60 : title.length > 28 ? 76 : 92;
  const tone = pill ? PILL_TONES[pill.tone ?? "amber"] : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        background: "linear-gradient(135deg, #1c1611 0%, #2c2014 55%, #3d2917 100%)",
        color: CREAM,
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* left accent rail */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 12,
          background: `linear-gradient(180deg, ${AMBER} 0%, ${AMBER_DEEP} 100%)`,
        }}
      />

      {/* wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <GlassMark />
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
          {SITE_NAME}
        </div>
      </div>

      {/* center block */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        {eyebrow ? (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              color: AMBER,
              textTransform: "uppercase",
              letterSpacing: 3,
              marginBottom: 18,
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 1000 }}>
          {title}
        </div>

        {subtitle || pill ? (
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 28 }}>
            {pill && tone ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 700,
                  color: tone.fg,
                  background: tone.bg,
                  padding: "10px 22px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                {pill.label}
              </div>
            ) : null}
            {subtitle ? (
              <div style={{ display: "flex", fontSize: 32, color: MUTED, maxWidth: 880 }}>{subtitle}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* footer */}
      <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
        Utah state liquor inventory · search, history &amp; alerts · not affiliated with Utah DABS
      </div>
    </div>
  );
}
