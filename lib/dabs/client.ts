import { DABS_LOCATOR_URL } from "@/lib/config";

/**
 * Polite HTTP client for DABS pages, per the PRD politeness rules:
 * identifiable User-Agent with contact email, ≤1 req/sec globally,
 * exponential backoff, loud abort when the response shape changes.
 */

const MIN_INTERVAL_MS = 1100;
const MAX_RETRIES = 3;

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

export class ScrapeShapeError extends Error {
  constructor(message: string) {
    super(`DABS response shape changed — aborting scrape: ${message}`);
    this.name = "ScrapeShapeError";
  }
}

export function userAgent(): string {
  const contact = process.env.DABS_CONTACT_EMAIL ?? "unset";
  return `UtahDrops/0.1 (consumer inventory tracker; contact: ${contact})`;
}

async function rateLimit() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** All DABS requests funnel through one queue so the 1 req/sec cap is global. */
export function politeFetch(
  url: string,
  init: RequestInit = {},
  cookies?: string
): Promise<Response> {
  const task = queue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      await rateLimit();
      try {
        const res = await fetch(url, {
          ...init,
          redirect: init.redirect ?? "follow",
          headers: {
            "User-Agent": userAgent(),
            ...(cookies ? { Cookie: cookies } : {}),
            ...init.headers,
          },
        });
        if (res.status >= 500 || res.status === 429) {
          if (attempt >= MAX_RETRIES) {
            throw new Error(`DABS request failed after ${attempt + 1} tries: ${res.status} ${url}`);
          }
        } else {
          return res;
        }
      } catch (err) {
        if (attempt >= MAX_RETRIES) throw err;
      }
      await new Promise((r) => setTimeout(r, 2 ** attempt * 2000));
    }
  });
  queue = task.catch(() => {});
  return task as Promise<Response>;
}

/** GET the locator landing page and return the session cookie header value. */
export async function getSessionCookies(): Promise<string> {
  const res = await politeFetch(DABS_LOCATOR_URL);
  if (!res.ok) throw new Error(`Locator landing page returned ${res.status}`);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

/** "1  General Distribution" → "1"; "S  Special Order" → "S" */
export function parseStatusCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().split(/\s+/)[0];
  return code || null;
}

/** "ABSOLUT VODKA  750ml" → 750 · "1.75L" → 1750 */
export function parseSizeMl(name: string): number | null {
  const ml = name.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (ml) return Math.round(parseFloat(ml[1]));
  const liters = name.match(/(\d+(?:\.\d+)?)\s*L\b/);
  if (liters) return Math.round(parseFloat(liters[1]) * 1000);
  return null;
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
