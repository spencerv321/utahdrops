/** Instant skeleton while a page's data loads, so taps feel answered. */
export default function Loading() {
  return (
    <div className="space-y-5 pt-2 motion-safe:animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-3/4 rounded-sm bg-card" />
      <div className="h-5 w-1/2 rounded-sm bg-card" />
      <div className="h-14 rounded-md border border-input bg-raised" />
      <div className="divide-y border-y">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
