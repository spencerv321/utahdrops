import { unstable_cache } from "next/cache";

/**
 * Caches a slow, rarely changing query across requests on the site, and runs
 * it directly anywhere else (scripts and jobs run outside Next, where
 * unstable_cache throws "incrementalCache missing"). The result is stored as
 * JSON, so return plain arrays and objects, not Maps or Dates. Vercel's data
 * cache outlives deploys: put anything the query depends on in `keyParts`.
 */
export function cachedQuery<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  revalidateSeconds: number
): (...args: A) => Promise<R> {
  const cached = unstable_cache(fn, keyParts, { revalidate: revalidateSeconds });
  return (...args: A) => (process.env.NEXT_RUNTIME ? cached(...args) : fn(...args));
}
