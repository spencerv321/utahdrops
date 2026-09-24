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
