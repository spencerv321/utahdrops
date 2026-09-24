import type { ProductKind } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Quiet, consistent stand-in where we have no verified product photo (we have
 * none today). A line drawing of the *kind* of container — never a label or a
 * specific bottle — so it can't be mistaken for the real thing.
 */
export function BottleGlyph({ kind, className }: { kind: ProductKind; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-end justify-center rounded-sm bg-card text-subtle-foreground",
        className ?? "h-14 w-11"
      )}
    >
      <svg viewBox="0 0 24 40" className="h-[78%] w-auto" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        {kind === "can" ? (
          <path d="M6 10 H18 V36 Q18 38 16 38 H8 Q6 38 6 36 Z M7 10 Q7 8 9 8 H15 Q17 8 17 10 M6 15 H18 M6 33 H18" />
        ) : kind === "wine" ? (
          <path d="M10.5 2 H13.5 V11 Q13.5 14 16 16.5 Q17.5 18 17.5 21 V36.5 Q17.5 38 16 38 H8 Q6.5 38 6.5 36.5 V21 Q6.5 18 8 16.5 Q10.5 14 10.5 11 Z M10.5 5 H13.5 M6.5 25 H17.5 M6.5 32 H17.5" />
        ) : (
          <path d="M10 2 H14 V9 Q14 10 15.5 11.5 L17.5 13.5 Q19 15 19 17 V36.5 Q19 38 17.5 38 H6.5 Q5 38 5 36.5 V17 Q5 15 6.5 13.5 L8.5 11.5 Q10 10 10 9 Z M10 4.5 H14 M5 22 H19 M5 31 H19" />
        )}
      </svg>
    </span>
  );
}
