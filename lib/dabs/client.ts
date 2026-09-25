import { DABS_LOCATOR_URL } from "@/lib/config";
import { sql } from "@/lib/db";

/**
 * Polite HTTP client for DABS pages: identifiable User-Agent with contact
 * email, one request per 1.1 s across everything we run, exponential
 * backoff, loud abort when the response shape changes.
 *
 * "Everything we run" is several processes (the catalog and store jobs in
 * separate Actions runners, on-demand checks on Vercel), so each request
 * reserves its slot from one Postgres row (dabs_pacer). If the database
 * can't be reached, the process falls back to pacing itself.
 */

const MIN_INTERVAL_MS = 1100;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

/** The shared pacer is busier than the caller is willing to wait for. */
export class DabsBusyError extends Error {
  constructor() {
    super("DABS request queue is busy");
    this.name = "DabsBusyError";
  }
}

/**
 * Reserve the next shared slot: returns ms to wait before sending, or null
 * when the slot is further out than `maxWaitMs` (nothing is reserved then).
 * Throws when the pacer table isn't reachable.
 */
async function reserveSharedSlot(maxWaitMs: number): Promise<number | null> {
  const rows = await sql<{ wait_ms: number }[]>`
    update dabs_pacer
    set next_at = greatest(next_at, clock_timestamp()) + make_interval(secs => ${MIN_INTERVAL_MS / 1000})
    where id = 1
      and greatest(next_at, clock_timestamp()) <= clock_timestamp() + make_interval(secs => ${maxWaitMs / 1000})
    returning (extract(epoch from next_at - clock_timestamp()) * 1000 - ${MIN_INTERVAL_MS})::float8 as wait_ms`;
  if (rows.length === 0) return null;
  return Math.max(0, rows[0].wait_ms);
}

/** After the pacer can't be reached, pace locally for a minute before trying it again. */
let sharedPacerDownUntil = 0;

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

async function rateLimit(maxWaitMs: number) {
  // This process's own pace always holds; the shared slot adds everyone else's.
  const local = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  let wait = Math.max(0, local);
  if (Date.now() >= sharedPacerDownUntil) {
    try {
      const shared = await reserveSharedSlot(Math.max(maxWaitMs, local));
      if (shared == null) throw new DabsBusyError();
      wait = Math.max(wait, shared);
    } catch (err) {
      if (err instanceof DabsBusyError) throw err;
      // No database (or no pacer table yet): pace this process alone.
      sharedPacerDownUntil = Date.now() + 60_000;
      console.warn(`shared DABS pacer unavailable, pacing locally: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export interface FetchOptions {
  /** Retries after a 5xx/429 or network error. 0 for single-use cookies. */
  retries?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Give up (DabsBusyError) rather than wait longer than this for a slot. */
  maxWaitMs?: number;
}

/**
 * All DABS requests in a process funnel through one queue, and every request
 * takes a slot from the shared pacer, so the 1 req / 1.1 s pace holds across
 * jobs and servers. Every request has a timeout so one hung socket can't
 * stall the queue.
 */
export function politeFetch(
  url: string,
  init: RequestInit = {},
  cookies?: string,
  { retries = MAX_RETRIES, timeoutMs = REQUEST_TIMEOUT_MS, maxWaitMs = 10 * 60_000 }: FetchOptions = {}
): Promise<Response> {
  const task = queue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      await rateLimit(maxWaitMs);
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(timeoutMs),
          redirect: init.redirect ?? "follow",
          headers: {
            "User-Agent": userAgent(),
            ...(cookies ? { Cookie: cookies } : {}),
            ...init.headers,
          },
        });
        if (res.status >= 500 || res.status === 429) {
          if (attempt >= retries) {
            throw new Error(`DABS request failed after ${attempt + 1} tries: ${res.status} ${url}`);
          }
        } else {
          return res;
        }
      } catch (err) {
        if (attempt >= retries) throw err;
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
