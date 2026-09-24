import { listingNote } from "@/lib/format";

/**
 * DABS listing status as quiet text. Listing status says how DABS carries a
 * product, not whether it's on a shelf, so it stays visually secondary.
 */
export function StatusBadge({ status }: { status: string | null }) {
  const note = listingNote(status);
  if (!note) return null;
  return <span className="text-xs text-subtle-foreground">{note}</span>;
}
