"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Point = { t: string; visitors: number; pageviews: number; signups: number };
type Metric = "visitors" | "pageviews" | "signups";

const METRICS: { key: Metric; label: string }[] = [
  { key: "visitors", label: "Visitors" },
  { key: "pageviews", label: "Page views" },
  { key: "signups", label: "Sign-ups" },
];

const W = 720;
const H = 200;
const PAD_L = 36;
const PAD_B = 22;
const PAD_T = 8;

function when(t: string, hourly: boolean): string {
  const [date, time] = t.split("T");
  const d = new Date(`${date}T12:00:00Z`);
  if (hourly) {
    const h = Number(time.slice(0, 2));
    return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  }
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((s) => s * p >= v) ?? 10;
  return m * p;
}

/** One metric at a time on one axis; hover or tap a bar for the full numbers. */
export function TrendChart({ points, hourly }: { points: Point[]; hourly: boolean }) {
  const [metric, setMetric] = useState<Metric>("visitors");
  const [hover, setHover] = useState<number | null>(null);

  const max = niceMax(Math.max(0, ...points.map((p) => p[metric])));
  const innerW = W - PAD_L;
  const innerH = H - PAD_B - PAD_T;
  const slot = innerW / Math.max(1, points.length);
  const gap = Math.min(4, slot * 0.25);
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(points.length / (hourly ? 6 : 7));
  const active = hover ?? points.length - 1;
  const p = points[active];
  const total = points.reduce((s, x) => s + x[metric], 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Metric" className="flex gap-1 rounded-md bg-raised p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                metric === m.key ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="text-right text-sm text-muted-foreground" aria-live="polite">
          {p ? (
            <>
              <span className="text-foreground">{when(p.t, hourly)}</span> · {p.visitors.toLocaleString()} visitors ·{" "}
              {p.pageviews.toLocaleString()} views · {p.signups} sign-ups
            </>
          ) : (
            `${total.toLocaleString()} total`
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`${METRICS.find((m) => m.key === metric)?.label} per ${hourly ? "hour" : "day"}, ${total} total`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? "2 4" : undefined} />
            <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--subtle-foreground)">
              {t >= 1000 ? `${t / 1000}k` : t}
            </text>
          </g>
        ))}
        {points.map((pt, i) => {
          const v = pt[metric];
          const x = PAD_L + i * slot + gap / 2;
          const h = Math.max(v ? 2 : 0, y(0) - y(v));
          return (
            <g key={pt.t}>
              <rect
                x={x}
                y={y(0) - h}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 2)}
                fill="var(--primary)"
                opacity={hover == null || hover === i ? 1 : 0.45}
              />
              {/* Full-height hit target, easier than the bar itself. */}
              <rect
                x={PAD_L + i * slot}
                y={PAD_T}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
              />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--subtle-foreground)">
                  {hourly ? when(pt.t, true) : when(pt.t, false).replace(/^\w+, /, "")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
