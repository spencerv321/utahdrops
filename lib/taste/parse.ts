import type { Tag } from "@/lib/taste/profile";
import { EMPTY_REQUEST, type ResolvedRequest, type TasteRequest } from "@/lib/taste/request";

/**
 * Reads a typed description ("a white wine that's not super common and not
 * too dry, under $30 near Draper") into a TasteRequest with plain rules. Fast,
 * free and predictable; every part remembers the words it came from, and
 * words it couldn't use are returned so the page can say so.
 */
export interface TypedParse extends ResolvedRequest {
  /** Mentions wine (a type, a grape, or the word). */
  wineish: boolean;
  /** Worth taste results: wine plus a taste preference (sweetness, body, style words, novelty). */
  isTaste: boolean;
}

interface Hit {
  start: number;
  end: number;
}

// Grapes people type, mapped to the names profiles use.
const GRAPE_WORDS: [RegExp, string, TasteRequest["type"]][] = [
  [/\bsauvignon blanc\b|\bsauv blanc\b/, "Sauvignon Blanc", "white"],
  [/\bchardonnay\b|\bchard\b/, "Chardonnay", "white"],
  [/\briesling\b/, "Riesling", "white"],
  [/\bpinot gri(?:gio|s)\b/, "Pinot Grigio", "white"],
  [/\bmoscato\b|\bmuscat\b/, "Moscato", null],
  [/\bgew[uü]rztraminer\b/, "Gewürztraminer", "white"],
  [/\balbari[nñ]o\b/, "Albariño", "white"],
  [/\bchenin blanc\b/, "Chenin Blanc", "white"],
  [/\bviognier\b/, "Viognier", "white"],
  [/\bgr[uü]ner(?: veltliner)?\b/, "Grüner Veltliner", "white"],
  [/\bpinot noir\b/, "Pinot Noir", "red"],
  [/\bcabernet sauvignon\b|\bcabernet\b|\bcab\b/, "Cabernet Sauvignon", "red"],
  [/\bmerlot\b/, "Merlot", "red"],
  [/\bzinfandel\b|\bzin\b/, "Zinfandel", "red"],
  [/\bsyrah\b|\bshiraz\b/, "Syrah", "red"],
  [/\bmalbec\b/, "Malbec", "red"],
  [/\btempranillo\b/, "Tempranillo", "red"],
  [/\bsangiovese\b/, "Sangiovese", "red"],
  [/\bgrenache\b|\bgarnacha\b/, "Grenache", "red"],
];

const TYPE_WORDS: [RegExp, TasteRequest["type"]][] = [
  [/\bsparkling\b|\bbubbly\b|\bbubbles\b|\bchampagne\b|\bprosecco\b|\bcava\b|\bfizzy\b/, "sparkling"],
  [/\bros[eé](?![a-z])|\bblush\b|\bpink wine\b|\bwhite zin(?:fandel)?\b/, "rose"],
  [/\bwhites?\b/, "white"],
  [/\breds?\b/, "red"],
];

const SWEET_WORDS: [RegExp, TasteRequest["sweet"]][] = [
  [/\bnot (?:too |very |overly |that |super )?sweet\b|\bnot sugary\b/, "dry"],
  [/\bnot (?:too |very |overly |that |super )?dry\b|\b(?:a )?(?:little|bit|touch|hint|tad) (?:of )?sweet(?:er|ness)?\b|\bslightly sweet\b|\boff[- ]dry\b|\bsemi[- ]dry\b|\bsweet-ish\b|\bsweetish\b/, "offdry"],
  [/\bsweet(?:er)?\b|\bdessert\b/, "sweet"],
  [/\bbone[- ]dry\b|\bdry\b/, "dry"],
];

const BODY_WORDS: [RegExp, TasteRequest["body"]][] = [
  [/\blight(?:er)?[- ]bodied\b|\blight(?:er)?\b|\beasy[- ]drinking\b/, "light"],
  [/\bmedium[- ]bodied\b|\bmedium body\b/, "medium"],
  [/\bfull(?:er)?[- ]bodied\b|\bbold\b|\bbig\b|\bheavy\b|\brich\b/, "full"],
];

