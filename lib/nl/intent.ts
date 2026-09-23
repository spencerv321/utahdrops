const QUESTION_WORDS = new Set([
  "under", "over", "below", "above", "less", "more", "than", "around", "near", "nearby", "me",
  "cheap", "cheapest", "best", "good", "great", "high", "end", "for", "with", "like", "similar",
  "something", "gift", "smooth", "peaty", "sweet", "dry", "bold", "light", "stock",
]);

/**
 * Does this read like a question for AI search ("peaty scotch under $60 near
 * me") rather than a product name ("weller 12")? Names are short and literal;
 * questions carry prices or describing words.
 */
export function looksLikeQuestion(q: string): boolean {
  const text = q.toLowerCase();
  if (/\$\s?\d/.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const hits = words.filter((w) => QUESTION_WORDS.has(w.replace(/[^a-z]/g, ""))).length;
  return hits >= 1 && words.length >= 3;
}

// DABS names say "10YR", so "10 year" words only get in the way.
const FILLER = [
  "allocated", "limited", "a", "an", "the", "in", "of", "and", "or", "to", "is", "any", "some",
  "year", "years", "yr", "old", "aged", "bottle", "bottles",
];

/**
 * Keyword fallback for a question when AI search is off or finds nothing:
 * keep the nouns ("scotch"), turn "under $60" into a price cap and
 * "allocated" into a status filter.
 */
export function roughQuery(q: string): { q: string; maxPrice?: number; status?: string } {
  const text = q.toLowerCase();
  const price = text.match(/(?:under|below|less than|<)\s*\$?\s?(\d+)/);
  const status = /\ballocated\b/.test(text) ? "A" : /\blimited\b/.test(text) ? "L" : undefined;
  const words = text
    .replace(/\$\s?\d+(\.\d+)?/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9']/g, ""))
    .filter((w) => w && !QUESTION_WORDS.has(w) && !/^\d+$/.test(w) && !FILLER.includes(w));
  return { q: words.join(" "), maxPrice: price ? Number(price[1]) : undefined, status };
}
