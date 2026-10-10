import Image from "next/image";
import type { ProductKind } from "@/lib/format";
import { BottleGlyph } from "@/components/bottle-glyph";
import { cn } from "@/lib/utils";
import photos from "@/lib/bottle-photos.json";

const FILES: Record<string, number[]> = photos.files;
const PRODUCTS: Record<string, string> = photos.products;

/** Photo file for a product, if a verified one exists (one per label, shared across sizes). */
export function bottlePhoto(csc: string | null | undefined) {
  const id = csc ? PRODUCTS[csc] : undefined;
  const dims = id ? FILES[id] : undefined;
  return id && dims ? { src: `/bottles/${id}.webp`, width: dims[0], height: dims[1] } : null;
}

/**
 * The bottle's photo, cut out onto the page, or the container glyph when we
 * have no verified photo. Photos match the label; size and vintage may differ
 * (a 750ml shot also stands in for the 1.75L).
 */
export function BottlePhoto({ csc, kind, className, photoClassName, alt = "" }: {
  csc: string | null | undefined; kind: ProductKind; className?: string;
  /** Size when a photo is shown, if it should differ from the glyph's. */
  photoClassName?: string; alt?: string;
}) {
  const photo = bottlePhoto(csc);
  if (!photo) return <BottleGlyph kind={kind} className={className} />;
  return (
    <span aria-hidden={alt ? undefined : true} className={cn("flex shrink-0 items-end justify-center", photoClassName ?? className ?? "h-14 w-11")}>
      <Image src={photo.src} width={photo.width} height={photo.height} alt={alt} unoptimized
        className="h-full w-auto max-w-full object-contain object-bottom" />
    </span>
  );
}