const TAG_WORDS: [RegExp, Tag][] = [
  [/\bcrisp\b|\bzesty\b|\btart\b|\bacidic\b|\bbright\b/, "crisp"],
  [/\brefreshing\b/, "refreshing"],
  [/\bfruity\b|\bfruit[- ]forward\b|\bjuicy\b/, "fruity"],
  [/\boaky\b|\boaked\b/, "oaky"],
  [/\bbuttery\b|\bcreamy\b/, "creamy"],
  [/\bfloral\b|\baromatic\b/, "floral"],
  [/\bmineral(?:ly|ity)?\b/, "mineral"],
  [/\bearthy\b/, "earthy"],
  [/\bspicy\b|\bpeppery\b/, "spicy"],
  [/\bsmooth\b|\bsilky\b|\bvelvety\b/, "smooth"],
];

// Occasions map to plain preferences, shown as such ("from 'summer patio'").
const OCCASIONS: [RegExp, Partial<Pick<TasteRequest, "body" | "tags">>][] = [
  [/\bsummer\b|\bpatio\b|\bpool(?:side)?\b|\bpicnic\b|\bporch\b|\bhot day\b|\bbeach\b/, { body: "light", tags: ["refreshing", "crisp"] }],
];

const NOVELTY_WORDS: [RegExp, TasteRequest["novelty"]][] = [
  [/\b(?:unusual|less common|uncommon|different|interesting|obscure) (?:grape|variet(?:y|al)|style)\b/, "style"],
  [/\bhard(?:er)? to find\b|\brare\b|\bscarce\b|\bhard to get\b/, "scarce"],
  [/\bnot (?:super |too |very |that |so )?common\b|\buncommon\b|\bunusual\b|\bdifferent\b|\boff the beaten path\b|\bsomething new\b|\bobscure\b|\blesser[- ]known\b|\bunique\b|\binteresting\b/, "ask"],
];

const STOP = new Set([
  "a", "an", "the", "that", "is", "isn't", "which", "and", "or", "but", "with", "for", "to", "of", "in", "on",
  "i", "i'd", "id", "i'm", "me", "my", "we", "want", "wants", "like", "love", "looking", "find", "need", "something",
  "some", "any", "one", "bottle", "bottles", "wine", "wines", "please", "good", "nice", "great", "not", "too",
  "super", "very", "really", "kind", "sort", "maybe", "would", "enjoy", "can", "get", "it", "its", "it's", "be",
  "under", "below", "less", "than", "around", "about", "near", "by", "at", "cheap", "budget", "price", "priced",
  "dollars", "bucks", "up", "max", "most", "no", "more", "just", "also", "style", "taste", "tastes", "drink",
  "glass", "bit", "little", "touch", "hint", "slightly", "somewhat", "what", "show", "recommend", "suggest",
]);

function mark(hits: Hit[], m: RegExpExecArray | null): boolean {
  if (!m) return false;
  hits.push({ start: m.index, end: m.index + m[0].length });
  return true;
}

