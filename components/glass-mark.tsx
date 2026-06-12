/**
 * BevFinder wordmark glyph — a rocks glass with a whiskey fill.
 * Outline inherits the surrounding text color; the fill is the amber accent.
 * Replaces the 🥃 emoji so the brand mark renders consistently everywhere.
 */
export function GlassMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* whiskey fill */}
      <path
        d="M6.7 13.4 H17.3 L16.7 19.1 A2.1 2.1 0 0 1 14.6 21 H9.4 A2.1 2.1 0 0 1 7.3 19.1 Z"
        className="fill-primary"
      />
      {/* glass outline */}
      <path
        d="M5.2 4 H18.8 L16.7 19.1 A2.1 2.1 0 0 1 14.6 21 H9.4 A2.1 2.1 0 0 1 7.3 19.1 Z"
        className="stroke-current"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
