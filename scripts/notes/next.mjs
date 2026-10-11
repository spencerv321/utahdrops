// Print sources for the next N gathered bottles that have no note yet.
import fs from "node:fs";
const n = Number(process.argv[2] ?? 5), max = Number(process.argv[3] ?? 900);
const need = JSON.parse(fs.readFileSync("need.json"));
const notes = fs.existsSync("notes.json") ? JSON.parse(fs.readFileSync("notes.json")) : {};
const src = {};
for (const f of ["out/sources.json", "out/sources2.json", "out/sources3.json"]) if (fs.existsSync(f)) Object.assign(src, JSON.parse(fs.readFileSync(f)));
let shown = 0;
for (const x of need) {
  if (shown >= n) break;
  if (x.csc in notes || !src[x.csc]) continue;
  shown++;
  console.log(`\n######## ${x.csc} · ${x.name} · ${x.category} · DABS(${x.dabs}): ${x.text ?? "-"}`);
  src[x.csc].pages.forEach((p, i) => console.log(`--[${i}] ${p.url}\n${p.text.slice(0, max)}`));
}
const left = need.filter((x) => !(x.csc in notes));
console.log(`\n(${left.length} without a note; ${left.filter((x) => src[x.csc]).length} of them gathered)`);
