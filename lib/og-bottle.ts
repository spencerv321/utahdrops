import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { bottlePhoto } from "@/lib/bottle-photo";

/**
 * The product's bottle photo as a PNG data URI for its share card, or null.
 * Kept out of `lib/og.tsx` so only the product card's function ships the
 * PNG copies (file tracing follows this path into every importer).
 */
export async function ogBottlePhoto(csc: string) {
  const photo = bottlePhoto(csc);
  if (!photo) return null;
  try {
    const png = await readFile(join(process.cwd(), "assets/og/bottles", `${photo.id}.png`));
    return { src: `data:image/png;base64,${png.toString("base64")}`, width: photo.width, height: photo.height };
  } catch {
    return null; // copy missing: the card just shows no bottle
  }
}
