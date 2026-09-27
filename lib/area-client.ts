import { AREA_COOKIE, serializeArea, type Area } from "@/lib/area";

/**
 * The one place a chosen area is kept: the ud_area cookie, read by server
 * pages (search, product, Worth a look). Product pages used to keep their
 * own copy of the coordinates in localStorage ("ud_location"), which could
 * disagree with the cookie; it's cleared here and no longer read.
 */
const LEGACY_LOCATION_KEY = "ud_location";

/** Remember the area (or "All of Utah" = null) for every page. */
export function rememberArea(area: Area | null) {
  if (area) {
    document.cookie = `${AREA_COOKIE}=${serializeArea(area)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } else {
    document.cookie = `${AREA_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
  try {
    window.localStorage.removeItem(LEGACY_LOCATION_KEY);
  } catch {
    // storage blocked: nothing to clear
  }
}

export function locate(): Promise<Area> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ label: "Near you", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { maximumAge: 600_000, timeout: 8000 }
    );
  });
}
