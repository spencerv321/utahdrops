/**
 * Photo/enrichment pilot: fetch the source pages listed in data/sources.json,
 * pull out what they say about the product and which images they carry, and
 * download those images into the local cache (never into git, never to the
 * site).
 *
 *   npx tsx pilot/photo-enrichment/fetch-candidates.ts [csc ...]
 *
 * Politeness: robots.txt is honored for our user agent and "*", one request
 * per host every 2.5 s, and a host that answers 401/403/429 or a bot
 * challenge is marked blocked and not tried again in this run (recorded in
 * data/hosts.json). Pages and images are cached by URL, so re-runs don't
 * re-fetch. Image-search thumbnails are never fetched: only URLs that the
 * source page itself references.
 */
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = __dirname;
const CACHE = join(DIR, ".cache");
const UA = "UtahDropsPhotoPilot/0.1 (+https://utahdrops.com; one-off research, low rate)";
const HOST_GAP_MS = 2500;
const MAX_IMAGES_PER_PAGE = 4;

export interface SourceRef {
  url: string;
  /** How it was found, e.g. 'WebSearch "titos handmade vodka 1.75" rank 1'. */
  found_by: string;
  org: string;
  source_type: "producer" | "importer/distributor" | "retailer" | "other";
}

type Hosts = Record<string, { blocked?: string; robots?: string | null; disallowed?: string[] }>;

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lastHit = new Map<string, number>();
const hostsPath = join(DIR, "data/hosts.json");
const hosts: Hosts = existsSync(hostsPath) ? JSON.parse(readFileSync(hostsPath, "utf8")) : {};

async function paced(url: string, accept: string): Promise<Response> {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + HOST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  return fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en-US" }, redirect: "follow", signal: AbortSignal.timeout(25_000) });
}

/** Minimal robots.txt: groups for our agent, else "*"; Disallow prefixes (with * and $). */
async function allowed(url: string): Promise<boolean> {
  const u = new URL(url);
  const h = (hosts[u.host] ??= {});
  if (h.robots === undefined) {
    try {
      const r = await paced(`${u.protocol}//${u.host}/robots.txt`, "text/plain");
      h.robots = r.ok ? (await r.text()).slice(0, 200_000) : null;
    } catch { h.robots = null; }
    const lines = (h.robots ?? "").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
    const groups: { agents: string[]; dis: string[]; allow: string[] }[] = [];
    let cur: (typeof groups)[number] | null = null, lastWasAgent = false;
    for (const l of lines) {
      const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
      if (!m) continue;
      const [k, v] = [m[1].toLowerCase(), m[2]];
      if (k === "user-agent") { if (!cur || !lastWasAgent) groups.push((cur = { agents: [], dis: [], allow: [] })); cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
      lastWasAgent = false;
      if (!cur) continue;
      if (k === "disallow" && v) cur.dis.push(v);
      if (k === "allow" && v) cur.allow.push(v);
    }
    const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && "utahdropsphotopilot".includes(a)));
    const star = groups.filter((g) => g.agents.includes("*"));
    const use = mine.length ? mine : star;
    h.disallowed = use.flatMap((g) => g.dis);
    (h as { allowed?: string[] }).allowed = use.flatMap((g) => g.allow);
  }
  const path = u.pathname + u.search;
  const match = (rule: string) => new RegExp("^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\\\$$/, "$").replace(/\*/g, ".*")).test(path);
  const dis = (h.disallowed ?? []).filter(match).sort((a, b) => b.length - a.length)[0];
  const al = ((h as { allowed?: string[] }).allowed ?? []).filter(match).sort((a, b) => b.length - a.length)[0];
  return !dis || (al !== undefined && al.length >= dis.length);
}

