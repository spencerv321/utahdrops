/** Instant skeleton while a page's data loads, so taps feel answered. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5 pt-2" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-3/4 rounded-xl bg-secondary" />
      <div className="h-5 w-1/2 rounded-lg bg-secondary" />
      <div className="h-14 rounded-2xl bg-secondary" />
      <div className="space-y-2.5 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-secondary" />
        ))}
      </div>
    </div>
  );
}
