import { cookies } from "next/headers";
import { AREA_COOKIE, parseArea, type Area } from "@/lib/area";
import { getAreas } from "@/lib/queries";
import { storeLabel } from "@/lib/format";

/** The visitor's chosen area, from the cookie the picker sets. */
export async function getArea(): Promise<Area | null> {
  return parseArea((await cookies()).get(AREA_COOKIE)?.value);
}

/** Picker options: store cities, labeled the way people say them. */
export async function getAreaOptions(): Promise<Area[]> {
  const rows = await getAreas();
  const byLabel = new Map<string, Area>();
  for (const r of rows) {
    const label = storeLabel(r.city).title;
    if (label && !byLabel.has(label)) byLabel.set(label, { label, lat: r.lat, lng: r.lng });
  }
  return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Area for a shareable page: an explicit ?area=<store city> wins over the
 * cookie. `label` is set only for store-city areas, which are safe to put in
 * a link; "Near you" (coordinates) never goes in a URL.
 */
export async function getPageArea(param: string | undefined): Promise<{ area: Area | null; label: string | null }> {
  const options = await getAreaOptions();
  const fromUrl = param ? options.find((a) => a.label.toLowerCase() === param.trim().toLowerCase()) : undefined;
  const area = fromUrl ?? (await getArea());
  const label = area && options.some((a) => a.label === area.label) ? area.label : null;
  return { area, label };
}
