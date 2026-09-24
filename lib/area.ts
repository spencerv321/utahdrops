/**
 * The visitor's area ("Park City", or "Near you" from geolocation). Chosen in
 * the search bar or on a product page and kept in a cookie, so server pages
 * can show "3 stores near Park City" without an account.
 */
export const AREA_COOKIE = "ud_area";

/** Stores within this many miles count as "near". */
export const NEARBY_MILES = 10;

export interface Area {
  label: string;
  lat: number;
  lng: number;
}

export function parseArea(raw: string | null | undefined): Area | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(decodeURIComponent(raw)) as Partial<Area>;
    if (typeof a.label !== "string" || !a.label || a.label.length > 60) return null;
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return null;
    return { label: a.label, lat: Number(a.lat), lng: Number(a.lng) };
  } catch {
    return null;
  }
}

export function serializeArea(a: Area): string {
  // Two decimals ≈ 1 km: plenty for "near", and less precise than a GPS fix.
  return encodeURIComponent(
    JSON.stringify({ label: a.label, lat: Math.round(a.lat * 100) / 100, lng: Math.round(a.lng * 100) / 100 })
  );
}

/** "near Park City" / "near you". */
export function nearLabel(a: Area): string {
  return a.label === "Near you" ? "near you" : `near ${a.label}`;
}
