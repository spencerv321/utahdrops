import { AREA_COOKIE, serializeArea, type Area } from "@/lib/area";

// Product pages sort stores by distance from coordinates kept here; keep it in
// step with the area cookie so both follow one choice.
export const LOCATION_STORAGE_KEY = "ud_location";
export const AREA_EVENT = "ud-area";

/** Remember the area for server pages (cookie) and product pages (localStorage). */
export function rememberArea(area: Area | null) {
  if (area) {
    document.cookie = `${AREA_COOKIE}=${serializeArea(area)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } else {
    document.cookie = `${AREA_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
  try {
    if (area) window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ lat: area.lat, lng: area.lng }));
    else window.localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch {
    // not persisted; the cookie still works
  }
  window.dispatchEvent(new Event(AREA_EVENT));
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
