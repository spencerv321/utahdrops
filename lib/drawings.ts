import { displayName } from "./format";

/**
 * DABS Rare High Demand Product drawings with the odds they imply.
 *
 * DABS publishes, per bottle in a drawing, how many bottles were offered and
 * how many entries it received; it doesn't publish odds. "1 in N" here is
 * entries ÷ bottles, which is a person's chance on that bottle if each
 * winner gets one bottle and each person enters once. Rows come from the
 * rhdp job (lib/jobs/rhdp.ts); winners' names are never stored.
 */
export interface DrawingRow {
  drawing: string;
  item_code: string;
  product_name: string;
  price: string | null;
  bottles: number | null;
  entries: number | null;
  section: string;
  first_seen: Date;
  last_seen: Date;
  listed: boolean;
}

export interface PastOdds {
  drawing: string;
  year: number;
  bottles: number | null;
  entries: number | null;
  oneIn: number | null;
}

export interface DrawingItem {
  code: string;
  name: string;
  price: string | null;
  bottles: number | null;
  entries: number | null;
  oneIn: number | null;
  /** The same bottle (item code) in the latest earlier drawing, if any. */
  previous: PastOdds | null;
  /** Whether /product/<code> exists. */
  listed: boolean;
}

export interface Drawing {
  name: string;
  year: number;
  /** "future" | "current" | "past"; open ones only while DABS still lists them. */
  section: string;
  items: DrawingItem[];
  bottles: number;
  /** Entries summed over this drawing's bottles that also appear in an earlier drawing, and theirs then. */
  entriesChange: { now: number; before: number; year: number } | null;
}

/** Drawing and bottle names as people say them: no trailing size, "DRC", "17 Year". */
export function drawingTitle(s: string): string {
  return displayName(s.replace(/\s+\d{2,4}\s?(?:ml|m)\s*$/i, "").replace(/\s{2,}/g, " ").trim())
    .replace(/\bDrc\b/g, "DRC")
    .replace(/\b(\d+)\s?yr\b/gi, "$1 Year");
}

/** "1 in N": entries per bottle, rounded; 1 when there were at least as many bottles as entries. */
export function oneIn(bottles: number | null, entries: number | null): number | null {
  if (!bottles || bottles <= 0 || entries == null) return null;
  if (entries <= bottles) return 1;
  return Math.round(entries / bottles);
}

/** The year in a drawing's name ("… COLLECTION 2026"), else the year we first saw it. */
export function drawingYear(name: string, firstSeen: Date): number {
  const m = name.match(/\b(20\d\d)\b/);
  return m ? Number(m[1]) : firstSeen.getUTCFullYear();
}

/** How long a drawing still counts as open after the job last saw it there. */
const OPEN_GRACE_MS = 3 * 86400_000;

export function buildDrawings(rows: DrawingRow[], now = Date.now()): Drawing[] {
  const byName = new Map<string, DrawingRow[]>();
  for (const r of rows) byName.set(r.drawing, [...(byName.get(r.drawing) ?? []), r]);

  const meta = [...byName.entries()].map(([name, rs]) => {
    const firstSeen = new Date(Math.min(...rs.map((r) => r.first_seen.getTime())));
    const lastSeen = Math.max(...rs.map((r) => r.last_seen.getTime()));
    const section = rs[0].section;
    const open = section !== "past" && now - lastSeen <= OPEN_GRACE_MS;
    return { name, rows: rs, year: drawingYear(name, firstSeen), firstSeen, section: open ? section : "past" };
  });
  // Newest first: open drawings, then by year, then by when we first saw them.
  const rank = (s: string) => (s === "current" ? 0 : s === "future" ? 1 : 2);
  meta.sort(
    (a, b) => rank(a.section) - rank(b.section) || b.year - a.year || b.firstSeen.getTime() - a.firstSeen.getTime()
  );

  return meta.map((d, i) => {
    const earlier = meta.slice(i + 1).filter((e) => e.year < d.year || e.firstSeen < d.firstSeen);
    let sumNow = 0, sumBefore = 0, prevYear: number | null = null;
    const items: DrawingItem[] = d.rows.map((r) => {
      const prevDrawing = earlier.find((e) => e.rows.some((x) => x.item_code === r.item_code));
      const p = prevDrawing?.rows.find((x) => x.item_code === r.item_code);
      if (p && r.entries != null && p.entries != null) {
        sumNow += r.entries;
        sumBefore += p.entries;
        prevYear ??= prevDrawing!.year;
      }
      return {
        code: r.item_code,
        name: r.product_name,
        price: r.price,
        bottles: r.bottles,
        entries: r.entries,
        oneIn: oneIn(r.bottles, r.entries),
        previous: p
          ? { drawing: prevDrawing!.name, year: prevDrawing!.year, bottles: p.bottles, entries: p.entries, oneIn: oneIn(p.bottles, p.entries) }
          : null,
        listed: r.listed,
      };
    });
    // Hardest to win first; bottles without published entries last.
    items.sort((a, b) => (b.oneIn ?? -1) - (a.oneIn ?? -1) || a.name.localeCompare(b.name));
    return {
      name: d.name,
      year: d.year,
      section: d.section,
      items,
      bottles: items.reduce((s, it) => s + (it.bottles ?? 0), 0),
      entriesChange: prevYear != null && sumBefore > 0 ? { now: sumNow, before: sumBefore, year: prevYear } : null,
    };
  });
}

export async function getDrawings(): Promise<Drawing[]> {
  // Imported here so the pure helpers above load without a database (tests).
  const { sql } = await import("@/lib/db");
  const rows = (await sql`
    select d.drawing, d.item_code, d.product_name, d.price::text, d.bottles, d.entries, d.section,
           d.first_seen, d.last_seen, (p.csc is not null) as listed
    from rhdp_drawings d
    left join products p on p.csc = d.item_code`) as unknown as DrawingRow[];
  return buildDrawings(rows);
}
