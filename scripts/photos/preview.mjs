// Composite processed WebPs onto the site's espresso background for review.
// Usage: node preview.mjs out.jpg a.webp b.webp ...
import sharp from "sharp";
const [out, ...files] = process.argv.slice(2);
const TW = 170, TH = 230, cols = Math.min(files.length, 8), rows = Math.ceil(files.length / cols);
const comps = [];
for (const [i, f] of files.entries()) {
  const t = await sharp(f).resize(TW - 20, TH - 20, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  comps.push({ input: t, left: (i % cols) * TW + 10, top: Math.floor(i / cols) * TH + 10 });
  comps.push({ input: Buffer.from(`<svg width="${TW}" height="14"><text x="4" y="11" font-size="10" fill="#bcab95" font-family="sans-serif">${f.split("/").pop().slice(0, 28)}</text></svg>`), left: (i % cols) * TW, top: Math.floor(i / cols) * TH + TH - 14 });
}
await sharp({ create: { width: cols * TW, height: rows * TH, channels: 3, background: "#15100d" } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
