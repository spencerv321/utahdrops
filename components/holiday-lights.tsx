import { useId } from "react";
import { cn } from "@/lib/utils";

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
