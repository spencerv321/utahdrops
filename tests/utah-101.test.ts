import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ARTICLES, SOURCES } from "../lib/utah-101";

// Utah 101 rule: every fact comes from a listed source. These checks keep each
// article's "Sources" list in step with what its text actually cites.
const DIR = join(__dirname, "../app/utah-101/_articles");
const body = (slug: string) => readFileSync(join(DIR, `${slug}.tsx`), "utf8");
const all = (re: RegExp, s: string) => [...s.matchAll(re)].map((m) => m[1]);

test("every article has a body file, and every body file is registered", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".tsx")).map((f) => f.replace(/\.tsx$/, ""));
  assert.deepEqual([...files].sort(), ARTICLES.map((a) => a.slug).sort());
  const index = readFileSync(join(DIR, "index.ts"), "utf8");
  for (const a of ARTICLES) assert.match(index, new RegExp(`"?${a.slug}"?: `), `${a.slug} missing from index.ts`);
});

test("each article lists exactly the sources it cites", () => {
  for (const a of ARTICLES) {
    const cited = new Set(all(/<Cite id="(\w+)"/g, body(a.slug)));
    const listed = new Set(a.sources);
    for (const id of cited) assert.ok(listed.has(id as keyof typeof SOURCES), `${a.slug} cites ${id} but doesn't list it`);
    for (const id of listed) assert.ok(cited.has(id), `${a.slug} lists ${id} but never cites it`);
    assert.equal(listed.size, a.sources.length, `${a.slug} lists a source twice`);
  }
});

test("every source is used by some article", () => {
  const used = new Set(ARTICLES.flatMap((a) => a.sources));
  for (const id of Object.keys(SOURCES)) assert.ok(used.has(id as keyof typeof SOURCES), `${id} is unused`);
});

test("guide links point at real articles and sections", () => {
  // Section ids: h2/h3 ids in article text, plus glossary term ids.
  const ids = new Map(
    ARTICLES.map((a) => {
      const text = body(a.slug);
      return [a.slug, new Set([...all(/ id="([\w-]+)"/g, text), ...all(/\bid: "([\w-]+)"/g, text)])];
    })
  );
  for (const a of ARTICLES) {
    for (const m of body(a.slug).matchAll(/<GuideLink slug="([\w-]+)"(?: hash="([\w-]+)")?/g)) {
      const [, slug, hash] = m;
      assert.ok(ids.has(slug), `${a.slug} links to unknown article ${slug}`);
      if (hash) assert.ok(ids.get(slug)!.has(hash), `${a.slug} links to missing #${hash} on ${slug}`);
    }
  }
});

test("checked dates are real ISO dates, not in the future", () => {
  for (const a of ARTICLES) {
    assert.match(a.checked, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(a.checked + "T00:00:00Z");
    assert.ok(!Number.isNaN(d.getTime()) && d.getTime() <= Date.now(), `${a.slug} checked date ${a.checked}`);
  }
});

test("slugs are unique and URL-safe", () => {
  const slugs = ARTICLES.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});
