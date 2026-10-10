// Photo harvest: for each target bottle, search DuckDuckGo Images (paced),
// download the top candidates, and build contact sheets for review.
// Usage: node harvest.mjs targets.json [start] [count]
// Resumable: bottles already in out/results.json are skipped.
import sharp from "sharp";
import fs from "node:fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const N = 6, PACE = 10000, TW = 200, TH = 250;
const ALIASES = { sngl: "single", sgl: "single", brrl: "barrel", brl: "barrel", bbl: "barrel", brbn: "bourbon", bbn: "bourbon", whsky: "whisky",
  rsv: "reserve", rsrv: "reserve", blnc: "blanc", sauv: "sauvignon", cab: "cabernet", chard: "chardonnay", slct: "select", blnd: "blend",
  dbl: "double", dble: "double", ltd: "limited", edtn: "edition", prf: "proof", teq: "tequila", spcl: "special", zin: "zinfandel",
  repo: "reposado", liq: "liqueur", orig: "original", btch: "batch", prv: "private", yr: "year", yrs: "year", grpfrt: "grapefruit", strwbry: "strawberry",
  vdka: "vodka", champ: "champagne", pnot: "pinot", pn: "pinot noir", cs: "cabernet sauvignon", sb: "sauvignon blanc" };

const [file, start = "0", count = "1000"] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(file, "utf8")).slice(Number(start), Number(start) + Number(count));
fs.mkdirSync("out/cands", { recursive: true });
fs.mkdirSync("out/sheets", { recursive: true });
const resPath = "out/results.json";
const results = fs.existsSync(resPath) ? JSON.parse(fs.readFileSync(resPath, "utf8")) : {};

export function query(x) {
  let s = x.name.replace(/\s*\d+(\.\d+)?\s*(ml|m|l)$/i, "").replace(/\b\d+(\.\d+)?\s?(ml|l)\b/gi, "");
  s = s.toLowerCase().replace(/(\d)([a-z])/g, "$1 $2").replace(/\(/g, " ").split(/\s+/).map((w) => ALIASES[w] ?? w).join(" ");
  s = s.replace(/'(\d\d)\b/g, " 20$1").replace(/\s+/g, " ").trim();
  return `${s} bottle`;
}

async function yahoo(q) {
  const t = await (await fetch(`https://images.search.yahoo.com/search/images?p=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, "Accept-Language": "en-US" } })).text();
  const urls = [...t.matchAll(/href=["']([^"']*imgurl=[^"']+)/g)].map((m) => { try { return new URL(m[1].replace(/&amp;/g, "&"), "https://images.search.yahoo.com").searchParams.get("imgurl"); } catch { return null; } });
  return [...new Set(urls.filter(Boolean))].map((u) => ({ image: u.startsWith("http") ? u : `https://${u}`, url: u.startsWith("http") ? u : `https://${u}`, title: "" }));
}

let lastSearch = 0;
async function search(q) {
  const wait0 = lastSearch + 4000 - Date.now();
  if (wait0 > 0) await new Promise((r) => setTimeout(r, wait0));
  try { const y = await yahoo(q); if (y.length >= 4) { lastSearch = Date.now(); return y; } } catch {}
  return ddg(q);
}
async function ddg(q) {
  const wait = lastSearch + PACE - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearch = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const h = await (await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, { headers: { "User-Agent": UA } })).text();
    const vqd = (h.match(/vqd=["']?([\d-]+)/) || [])[1];
    if (vqd) {
      const r = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,&p=1`,
        { headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/" } });
      const j = await r.json().catch(() => null);
      if (j?.results?.length) return j.results;
    }
    console.log("  throttled, backing off");
    await new Promise((r) => setTimeout(r, 60000 * (attempt + 1)));
  }
  return [];
}

async function grab(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const m = await sharp(buf).metadata();
    if (!m.width || Math.max(m.width, m.height) < 300) return null;
    return { buf, w: m.width, h: m.height };
  } catch { return null; }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function sheet(name, items) {
  const RH = 34 + TH + 22, comps = [];
  items.forEach((x, row) => {
    const top = row * RH, r = results[x.csc];
    comps.push({ input: Buffer.from(`<svg width="${N * TW}" height="34"><rect width="100%" height="34" fill="#f3e9d2"/><text x="8" y="23" font-size="17" font-family="sans-serif">#${x.rank ?? ""} ${x.csc} · ${esc(x.name)} · ${x.size_ml ?? "?"}ml</text></svg>`), left: 0, top });
    r.cands.forEach((c, i) => {
      if (c.tile) comps.push({ input: Buffer.from(c.tile, "base64"), left: i * TW, top: top + 34 });
      comps.push({ input: Buffer.from(`<svg width="${TW}" height="22"><rect width="100%" height="22" fill="#222"/><text x="4" y="16" font-size="12" fill="#fff" font-family="sans-serif">${i} ${c.tile ? `${c.w}x${c.h} ${esc(c.host.slice(0, 20))}` : "—"}</text></svg>`), left: i * TW, top: top + 34 + TH });
    });
  });
  await sharp({ create: { width: N * TW, height: items.length * RH, channels: 3, background: "#ccc" } })
    .composite(comps).jpeg({ quality: 78 }).toFile(`out/sheets/${name}.jpg`);
}

for (const x of all) {
  if (results[x.csc]) continue;
  const q = query(x);
  const twin = Object.values(results).find((r) => r.q === q);
  if (twin) { results[x.csc] = { ...x, q, sameAs: twin.csc, cands: twin.cands }; continue; }
  const hits = (await search(q)).slice(0, N + 4);
  const cands = [];
  fs.mkdirSync(`out/cands/${x.csc}`, { recursive: true });
  const grabbed = await Promise.all(hits.map((h) => grab(h.image)));
  for (const [k, h] of hits.entries()) {
    if (cands.length >= N) break;
    const g = grabbed[k];
    if (!g) continue;
    const i = cands.length;
    fs.writeFileSync(`out/cands/${x.csc}/${i}.img`, g.buf);
    const tile = await sharp(g.buf).flatten({ background: "#fff" }).resize(TW, TH, { fit: "contain", background: "#fff" }).jpeg({ quality: 80 }).toBuffer();
    cands.push({ i, image: h.image, page: h.url, title: h.title, w: g.w, h: g.h, host: new URL(h.url).hostname.replace(/^www\./, ""), tile: tile.toString("base64") });
  }
  while (cands.length < N) cands.push({ i: cands.length });
  results[x.csc] = { ...x, q, cands };
  fs.writeFileSync(resPath, JSON.stringify(results));
  console.log(x.rank ?? "", x.csc, `${cands.filter((c) => c.tile).length} imgs | ${q}`);
}

// Sheets of 5 bottles, in input order.
for (let k = 0; k < all.length; k += 5) {
  const items = all.slice(k, k + 5).filter((x) => results[x.csc] && !results[x.csc].sameAs);
  if (items.length) await sheet(`sheet_${String(Number(start) + k).padStart(3, "0")}`, items);
}
fs.writeFileSync("out/review.json", JSON.stringify(all.map((x) => {
  const r = results[x.csc];
  return { rank: x.rank, csc: x.csc, name: x.name, q: r?.q, sameAs: r?.sameAs, cands: r?.cands.map((c) => c.tile ? `${c.i} ${c.host} | ${(c.title ?? "").slice(0, 80)}` : `${c.i} —`) };
}), null, 1));
