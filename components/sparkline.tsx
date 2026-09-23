import type { SnapshotPoint } from "@/lib/queries";

/**
 * Server-rendered SVG step chart of statewide store quantity over time.
 * History is delta-encoded, so we extend each observation until the next one.
 */
export function Sparkline({
  points,
  until,
  width = 640,
  height = 120,
}: {
  points: SnapshotPoint[];
  /** Extend the last value to this time (the latest catalog pass). */
  until?: Date | string | null;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Quantity history builds up after a few days of tracking.
      </div>
    );
  }

  const values = points.map((p) => p.store_qty ?? 0);
  const times = points.map((p) => new Date(p.scraped_at).getTime());
  const minT = times[0];
  const maxT = Math.max(until ? new Date(until).getTime() : 0, times[times.length - 1]);
  const maxV = Math.max(...values, 1);

  const pad = 4;
  const x = (t: number) => pad + ((t - minT) / (maxT - minT || 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / maxV) * (height - pad * 2);

  let d = `M ${x(times[0])} ${y(values[0])}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${x(times[i])} V ${y(values[i])}`;
  }
  d += ` H ${x(maxT)}`;

  const area = `${d} V ${height - pad} H ${x(minT)} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-28 w-full"
      role="img"
      aria-label={`Statewide quantity over time, currently ${values[values.length - 1]}`}
    >
      <path d={area} className="fill-chart-1/15" />
      <path d={d} className="fill-none stroke-chart-1" strokeWidth="2" />
      <circle
        cx={x(maxT)}
        cy={y(values[values.length - 1])}
        r="3"
        className="fill-chart-1"
      />
    </svg>
  );
}