async function get(url: string, kind: "page" | "image"): Promise<{ status: number; buf?: Buffer; type?: string; finalUrl?: string; note?: string }> {
  const host = new URL(url).host;
  if (hosts[host]?.blocked) return { status: 0, note: `host blocked earlier: ${hosts[host].blocked}` };
  if (!(await allowed(url))) return { status: 0, note: "disallowed by robots.txt" };
  const key = sha(url);
  const metaP = join(CACHE, `${key}.json`), bodyP = join(CACHE, `${key}.bin`);
  if (existsSync(metaP)) {
    const m = JSON.parse(readFileSync(metaP, "utf8"));
    return { ...m, buf: existsSync(bodyP) ? readFileSync(bodyP) : undefined };
  }
  let r: Response;
  try { r = await paced(url, kind === "page" ? "text/html,application/xhtml+xml" : "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5"); }
  catch (e) { return { status: 0, note: `fetch error: ${(e as Error).message}` }; }
  const buf = Buffer.from(await r.arrayBuffer());
  const type = r.headers.get("content-type") ?? "";
  const text = kind === "page" ? buf.toString("utf8", 0, Math.min(buf.length, 400_000)) : "";
  const challenge = kind === "page" && /cf-challenge|challenge-platform|captcha|Access Denied|Pardon Our Interruption|One moment, please|Just a moment\.\.\.|are you a robot|px-captcha|_Incapsula_/i.test(text) && buf.length < 60_000;
  if ([401, 403, 429].includes(r.status) || challenge) {
    hosts[host] = { ...hosts[host], blocked: `${r.status}${challenge ? " bot challenge" : ""} on ${url} at ${new Date().toISOString()}` };
  }
  const meta = { status: r.status, type, finalUrl: r.url, fetched_at: new Date().toISOString() };
  writeFileSync(metaP, JSON.stringify(meta));
  if (r.ok) writeFileSync(bodyP, buf);
  return { ...meta, buf: r.ok ? buf : undefined };
}

// Page text that tends to carry identity facts, kept verbatim with a little context.
const FACT_PATTERNS: [string, RegExp][] = [
  ["abv", /[^.\n]{0,60}\b\d{1,2}(?:\.\d{1,2})?\s?%\s?(?:abv|alc|alcohol|vol)[^.\n]{0,40}/gi],
  ["proof", /[^.\n]{0,60}\b\d{2,3}(?:\.\d)?\s?(?:proof|°\s?proof)\b[^.\n]{0,40}/gi],
  ["size", /[^.\n]{0,50}\b\d+(?:\.\d+)?\s?(?:ml|mL|cl|l|L|liter|litre|oz)\b[^.\n]{0,30}/g],
  ["age", /[^.\n]{0,50}\b\d{1,2}\s?(?:-?\s?year|yr|years)[- ]old\b[^.\n]{0,40}|[^.\n]{0,30}\baged\s(?:for\s)?(?:at least\s)?\d{1,2}\s?(?:years?|months?)[^.\n]{0,40}/gi],
  ["vintage", /[^.\n]{0,40}\bvintage\b[^.\n]{0,60}/gi],
  ["gtin", /[^.\n]{0,30}\b(?:upc|gtin|ean|barcode)\b[^.\n]{0,40}/gi],
  ["region", /[^.\n]{0,40}\b(?:region|appellation|origin|produced in|distilled in|made in|country)\b[^.\n]{0,80}/gi],
  ["grape", /[^.\n]{0,40}\b(?:varietal|grape|blend|composition|cépage)s?\b[^.\n]{0,100}/gi],
  ["grain", /[^.\n]{0,40}\b(?:mash ?bill|grain|corn|rye|barley|wheat|agave)\b[^.\n]{0,80}/gi],
  ["tasting", /[^\n]{0,20}\b(?:nose|aroma|palate|taste|finish|tasting notes?)\b\s*[:\-–][^\n]{5,220}/gi],
  ["rights", /[^.\n]{0,80}(?:©|copyright|all rights reserved|media kit|press kit|trade resources|image library|brand assets|logos? (?:&|and) images)[^.\n]{0,100}/gi],
];

