/**
 * Drawing alerts: which emails a DABS drawing calls for, and the close date
 * DABS's page gives (if it gives one). Pure helpers; the sender is
 * lib/jobs/drawing-alerts.ts.
 *
 *   announced  DABS lists the drawing under "future"
 *   open       DABS lists it under "current" (entries open)
 *   closing    open, and DABS's page shows a close date within CLOSING_LEAD
 *
 * Each (person, drawing, kind) is sent at most once. A person who is due more
 * than one kind at once (e.g. switched alerts on the day before it closes)
 * gets one email headed by the most urgent.
 */

export type DrawingAlertKind = "announced" | "open" | "closing";

export interface LiveDrawing {
  drawing: string;
  section: "future" | "current";
  /** Close time if DABS's page showed one, else null (we never guess it). */
  closesAt: Date | null;
}

/** "Closes tomorrow" goes out when the close is this near (checks run ~4×/day, often late). */
export const CLOSING_LEAD_MS = 36 * 3600_000;

const URGENCY: Record<DrawingAlertKind, number> = { closing: 3, open: 2, announced: 1 };

export function alertKindsFor(d: LiveDrawing, now: Date): DrawingAlertKind[] {
  if (d.section === "future") return ["announced"];
  const t = now.getTime();
  // DABS still listing it after the close date it gave: say nothing rather than "open".
  if (d.closesAt && d.closesAt.getTime() <= t) return [];
  const kinds: DrawingAlertKind[] = ["open"];
  if (d.closesAt && d.closesAt.getTime() - t <= CLOSING_LEAD_MS) kinds.push("closing");
  return kinds;
}

/** Kinds still owed to someone who has already been sent `sent`; the headline is the first. */
export function kindsToSend(due: DrawingAlertKind[], sent: string[]): DrawingAlertKind[] {
  return due.filter((k) => !sent.includes(k)).sort((a, b) => URGENCY[b] - URGENCY[a]);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const TIME_RE = String.raw`(?:\s*(?:at|@|,)?\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?)?`;
const NUMERIC = new RegExp(String.raw`\b(\d{1,2})/(\d{1,2})/(\d{4})\b` + TIME_RE, "gi");
const NAMED = new RegExp(String.raw`\b${MONTH_RE}\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b` + TIME_RE, "gi");
const CLOSE_WORD = /\b(clos(?:e|es|ed|ing)|ends?|ending|through|thru|until|till|deadline)\b/gi;

interface Found {
  index: number;
  y: number | null;
  m: number;
  d: number;
  hour: number | null;
  minute: number;
}

function toHour(h: string | undefined, ap: string | undefined): number | null {
  if (!h || !ap) return null;
  const n = Number(h) % 12;
  return ap.toLowerCase() === "p" ? n + 12 : n;
}

function findDates(text: string): Found[] {
  const out: Found[] = [];
  for (const m of text.matchAll(NUMERIC)) {
    out.push({ index: m.index!, m: Number(m[1]), d: Number(m[2]), y: Number(m[3]), hour: toHour(m[4], m[6]), minute: Number(m[5] ?? 0) });
  }
  for (const m of text.matchAll(NAMED)) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    out.push({ index: m.index!, m: month, d: Number(m[2]), y: m[3] ? Number(m[3]) : null, hour: toHour(m[4], m[6]), minute: Number(m[5] ?? 0) });
  }
  out.sort((a, b) => a.index - b.index);
  // "Dec 1 – Dec 5, 2026": a date without a year takes the next stated year.
  for (let i = out.length - 1, year: number | null = null; i >= 0; i--) {
    if (out[i].y != null) year = out[i].y;
    else out[i].y = year;
  }
  return out.filter((f) => f.y != null && f.m >= 1 && f.m <= 12 && f.d >= 1 && f.d <= 31);
}

/** Minutes east of UTC for America/Denver at that instant (-420 MST, -360 MDT). */
function denverOffsetMinutes(at: Date): number {
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = tz?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return -420;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** A Mountain Time wall-clock moment as a Date. */
export function denverTime(y: number, m: number, d: number, hour: number, minute: number): Date {
  const wall = Date.UTC(y, m - 1, d, hour, minute);
  const offset = denverOffsetMinutes(new Date(wall + 7 * 3600_000));
  return new Date(wall - offset * 60_000);
}

/**
 * The close date in the text DABS shows around a drawing, or null. Reads a
 * date after a close word ("closes", "through", "until", "ends"), else the
 * last of two or more dates (a range). One date with no close word could be
 * anything (an announcement, the draw), so it isn't used. A date without a
 * time means the end of that day, Mountain Time.
 */
export function parseCloseDate(text: string | null | undefined): Date | null {
  if (!text) return null;
  const dates = findDates(text);
  if (dates.length === 0) return null;
  let pick: Found | undefined;
  for (const w of text.matchAll(CLOSE_WORD)) {
    pick = dates.find((f) => f.index > w.index!);
    if (pick) break;
  }
  if (!pick && dates.length >= 2) pick = dates[dates.length - 1];
  if (!pick) return null;
  return pick.hour == null
    ? denverTime(pick.y!, pick.m, pick.d, 23, 59)
    : denverTime(pick.y!, pick.m, pick.d, pick.hour, pick.minute);
}

/** "Fri, Dec 5" (or "Fri, Dec 5, 9 PM" when DABS gave a time), Mountain Time. */
export function closeLabel(at: Date): string {
  const day = at.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Denver" });
  const hm = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });
  return hm === "11:59 PM" ? day : `${day}, ${hm.replace(":00", "")}`;
}
