// Apply picks: process each picked candidate into the repo's public/bottles,
// write lib/bottle-photos.json (csc -> photo, shared across sizes of a label)
// and data/bottle-photo-sources.json (where each photo came from).
// picks.json: { csc: index | [index, note] | [index, note, threshold, "keep"] | null }
// Usage: node apply.mjs <repo>
import fs from "node:fs";
import { processPhoto } from "./process.mjs";
import { query } from "./label.mjs";

const repo = process.argv[2];
const picks = JSON.parse(fs.readFileSync("picks.json", "utf8"));
const results = JSON.parse(fs.readFileSync("out/results.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("catalog.json", "utf8"));
const manifestPath = `${repo}/lib/bottle-photos.json`, sourcesPath = `${repo}/data/bottle-photo-sources.json`;
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sources = fs.existsSync(sourcesPath) ? JSON.parse(fs.readFileSync(sourcesPath, "utf8")) : {};
fs.mkdirSync(`${repo}/public/bottles`, { recursive: true });
fs.mkdirSync(`${repo}/data`, { recursive: true });
fs.mkdirSync("preview", { recursive: true });

let made = 0;
for (const [csc, pick] of Object.entries(picks)) {
  if (pick == null) continue;
  const [i, note, threshold = 225, mode = "cut", step = 12] = Array.isArray(pick) ? pick : [pick];
  const r = results[csc];
  const c = r?.cands[i];
  if (!c?.image) { console.log("missing candidate", csc, i); continue; }
  const id = csc;
  const out = `${repo}/public/bottles/${id}.webp`;
  const { w, h, bytes } = await processPhoto(`out/cands/${csc}/${i}.img`, out, threshold, mode, step);
  fs.copyFileSync(out, `preview/${csc}.webp`);
  manifest.files[id] = [w, h];
  sources[id] = { name: r.name, image: c.image, host: c.host, ...(note ? { note } : {}) };
  // Every product that shares this label (other sizes) gets the same photo.
  for (const [k, v] of Object.entries(results)) if (k === csc || v.sameAs === csc) manifest.products[k] = id;
  for (const p of catalog) if (query(p) === r.q && !manifest.products[p.csc]) manifest.products[p.csc] = id;
  made++;
  if (bytes > 40000) console.log("large", csc, bytes);
}
const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(manifestPath, JSON.stringify({ files: sortObj(manifest.files), products: sortObj(manifest.products) }, null, 0).replace(/\],"/g, '],\n"').replace(/","/g, '",\n"') + "\n");
fs.writeFileSync(sourcesPath, JSON.stringify(sortObj(sources), null, 1) + "\n");
console.log(`photos: ${made}; products covered: ${Object.keys(manifest.products).length}`);
