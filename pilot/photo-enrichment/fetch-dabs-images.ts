/**
 * Photo pilot follow-up: the image DABS attaches to each CSC.
 *
 *   npx tsx pilot/photo-enrichment/fetch-dabs-images.ts            (the frozen 100)
 *   npx tsx pilot/photo-enrichment/fetch-dabs-images.ts siblings   (data/sibling-codes.json → data/dabs-images-siblings.json)
 *
 * The public product-detail page (Products/GetDetailUrl → ProductDetail/Index,
 * the same two-step flow lib/dabs/detail.ts and the store job use) embeds the
 * product photo inline as a base64 <img alt="Product bottle or can">. No other
 * public DABS surface carries an image (catalog JSON, locator scripts, monthly
 * XLSX, drawing and allocated pages were checked). One detail page per CSC,
 * through politeFetch, so the normal DABS pacing applies.
 *
 * Writes data/dabs-images.json and the decoded images to .cache/dabs-<sha256>.<ext>.
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
config({ path: ".env.local", quiet: true });

const DIR = __dirname;

async function main() {
  const { politeFetch } = await import("../../lib/dabs/client");
  const { DABS_LOCATOR_URL } = await import("../../lib/config");
  const siblings = process.argv[2] === "siblings";
  const sample = siblings
    ? (JSON.parse(readFileSync(join(DIR, "data/sibling-codes.json"), "utf8")).codes as { csc: string }[])
    : (JSON.parse(readFileSync(join(DIR, "data/sample.json"), "utf8")).products as { csc: string }[]);
  const outPath = join(DIR, siblings ? "data/dabs-images-siblings.json" : "data/dabs-images.json");
  const out: Record<string, unknown> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  for (const { csc } of sample) {
    if (out[csc] && !(out[csc] as { error?: string }).error) continue;
    const rec: Record<string, unknown> = { csc, fetched_at: new Date().toISOString() };
    try {
      const prime = await politeFetch(`${DABS_LOCATOR_URL}/Products/GetDetailUrl?sku=${csc}`, { headers: { "X-Requested-With": "XMLHttpRequest", Referer: DABS_LOCATOR_URL } }, undefined, { retries: 1 });
      const cookie = (prime.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
      const res = await politeFetch(`${DABS_LOCATOR_URL}/ProductDetail/Index`, { headers: { Referer: DABS_LOCATOR_URL } }, cookie, { retries: 0 });
      rec.http_status = res.status;
      const html = await res.text();
      rec.page_bytes = html.length;
      const $ = cheerio.load(html);
      rec.page_name = $("span").filter((_, el) => ($(el).attr("style") ?? "").includes("200%")).first().text().replace(/\s+/g, " ").trim();
      const imgs = $("img").toArray().map((el) => ({ src: $(el).attr("src") ?? "", alt: $(el).attr("alt") ?? "" }))
        .filter((i) => i.src.startsWith("data:image/"));
      rec.inline_images = imgs.length;
      const prod = imgs.find((i) => /bottle|can/i.test(i.alt)) ?? imgs[0];
      if (prod) {
        const m = prod.src.match(/^data:image\/([\w+.-]+);base64,\s*([\s\S]+)$/);
        if (m) {
          const buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
          const sha = createHash("sha256").update(buf).digest("hex");
          const ext = m[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
          writeFileSync(join(DIR, ".cache", `dabs-${sha}.${ext}`), buf);
          Object.assign(rec, { has_image: true, mime: `image/${m[1]}`, bytes: buf.length, sha256: sha, file: `dabs-${sha}.${ext}`, alt: prod.alt });
        }
      } else rec.has_image = false;
    } catch (e) {
      rec.error = (e as Error).message.slice(0, 200);
    }
    out[csc] = rec;
    writeFileSync(outPath, JSON.stringify(out, null, 1));
    console.log(csc, rec.http_status ?? "", rec.has_image ? `${rec.mime} ${rec.bytes}` : rec.error ?? "no image");
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
