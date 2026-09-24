import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared pieces for the 1200×630 share cards (`opengraph-image` routes), in
 * the site's look: espresso, cream and amber, Instrument Serif headlines, and
 * the toned Park City Main Street photo.
 *
 * Satori (behind `next/og`) needs TTF/OTF fonts and PNG/JPEG images, so the
 * fonts (static cuts of the site's Google fonts, OFL) and pre-toned JPEG
 * backgrounds live in `assets/` and are read from disk once per instance.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export const C = {
  bg: "#15100d",
  cream: "#f3e8d6",
  muted: "#bcab95",
  subtle: "#a3917c",
  amber: "#e7ae4b",
  brand: "#6b1a24",
  brandMuted: "#e2c3bd",
  success: "#86d3a2",
  border: "#3a2f27",
};

const cwd = process.cwd();
const dataUri = (buf: Buffer) => `data:image/jpeg;base64,${buf.toString("base64")}`;

// Literal paths so file tracing ships these with the functions.
const assets = Promise.all([
  readFile(join(cwd, "assets/fonts/InstrumentSerif-Regular.ttf")),
  readFile(join(cwd, "assets/fonts/InstrumentSerif-Italic.ttf")),
  readFile(join(cwd, "assets/fonts/InstrumentSans-400.ttf")),
  readFile(join(cwd, "assets/fonts/InstrumentSans-600.ttf")),
  readFile(join(cwd, "assets/og/og-bg.jpg")),
  readFile(join(cwd, "assets/og/og-bg-dim.jpg")),
]).then(([serif, serifItalic, sans, sansSemi, bg, bgDim]) => ({
  fonts: [
    { name: "Serif", data: serif, style: "normal" as const, weight: 400 as const },
    { name: "Serif", data: serifItalic, style: "italic" as const, weight: 400 as const },
    { name: "Sans", data: sans, style: "normal" as const, weight: 400 as const },
    { name: "Sans", data: sansSemi, style: "normal" as const, weight: 600 as const },
  ],
  bg: dataUri(bg),
  bgDim: dataUri(bgDim),
}));

export async function ogAssets() {
  return assets;
}

/** The glass mark, as on the site (inline SVG renders in Satori). */
function GlassMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6.7 13.4 H17.3 L16.7 19.1 A2.1 2.1 0 0 1 14.6 21 H9.4 A2.1 2.1 0 0 1 7.3 19.1 Z" fill={C.amber} />
      <path
        d="M5.2 4 H18.8 L16.7 19.1 A2.1 2.1 0 0 1 14.6 21 H9.4 A2.1 2.1 0 0 1 7.3 19.1 Z"
        stroke={C.cream}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <GlassMark size={40} />
      <div style={{ display: "flex", fontFamily: "Serif", fontSize: 48, color: C.cream, lineHeight: 1 }}>
        Utah&nbsp;<span style={{ fontStyle: "italic" }}>Drops</span>
      </div>
    </div>
  );
}

/** Full-bleed card: background photo, wordmark top-left, content, footer line. */
export function OgCard({
  background,
  children,
  footer,
}: {
  background?: string;
  children: React.ReactNode;
  footer: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        background: C.bg,
        color: C.cream,
        fontFamily: "Sans",
      }}
    >
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={background} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "56px 72px 52px" }}>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>{children}</div>
        <div style={{ display: "flex", fontSize: 24, color: C.muted }}>{footer}</div>
      </div>
    </div>
  );
}

export function Kicker({ children, color = C.amber }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: 4,
        textTransform: "uppercase",
        color,
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}
