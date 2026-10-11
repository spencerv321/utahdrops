// Write notes.json into the repo: lib/bottle-notes.json (text per label +
// csc -> label, shared with other sizes of the same label) and
// data/bottle-note-sources.json (the pages each note was written from).
// Usage: node apply.mjs <repo>
import fs from "node:fs";
import { query } from "../photos/label.mjs";

const repo = process.argv[2];
const notes = JSON.parse(fs.readFileSync("notes.json", "utf8"));
const need = JSON.parse(fs.readFileSync("need.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("catalog.json", "utf8"));
const out = { notes: {}, products: {} }, sources = {};
for (const n of need) {
  const note = notes[n.csc];
  if (!note) continue;
  if (/\s{2}|\.\./.test(note.text) || note.text.length > 520) throw new Error(`check text: ${n.csc}`);
  out.notes[n.csc] = note.text;
  sources[n.csc] = { name: n.name, sources: note.sources };
  for (const m of n.members) out.products[m] = n.csc;
  const q = query(n);
  for (const p of catalog) if (query(p) === q && !out.products[p.csc]) out.products[p.csc] = n.csc;
}
const sort = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(`${repo}/lib/bottle-notes.json`, JSON.stringify({ notes: sort(out.notes), products: sort(out.products) }, null, 1) + "\n");
fs.writeFileSync(`${repo}/data/bottle-note-sources.json`, JSON.stringify(sort(sources), null, 1) + "\n");
console.log(`notes: ${Object.keys(out.notes).length}; products covered: ${Object.keys(out.products).length}`);