function extract(html: string, base: string) {
  const $ = cheerio.load(html);
  const abs = (u?: string) => { try { return u ? new URL(u.trim(), base).toString() : undefined; } catch { return undefined; } };
  const meta = (sel: string) => $(sel).attr("content")?.trim();
  const ld: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).text());
      const flat = (x: unknown): void => {
        if (Array.isArray(x)) x.forEach(flat);
        else if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          if (o["@graph"]) flat(o["@graph"]);
          ld.push(o);
        }
      };
      flat(j);
    } catch { /* invalid JSON-LD is common; skip */ }
  });
  const products = ld.filter((o) => /Product/i.test(String(o["@type"] ?? "")));
  const ldImages = products.flatMap((p) => {
    const im = p.image as unknown;
    const arr = Array.isArray(im) ? im : [im];
    return arr.map((x) => (typeof x === "string" ? x : (x as { url?: string })?.url)).filter(Boolean) as string[];
  });
  const gtins = products.flatMap((p) => ["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "upc", "sku", "mpn"].map((k) => (p[k] ? `${k}:${p[k]}` : null)).filter(Boolean) as string[]);
  const title = $("title").first().text().trim();
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  $("script, style, noscript, svg").remove();
  const body = $("body").text().replace(/[ \t\r]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  const facts: Record<string, string[]> = {};
  for (const [k, re] of FACT_PATTERNS) {
    const hits = [...new Set([...body.matchAll(re)].map((m) => m[0].replace(/\s+/g, " ").trim()))].slice(0, 8);
    if (hits.length) facts[k] = hits;
  }
  // Images named in markup: structured data first, then social cards, then large inline images whose alt/src looks like the product.
  const imgs: { url: string; via: string; alt?: string }[] = [];
  const push = (u: string | undefined, via: string, alt?: string) => {
    const a = abs(u);
    if (a && /^https?:/.test(a) && !imgs.some((i) => i.url === a) && !/\.svg(\?|$)|logo|icon|sprite|placeholder|spacer|favicon/i.test(a)) imgs.push({ url: a, via, alt });
  };
  ldImages.forEach((u) => push(u, "json-ld Product.image"));
  push(meta('meta[property="og:image"]') ?? meta('meta[property="og:image:url"]'), "og:image");
  push(meta('meta[name="twitter:image"]'), "twitter:image");
  $("img").each((_, el) => {
    const e = $(el);
    const src = e.attr("data-zoom-image") ?? e.attr("data-large_image") ?? e.attr("data-src") ?? e.attr("src") ?? e.attr("srcset")?.split(",").pop()?.trim().split(" ")[0];
    const alt = e.attr("alt") ?? "";
    const w = +(e.attr("width") ?? 0);
    if (src && (w === 0 || w >= 300) && /bottle|product|pack|can|front|hero|\d{3,4}x\d{3,4}/i.test(src + " " + alt)) push(src, "img[src] product-like", alt);
  });
  return {
    title, h1,
    og_title: meta('meta[property="og:title"]'),
    description: meta('meta[name="description"]') ?? meta('meta[property="og:description"]'),
    ld_products: products.map((p) => ({ name: p.name, sku: p.sku, gtins, size: p.size ?? p.weight, brand: typeof p.brand === "object" ? (p.brand as { name?: string })?.name : p.brand, description: String(p.description ?? "").slice(0, 600) })),
    facts, images: imgs.slice(0, MAX_IMAGES_PER_PAGE),
    terms_links: $("a").map((_, a) => ({ t: $(a).text().trim(), h: abs($(a).attr("href")) })).get()
      .filter((l) => /terms|legal|copyright|media|press|trade|brand assets/i.test(l.t)).slice(0, 6),
  };
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const sources: Record<string, SourceRef[]> = JSON.parse(readFileSync(join(DIR, "data/sources.json"), "utf8"));
  const outPath = join(DIR, "data/candidates.json");
  const out: Record<string, unknown[]> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  const only = process.argv.slice(2);
  for (const [csc, refs] of Object.entries(sources)) {
    if (only.length && !only.includes(csc)) continue;
    const pages = [];
    for (const ref of refs) {
      const r = await get(ref.url, "page");
      const page: Record<string, unknown> = { ...ref, retrieved_at: new Date().toISOString(), http_status: r.status, note: r.note, final_url: r.finalUrl };
      if (r.buf && /html/.test(r.type ?? "html")) {
        const x = extract(r.buf.toString("utf8"), r.finalUrl ?? ref.url);
        const images = [];
        for (const im of x.images) {
          const g = await get(im.url, "image");
          const ok = g.buf && /^image\//.test(g.type ?? "") && g.buf.length > 2000;
          let file: string | undefined;
          if (ok) { file = `${sha(g.buf!)}`; writeFileSync(join(CACHE, `img-${file}`), g.buf!); }
          images.push({ ...im, http_status: g.status, note: g.note, content_type: g.type, bytes: g.buf?.length, sha256: ok ? file : undefined });
        }
        Object.assign(page, x, { images });
      }
      pages.push(page);
      console.log(csc, r.status || r.note, ref.url.slice(0, 90), (page.images as unknown[] | undefined)?.length ?? 0, "imgs");
    }
    out[csc] = pages;
    writeFileSync(outPath, JSON.stringify(out, null, 1));
    writeFileSync(hostsPath, JSON.stringify(Object.fromEntries(Object.entries(hosts).map(([h, v]) => [h, { blocked: v.blocked, robots_found: !!v.robots, disallow_rules: v.disallowed?.length ?? 0 }])), null, 1));
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
