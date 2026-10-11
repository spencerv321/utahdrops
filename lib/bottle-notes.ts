import notes from "@/lib/bottle-notes.json";

const NOTES: Record<string, string> = notes.notes;
const PRODUCTS: Record<string, string> = notes.products;

/**
 * DABS listing text that says nothing about the bottle itself, only the size
 * ("Larger bottle of smooth vodka…"). Not shown as a description.
 */
const SIZE_BLURB = /^(a |an )?(larger|large|extra-large|big|jumbo|full-size|full-sized|standard|mid-size|compact)( size)? bottle/i;

/**
 * The description to show for a product: our own note when one exists (written
 * from cited sources, one per label, shared across sizes; see
 * scripts/notes/README.md), else the DABS listing text unless it is only a
 * size blurb. Null when there is nothing worth showing.
 */
export function bottleDescription(csc: string, dabsText: string | null | undefined) {
  const id = PRODUCTS[csc];
  const note = id ? NOTES[id] : undefined;
  if (note) return { text: note, ours: true };
  const dabs = dabsText?.trim();
  return dabs && !SIZE_BLURB.test(dabs) ? { text: dabs, ours: false } : null;
}
