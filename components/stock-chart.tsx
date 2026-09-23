"use client";

import { useMemo, useRef, useState } from "react";

export interface StockPoint {
  t: number; // ms
  v: number; // bottles in stores statewide
}

const DAY = 86400_000;
const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });

/**
 * Statewide bottles over time as a step line (history is delta-encoded, so each
 * value holds until the next observation). Single series: no legend, the
 * heading names it. Hover/touch shows the value for that day.
 */
export function StockChart({ points, until }: { points: StockPoint[]; until: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { minT, maxT, maxV, ticks, path, area } = useMemo(() => {
    const minT = points[0].t;
    const maxT = Math.max(until, points[points.length - 1].t);
    const top = Math.max(...points.map((p) => p.v), 1);
    // Clean y ticks: 0, half, max rounded up to a friendly step.
    const step = top <= 10 ? 5 : top <= 50 ? 25 : top <= 200 ? 50 : top <= 1000 ? 250 : 1000;
    const maxV = Math.ceil(top / step) * step;
    const x = (t: number) => ((t - minT) / (maxT - minT || 1)) * 100;
    const y = (v: number) => 100 - (v / maxV) * 100;
    let d = `M ${x(points[0].t)} ${y(points[0].v)}`;
    for (let i = 1; i < points.length; i++) d += ` H ${x(points[i].t)} V ${y(points[i].v)}`;
    d += ` H 100`;
    return { minT, maxT, maxV, ticks: [maxV, maxV / 2, 0], path: d, area: `${d} V 100 H 0 Z` };
  }, [points, until]);

  const valueAt = (t: number) => {
    let v = points[0].v;
    for (const p of points) if (p.t <= t) v = p.v;
    return v;
  };
  const last = points[points.length - 1].v;
  const xPct = (t: number) => ((t - minT) / (maxT - minT || 1)) * 100;
  const hoverT = hover == null ? null : minT + hover * (maxT - minT);

  function track(clientX: number) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setHover(Math.min(1, Math.max(0, (clientX - box.left) / box.width)));
  }

  return (
    <figure className="space-y-2">
      <div className="flex gap-2">
        {/* y axis: clean ticks in muted text */}
        <div className="flex h-36 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t.toLocaleString()}
            </span>
          ))}
        </div>
        <div
          ref={ref}
          className="relative h-36 flex-1 touch-pan-y"
          onPointerMove={(e) => track(e.clientX)}
          onPointerDown={(e) => track(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {[0, 50, 100].map((g) => (
              <line key={g} x1="0" x2="100" y1={g} y2={g} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} className="fill-chart-1/10" />
            <path
              d={path}
              className="fill-none stroke-chart-1"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* end marker: 8px dot with a 2px surface ring (HTML so it stays round) */}
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-chart-1"
            style={{ left: "100%", top: `${100 - (last / maxV) * 100}%` }}
            aria-hidden
          />
          {hoverT != null ? (
            <>
              <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${hover! * 100}%` }} aria-hidden />
              <span
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-sm"
                style={{ left: `${Math.min(85, Math.max(15, hover! * 100))}%` }}
              >
                <span className="text-muted-foreground">{fmtDay(hoverT)}</span>{" "}
                <strong className="tabular-nums">{valueAt(hoverT).toLocaleString()}</strong> bottles
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="relative ml-9 h-4 text-[11px] text-muted-foreground" aria-hidden>
        <span className="absolute left-0">{fmtDay(minT)}</span>
        {maxT - minT > 20 * DAY ? (
          <span className="absolute -translate-x-1/2" style={{ left: `${xPct(minT + (maxT - minT) / 2)}%` }}>
            {fmtDay(minT + (maxT - minT) / 2)}
          </span>
        ) : null}
        <span className="absolute right-0">Today</span>
      </div>
      <figcaption className="sr-only">
        Bottles in stores statewide from {fmtDay(minT)} to today:{" "}
        {points.map((p) => `${fmtDay(p.t)} ${p.v}`).join(", ")}. Now {last}.
      </figcaption>
    </figure>
  );
}
