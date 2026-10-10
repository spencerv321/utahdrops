import Image from "next/image";
import type { ProductKind } from "@/lib/format";
import { BottleGlyph } from "@/components/bottle-glyph";
import { cn } from "@/lib/utils";
import { bottlePhoto } from "@/lib/bottle-photo";

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
