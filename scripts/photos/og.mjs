// Share-card copies of the bottle photos: Satori (next/og) can't read WebP, so
// each public/bottles/<id>.webp gets a palette PNG in assets/og/bottles/
// (visually identical, ~28 KB). Run after apply.mjs; skips files already made.
// Usage: node og.mjs <repo>
import fs from "node:fs";
import sharp from "sharp";

const repo = process.argv[2];
const { files } = JSON.parse(fs.readFileSync(`${repo}/lib/bottle-photos.json`, "utf8"));
const out = `${repo}/assets/og/bottles`;
fs.mkdirSync(out, { recursive: true });
let made = 0;
for (const id of Object.keys(files)) {
  const src = `${repo}/public/bottles/${id}.webp`, dst = `${out}/${id}.png`;
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;
  await sharp(src).png({ palette: true, quality: 90, effort: 10 }).toFile(dst);
  made++;
}
// Remove copies whose photo is gone.
for (const f of fs.readdirSync(out)) if (!files[f.replace(/\.png$/, "")]) fs.rmSync(`${out}/${f}`);
console.log(`share-card PNGs made: ${made}; total ${Object.keys(files).length}`);
