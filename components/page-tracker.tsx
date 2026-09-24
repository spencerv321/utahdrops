"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const VISITOR_KEY = "ud_vid";
const SESSION_KEY = "ud_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Storage can throw (private mode, blocked site data); fall back to per-load ids. */
function stored(storage: () => Storage, key: string, make: () => string): string {
  try {
    const s = storage();
    const v = s.getItem(key);
    if (v) return v;
    const id = make();
    s.setItem(key, id);
    return id;
  } catch {
    return make();
  }
}

/** Returns the session id and whether this view starts a new session. */
function session(): { id: string; landing: boolean } {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const [id, at] = raw ? raw.split("|") : [];
    const fresh = !id || Date.now() - Number(at) > SESSION_IDLE_MS;
    const sid = fresh ? newId() : id;
    localStorage.setItem(SESSION_KEY, `${sid}|${Date.now()}`);
    return { id: sid, landing: fresh };
  } catch {
    return { id: newId(), landing: true };
  }
}

/**
 * First-party page-view beacon for the admin dashboard. No cookies, no IPs:
 * a random visitor id in localStorage and a 30-minute rolling session.
 */
export function PageTracker({ userId }: { userId: string | null }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = pathname === "/search" ? params.get("q") : null;
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const key = `${pathname}?${q ?? ""}`;
    if (key === last.current) return;
    last.current = key;

    const s = session();
    const url = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      path: pathname,
      q,
      visitor: stored(() => localStorage, VISITOR_KEY, newId),
      session: s.id,
      user: userId,
      landing: s.landing,
      referrer: s.landing ? document.referrer || null : null,
      utm_source: url.get("utm_source") ?? url.get("ref"),
      utm_medium: url.get("utm_medium"),
      utm_campaign: url.get("utm_campaign"),
    });

    try {
      if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    } catch {
      // fall through to fetch
    }
    fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(
      () => {}
    );
  }, [pathname, q, userId]);

  return null;
}
