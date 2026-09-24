// Photo pilot: for each sample product, search Bing Images, download the top
// candidates, and write contact sheets + an HTML report for manual review.
// Throwaway prototype — runs in Actions only (photo-pilot.yml).
import * as cheerio from "cheerio";
import sharp from "sharp";
import fs from "node:fs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const N = 6;
const items = JSON.parse(fs.readFileSync(new URL("./sample.json", import.meta.url)));
const OUT = "out";
fs.mkdirSync(OUT, { recursive: true });

function query(x) {
  const name = x.name
    .replace(/\s+\d+(\.\d+)?\s*(ml|m|l)?$/i, "")
    .replace(/\b\d+\s?ml\b/i, "")
    .trim();
  const size = x.sizeMl ? (x.sizeMl >= 1000 ? `${x.sizeMl / 1000}L` : `${x.sizeMl}ml`) : "";
  return `${name} ${size}`.trim();
}

async function search(q) {
  const r = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&qft=+filterui:photo-photo`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  const $ = cheerio.load(await r.text());
  const out = [];
  $("a.iusc").each((_, a) => {
    try {
      const m = JSON.parse($(a).attr("m"));
      out.push({ url: m.murl, thumb: m.turl, title: m.t, page: m.purl });
    } catch {}
  });
  return out.slice(0, N);
}

async function grab(c) {
  for (const url of [c.url, c.thumb]) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const meta = await sharp(buf).metadata();
      const tile = await sharp(buf)
        .flatten({ background: "#fff" })
        .resize(280, 280, { fit: "contain", background: "#fff" })
        .jpeg({ quality: 80 })
        .toBuffer();
      return { tile, w: meta.width, h: meta.height, via: url === c.url ? "full" : "thumb" };
    } catch {}
  }
  return null;
}

const rows = [];
for (const x of items) {
  const q = query(x);
  let cands = [];
  try {
    cands = await search(q);
  } catch (e) {
    console.log("search failed", x.csc, e.message);
  }
  const comps = [];
  const got = [];
  for (let i = 0; i < N; i++) {
    const c = cands[i];
    const g = c ? await grab(c) : null;
    const label = Buffer.from(
      `<svg width="280" height="36"><rect width="280" height="36" fill="#222"/><text x="8" y="25" font-size="20" fill="#fff" font-family="sans-serif">#${i} ${g ? `${g.w}x${g.h}` : "—"}</text></svg>`
    );
    comps.push({ input: label, left: i * 280, top: 0 });
    if (g) comps.push({ input: g.tile, left: i * 280, top: 36 });
    got.push(c ? { ...c, ok: !!g, w: g?.w, h: g?.h, via: g?.via, b64: g?.tile.toString("base64") } : null);
  }
  const header = Buffer.from(
    `<svg width="${N * 280}" height="40"><rect width="100%" height="40" fill="#f3e9d2"/><text x="10" y="28" font-size="22" font-family="sans-serif">${x.csc} · ${x.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")} · $${x.price}</text></svg>`
  );
  await sharp({ create: { width: N * 280, height: 356, channels: 3, background: "#ddd" } })
    .composite([{ input: header, left: 0, top: 0 }, ...comps.map((c) => ({ ...c, top: c.top + 40 }))])
    .jpeg({ quality: 80 })
    .toFile(`${OUT}/sheet_${x.csc}.jpg`);
  rows.push({ ...x, q, cands: got });
  console.log(x.csc, `${cands.length} results, ${got.filter((g) => g?.ok).length} downloaded | ${q}`);
  await new Promise((r) => setTimeout(r, 1500));
}

fs.writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify(rows.map((r) => ({ ...r, cands: r.cands.map((c) => c && { ...c, b64: undefined }) })), null, 1)
);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
fs.writeFileSync(
  `${OUT}/report.html`,
  `<!doctype html><meta charset=utf-8><title>Photo pilot</title><style>body{font:14px system-ui;margin:16px}h3{margin:24px 0 6px}.r{display:flex;gap:8px;flex-wrap:wrap}.c{width:180px;font-size:11px}.c img{width:180px;height:180px;object-fit:contain;background:#fff;border:1px solid #ddd}</style>` +
    rows
      .map(
        (r) =>
          `<h3>${esc(r.csc)} · ${esc(r.name)} · $${r.price}</h3><div>query: ${esc(r.q)}</div><div class=r>` +
          r.cands
            .map((c, i) =>
              c?.ok
                ? `<div class=c><img src="data:image/jpeg;base64,${c.b64}"><br>#${i} ${c.w}×${c.h}<br><a href="${esc(c.page)}">${esc(c.title).slice(0, 60)}</a></div>`
                : `<div class=c>#${i} —</div>`
            )
            .join("") +
          `</div>`
      )
      .join("")
);
