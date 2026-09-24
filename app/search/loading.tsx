/** Instant skeleton for search: the box, the filters, then result rows. */
export default function Loading() {
  return (
    <div className="space-y-5 pt-1" aria-busy="true" aria-label="Loading results">
      <div className="h-13 rounded-md border border-input bg-raised sm:h-14" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-24 rounded-md border" />
        ))}
      </div>
      <ul className="divide-y border-y motion-safe:animate-pulse">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex gap-3 py-3">
            <div className="h-14 w-10 rounded-sm bg-card" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-2/3 rounded-sm bg-card" />
              <div className="h-3 w-1/3 rounded-sm bg-card" />
              <div className="h-3 w-1/2 rounded-sm bg-card" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
