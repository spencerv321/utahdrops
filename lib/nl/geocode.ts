import { userAgent } from "@/lib/dabs/client";

const cache = new Map<string, { lat: number; lng: number } | null>();

/**
 * Light geocoding via OSM Nominatim, biased to Utah. Free, no key; identifiable
 * UA and caching keep us well within their usage policy at MVP volume.
 */
export async function geocodeUtah(
  place: string
): Promise<{ lat: number; lng: number } | null> {
  const key = place.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${place}, Utah, USA`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    const hit = results[0]
      ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
      : null;
    cache.set(key, hit);
    return hit;
  } catch {
    return null;
  }
}
