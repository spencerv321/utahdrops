// For each target bottle: web search (DuckDuckGo HTML, Brave fallback), fetch the
// top pages, keep the paragraphs that carry facts (who makes it, age, proof,
// grapes, tasting notes). Output: out/sources.json { csc: { q, pages: [{url, text}] } }.
// Usage: node gather.mjs targets.json [start] [count]
import fs from "node:fs";
import * as cheerio from "cheerio";
import { query } from "../photos/label.mjs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const [file, start = "0", count = "1000"] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(file, "utf8")).slice(Number(start), Number(start) + Number(count));
fs.mkdirSync("out", { recursive: true });
const path = process.env.OUT ?? "out/sources.json";
const done = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
const SKIP = /youtube|facebook|instagram|reddit|pinterest|tiktok|twitter|x\.com|amazon\.|ebay|wikipedia\.org\/wiki\/List|totalwine|vivino\.com\/search|walmart/;
const FACT = /\b(nose|palate|finish|aroma|notes? of|flavou?rs?|tast|aged|years?|proof|abv|alcohol|distill|mash ?bill|barrel|cask|oak|grape|vineyard|blend|vintage|fermented|agave|botanical|brewed|hops?|ipa|style|made|produced|crafted|region|valley|estate)\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function search(q) {
  const wait = last + 6000 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const engines = [
    [`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, /uddg=([^&"]+)/g],
    [`https://search.brave.com/search?q=${encodeURIComponent(q)}`, /<a href="(https?:\/\/[^"]+)"[^>]*class="[^"]*(?:svelte|heading|result)/g],
  ];
  for (const [u, re] of engines) {
    try {
      const t = await (await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "en-US" }, signal: AbortSignal.timeout(15000) })).text();
      const urls = [...new Set([...t.matchAll(re)].map((m) => decodeURIComponent(m[1])))].filter((x) => !/brave\.com|duckduckgo/.test(x) && !SKIP.test(x));
      if (urls.length >= 3) return urls;
    } catch {}
  }
  return [];
}

async function page(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US" }, signal: AbortSignal.timeout(12000), redirect: "follow" });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) return null;
    const $ = cheerio.load(await r.text());
    $("script,style,nav,footer,header,aside,form,noscript,svg").remove();
    const meta = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
    const title = $("title").first().text().trim();
    const paras = [];
    $("p,li,dd,td").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t.length >= 40 && t.length <= 900 && FACT.test(t) && !paras.includes(t)) paras.push(t);
    });
    let text = [meta, ...paras].filter(Boolean).join("\n");
    if (text.length > 1800) text = text.slice(0, 1800) + "…";
    return text.length >= 120 ? { url, title: title.slice(0, 120), text } : null;
  } catch {
    return null;
  }
}

for (const x of all) {
  if (done[x.csc]) continue;
  const base = query(x).replace(/ bottle$/, "");
  const q = `${base} ${/WINE|RED|WHITE|ROSE|CHAMP|SPARKL|PORT|SAKE/i.test(x.category ?? "") ? "wine" : ""} tasting notes`.replace(/\s+/g, " ");
  const urls = (await search(q)).slice(0, 6);
  const pages = (await Promise.all(urls.map(page))).filter(Boolean).slice(0, 4);
  done[x.csc] = { name: x.name, size_ml: x.size_ml, category: x.category, dabs: x.dabs, dabsText: x.text, q, pages };
  fs.writeFileSync(path, JSON.stringify(done));
  console.log(x.rank, x.csc, `${pages.length} pages | ${q}`);
}
