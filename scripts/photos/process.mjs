// Turn a picked candidate into a site photo: cut out the white backdrop
// (flood fill from the edges through near-white pixels), trim, resize to
// 400px tall, WebP with alpha.
// Usage: node process.mjs <in> <out.webp> [threshold=232] [mode=cut|keep]
import sharp from "sharp";

export async function processPhoto(input, out, threshold = 232, mode = "cut", step = 12) {
  const img = sharp(input).flatten({ background: "#fff" }).resize({ height: 900, width: 900, fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const alpha = Buffer.alloc(W * H, 255);
  if (mode === "cut") {
    // Backdrop = pixels reachable from the border through light, near-grey
    // pixels, each step changing only a little (follows soft shadows and
    // gradients, stops at the bottle's edge). threshold = how light a border
    // seed must be; the walk itself may go down to grey 150.
    const R = (p) => data[p * C], G = (p) => data[p * C + 1], B = (p) => data[p * C + 2];
    const greyish = (p) => Math.min(R(p), G(p), B(p)) >= 150 && Math.max(R(p), G(p), B(p)) - Math.min(R(p), G(p), B(p)) <= 28;
    const close = (p, q) => Math.abs(R(p) - R(q)) + Math.abs(G(p) - G(q)) + Math.abs(B(p) - B(q)) <= step;
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let x = 0; x < W; x++) stack.push(x, -1, (H - 1) * W + x, -1);
    for (let y = 0; y < H; y++) stack.push(y * W, -1, y * W + W - 1, -1);
    while (stack.length) {
      const from = stack.pop(), p = stack.pop();
      if (seen[p]) continue;
      if (from < 0 ? Math.min(R(p), G(p), B(p)) < threshold : !(greyish(p) && close(p, from))) continue;
      seen[p] = 1;
      alpha[p] = 0;
      const x = p % W;
      if (x > 0) stack.push(p - 1, p);
      if (x < W - 1) stack.push(p + 1, p);
      if (p >= W) stack.push(p - W, p);
      if (p < W * (H - 1)) stack.push(p + W, p);
    }
    // Drop specks: keep opaque regions at least 3% the size of the largest one.
    const comp = new Int32Array(W * H).fill(-1), sizes = [];
    for (let p0 = 0; p0 < W * H; p0++) {
      if (!alpha[p0] || comp[p0] >= 0) continue;
      const id = sizes.length, st = [p0];
      let n = 0;
      comp[p0] = id;
      while (st.length) {
        const p = st.pop(); n++;
        const x = p % W;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < W * (H - 1) ? p + W : -1])
          if (q >= 0 && alpha[q] && comp[q] < 0) { comp[q] = id; st.push(q); }
      }
      sizes.push(n);
    }
    const big = Math.max(0, ...sizes);
    for (let p = 0; p < W * H; p++) if (alpha[p] && sizes[comp[p]] < big * 0.03) alpha[p] = 0;
    // Soften the edge: opaque pixels next to the backdrop get partial alpha by lightness.
    for (let p = 0; p < W * H; p++) {
      if (!alpha[p]) continue;
      const x = p % W;
      const edge = (x > 0 && !alpha[p - 1]) || (x < W - 1 && !alpha[p + 1]) || (p >= W && !alpha[p - W]) || (p < W * (H - 1) && !alpha[p + W]);
      if (edge) {
        const l = (data[p * C] + data[p * C + 1] + data[p * C + 2]) / 3;
        alpha[p] = Math.max(60, Math.min(255, Math.round(255 - (l - 160) * 2)));
      }
    }
  }
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    rgba[p * 4] = data[p * C]; rgba[p * 4 + 1] = data[p * C + 1]; rgba[p * 4 + 2] = data[p * C + 2]; rgba[p * 4 + 3] = alpha[p];
  }
  let s = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
  s = sharp(await s.png().toBuffer()).trim({ background: mode === "cut" ? { r: 0, g: 0, b: 0, alpha: 0 } : "#ffffff", threshold: 10 });
  const buf = await s.resize({ height: 400, width: 300, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
  const meta = await sharp(buf).metadata();
  if (out) await sharp(buf).toFile(out);
  return { w: meta.width, h: meta.height, bytes: buf.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(await processPhoto(process.argv[2], process.argv[3], Number(process.argv[4] ?? 232), process.argv[5] ?? "cut"));