export function parseTasteText(q: string, areaLabels: string[] = []): TypedParse {
  const text = ` ${q.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim()} `;
  const hits: Hit[] = [];
  const request: TasteRequest = { ...EMPTY_REQUEST, tags: [] };
  const origin: TypedParse["origin"] = {};
  const phrases: TypedParse["phrases"] = {};
  const set = <K extends keyof TasteRequest>(k: K, v: TasteRequest[K], phrase: string) => {
    request[k] = v;
    origin[k] = "typed";
    phrases[k] = phrases[k] ? `${phrases[k]}, ${phrase}` : phrase;
  };

  // Place first ("near Draper", "in Park City", "near me").
  const near = /\b(?:near|around|close to|by|in)\s+(me|here|my area|[a-z][a-z .'-]{1,30}?)(?=[,.;!?]| under| below| for| with| and| that| which| $)/.exec(text);
  if (near) {
    const place = near[1].trim();
    if (/^(me|here|my area)$/.test(place)) {
      set("area", "me", near[0].trim());
      mark(hits, near);
    } else {
      const label = areaLabels.find((l) => l.toLowerCase() === place);
      if (label) {
        set("area", label, near[0].trim());
        mark(hits, near);
      }
    }
  }
  const nearby = /\bnearby\b|\bclose by\b/.exec(text);
  if (!request.area && nearby) {
    set("area", "me", nearby[0]);
    mark(hits, nearby);
  }

  // Price: "under $30", "less than 30", "$20-30", "between 20 and 30", "around $25".
  const range = /\$?\s?(\d{1,4})\s?(?:-|–|to|and)\s?\$?\s?(\d{1,4})\b/.exec(text);
  const under = /\b(?:under|below|less than|up to|max(?:imum)?|no more than|at most|<)\s*\$?\s?(\d{1,4})\b/.exec(text);
  const around = /\b(?:around|about|roughly|~)\s*\$\s?(\d{1,4})\b/.exec(text);
  const dollars = /\$\s?(\d{1,4})\b/.exec(text);
  if (under) {
    set("maxPrice", Number(under[1]), under[0].trim());
    mark(hits, under);
  } else if (range && /\$|between|dollars|bucks/.test(text)) {
    const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
    set("minPrice", a, range[0].trim());
    set("maxPrice", b, range[0].trim());
    mark(hits, range);
  } else if (around) {
    // "around $25" allows a little over, and says so on the chip.
    set("maxPrice", Math.round(Number(around[1]) * 1.2), around[0].trim());
    mark(hits, around);
  } else if (dollars) {
    set("maxPrice", Number(dollars[1]), dollars[0].trim());
    mark(hits, dollars);
  }
  const cheap = /\b(?:cheap|inexpensive|budget|affordable|bargain)\b/.exec(text);
  if (cheap && request.maxPrice == null) {
    set("maxPrice", 15, cheap[0]);
    mark(hits, cheap);
  }

  // Grape (a hard constraint when named), then type. White Zinfandel is a
  // rosé style, not the red grape's wine.
  const whiteZin = /\bwhite zin(?:fandel)?\b/.exec(text);
  if (whiteZin) {
    set("type", "rose", whiteZin[0]);
    mark(hits, whiteZin);
  }
  for (const [re, grape, type] of whiteZin ? [] : GRAPE_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    set("grape", grape, m[0]);
    if (type) set("type", type, m[0]);
    mark(hits, m);
    break;
  }
  if (!request.type) {
    for (const [re, type] of TYPE_WORDS) {
      const m = re.exec(text);
      if (!m) continue;
      set("type", type, m[0]);
      mark(hits, m);
      break;
    }
  }

  // Preferences. Order matters: "not too dry" before "dry", "not super common" before "common".
  for (const [re, pref] of SWEET_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    set("sweet", pref, m[0]);
    mark(hits, m);
    break;
  }
  for (const [re, pref] of BODY_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    set("body", pref, m[0]);
    mark(hits, m);
    break;
  }
  for (const [re, tag] of TAG_WORDS) {
    const m = re.exec(text);
    if (!m || request.tags.includes(tag)) continue;
    set("tags", [...request.tags, tag], m[0]);
    mark(hits, m);
  }
  for (const [re, add] of OCCASIONS) {
    const all = [...text.matchAll(new RegExp(re.source, "g"))];
    if (!all.length) continue;
    const m = all[0] as RegExpExecArray;
    for (const x of all) mark(hits, x as RegExpExecArray);
    if (add.body && !request.body) set("body", add.body, m[0]);
    const tags = (add.tags ?? []).filter((t) => !request.tags.includes(t));
    if (tags.length) set("tags", [...request.tags, ...tags], m[0]);
  }
  for (const [re, pref] of NOVELTY_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    set("novelty", pref, m[0]);
    mark(hits, m);
    break;
  }
  request.tags = request.tags.slice(0, 4);

  const wineish = !!request.type || !!request.grape || /\bwines?\b|\bvino\b/.test(text);
  // A budget or place alone is ordinary filtering; taste picks need a taste.
  const isTaste = wineish && !!(request.sweet || request.body || request.tags.length || request.novelty);

  // Words not covered by any rule (and not filler) are reported back.
  const covered = (i: number) => hits.some((h) => i >= h.start && i < h.end);
  const unused: string[] = [];
  const word = /[a-z][a-z'-]*/g;
  let w: RegExpExecArray | null;
  while ((w = word.exec(text))) {
    if (covered(w.index)) continue;
    const t = w[0].replace(/'s$/, "");
    if (STOP.has(t) || t.length < 3) continue;
    if (!unused.includes(t)) unused.push(t);
  }

  return { request, origin, phrases, unused, wineish, isTaste };
}
