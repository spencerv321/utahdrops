import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A line-drawn evergreen sprig with three amber berries, in the same thin
 * stroke as the bottle glyphs. Decorative only (aria-hidden). Needles are
 * computed along two curved stems so the drawing stays light and regular.
 */
type Pt = [number, number];

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function needles(a: Pt, c: Pt, b: Pt, n: number, len: number): string {
  let d = "";
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const [x, y] = quad(a, c, b, t);
    const [x2, y2] = quad(a, c, b, Math.min(1, t + 0.01));
    const ang = Math.atan2(y2 - y, x2 - x);
    const l = len * (1 - t * 0.45);
    for (const side of [-1, 1]) {
      const a2 = ang + side * 0.75;
      d += `M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(a2) * l).toFixed(1)} ${(Math.sin(a2) * l).toFixed(1)}`;
    }
  }
  return d;
}

const STEMS: [Pt, Pt, Pt, number, number][] = [
  [[44, 62], [80, 40], [134, 12], 15, 11],
  [[60, 52], [72, 70], [110, 74], 8, 8],
];
const PATH = STEMS.map(([a, c, b]) => `M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`).join("");
const NEEDLES = STEMS.map(([a, c, b, n, l]) => needles(a, c, b, n, l)).join("");

export function HolidaySprig({ width = 120, className }: { width?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 140 84"
      width={width}
      height={Math.round((width * 84) / 140)}
      fill="none"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85">
        <path d={PATH} />
        <path d={NEEDLES} opacity="0.8" />
      </g>
      <g fill="var(--primary)">
        <circle cx="42" cy="66" r="4" />
        <circle cx="51" cy="70" r="3.2" opacity="0.85" />
        <circle cx="48" cy="60" r="2.6" opacity="0.7" />
      </g>
    </svg>
  );
}

/** A warm amber glow from the top of a holiday surface (candlelight, not snow). */
export const HOLIDAY_GLOW =
  "bg-[radial-gradient(90%_120%_at_85%_0%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_60%)]";

/**
 * A strand of warm lights draped across the top edge: a thin wire in swags,
 * bulbs hanging from it in amber and warm white, each with a soft halo and a
 * slow twinkle (still for reduced motion). Tiled with an SVG pattern so the
 * bulbs stay round at any width. Decorative only.
 */
const SWAG = 132;
const sag = (t: number) => (1 - t) ** 2 * 3 + 2 * (1 - t) * t * 22 + t ** 2 * 3;
const BULBS = [0.22, 0.5, 0.78].map((t, i) => ({ x: SWAG * t, y: sag(t), i }));

export function HolidayLights({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden className={cn("pointer-events-none block h-9 w-full", className)}>
      <defs>
        <filter id={`${id}-glow`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <pattern id={`${id}-swag`} width={SWAG} height="36" patternUnits="userSpaceOnUse">
          <path d={`M0 3Q${SWAG / 2} 41 ${SWAG} 3`} stroke="var(--muted-foreground)" strokeWidth="1" fill="none" opacity="0.5" />
          {BULBS.map((b) => {
            const color = b.i === 1 ? "var(--brand-foreground)" : "var(--primary)";
            return (
              <g key={b.i} className={cn("holiday-twinkle", b.i === 1 && "holiday-twinkle-2", b.i === 2 && "holiday-twinkle-3")}>
                <circle cx={b.x} cy={b.y + 7} r="5" fill={color} opacity="0.55" filter={`url(#${id}-glow)`} />
                <rect x={b.x - 1.6} y={b.y + 0.5} width="3.2" height="2.6" rx="0.6" fill="var(--muted-foreground)" opacity="0.8" />
                <ellipse cx={b.x} cy={b.y + 7} rx="2.6" ry="4" fill={color} />
              </g>
            );
          })}
        </pattern>
      </defs>
      <rect width="100%" height="36" fill={`url(#${id}-swag)`} />
    </svg>
  );
}
