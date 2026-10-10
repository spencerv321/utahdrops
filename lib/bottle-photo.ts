import photos from "@/lib/bottle-photos.json";

const FILES: Record<string, number[]> = photos.files;
const PRODUCTS: Record<string, string> = photos.products;

/**
 * The verified photo for a product, if one exists (one per label, shared
 * across sizes). `id` names both `public/bottles/<id>.webp` (site) and
 * `assets/og/bottles/<id>.png` (share cards). See scripts/photos/README.md.
 */
export function bottlePhoto(csc: string | null | undefined) {
  const id = csc ? PRODUCTS[csc] : undefined;
  const dims = id ? FILES[id] : undefined;
  return id && dims ? { id, src: `/bottles/${id}.webp`, width: dims[0], height: dims[1] } : null;
}
