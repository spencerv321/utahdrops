/**
 * Evaluation set for taste search (scripts/taste-eval.ts, report.yml →
 * tasteeval). Authored cases plus phrasings modeled on real /search queries
 * (report.yml → searchlog; aggregated, no visitor data). Each case states
 * what the request must be read as; the runner also checks every result
 * against the hard constraints and traces every quoted reason to DABS text.
 */
export interface EvalCase {
  id: string;
  group: "name" | "sweet-body" | "budget-place" | "novelty" | "missing" | "no-stock" | "identity" | "contradiction" | "model" | "followup" | "guided";
  q?: string;
  params?: Record<string, string>;
  /** The visitor's area setting (cookie), by label. */
  picker?: string;
  expect: {
    taste: boolean;
    type?: string | null;
    maxPrice?: number | null;
    minPrice?: number | null;
    area?: string | null;
    sweet?: string | null;
    body?: string | null;
    tags?: string[];
    novelty?: string | null;
    grape?: string | null;
    clarify?: "novelty" | "type" | "area" | null;
    /** Name search: the first result's name must match. */
    nameTop?: string;
    /** At least this many picks (fewer is fine when the data can't support more). */
    minResults?: number;
    empty?: boolean;
    unused?: string[];
  };
  /** Apply a follow-up to the resolved request, then re-check constraints. */
  followup?: "sweeter" | "lighter" | "cheaper";
}

export const EVAL_CASES: EvalCase[] = [
  // Exact names and aliases stay deterministic name search.
  { id: "name-blantons", group: "name", q: "Blanton's", expect: { taste: false, nameTop: "BLANTON" } },
  { id: "name-kj-chard", group: "name", q: "kendall jackson chardonnay", expect: { taste: false, nameTop: "KENDALL JACKSON" } },
  { id: "name-eh-taylor", group: "name", q: "EH Taylor", expect: { taste: false, nameTop: "TAYLOR" } },
  { id: "name-josh-cab", group: "name", q: "josh cabernet", expect: { taste: false, nameTop: "JOSH" } },
  { id: "name-prosecco", group: "name", q: "prosecco", expect: { taste: false } },
  { id: "name-whispering-angel", group: "name", q: "whispering angel", expect: { taste: false, nameTop: "WHISPERING ANGEL" } },
  { id: "name-caymus", group: "name", q: "caymus", expect: { taste: false, nameTop: "CAYMUS" } },
  { id: "name-19-crimes", group: "name", q: "19 crimes", expect: { taste: false, nameTop: "19 CRIMES" } },

  // Sweetness and body.
  { id: "headline", group: "sweet-body", q: "A white wine that's not super common and not too dry, under $30 near Draper", expect: { taste: true, type: "white", maxPrice: 30, area: "Draper", sweet: "offdry", novelty: "ask", clarify: "novelty", minResults: 3 } },
  { id: "sweet-red", group: "sweet-body", q: "sweet red wine", expect: { taste: true, type: "red", sweet: "sweet", minResults: 1 } },
  { id: "not-too-sweet-white", group: "sweet-body", q: "white wine not too sweet", expect: { taste: true, type: "white", sweet: "dry", minResults: 3 } },
  { id: "dry-sparkling", group: "sweet-body", q: "dry sparkling under $20", expect: { taste: true, type: "sparkling", sweet: "dry", maxPrice: 20, minResults: 3 } },
  { id: "light-refreshing-patio", group: "sweet-body", q: "light and refreshing white for a summer patio", expect: { taste: true, type: "white", body: "light", tags: ["refreshing", "crisp"], minResults: 3 } },
  { id: "bold-red", group: "sweet-body", q: "bold red under $25", expect: { taste: true, type: "red", body: "full", maxPrice: 25, minResults: 3 } },
  { id: "light-red", group: "sweet-body", q: "a lighter red wine", expect: { taste: true, type: "red", body: "light", minResults: 1 } },
  { id: "crisp-white", group: "sweet-body", q: "crisp white wine under $15", expect: { taste: true, type: "white", tags: ["crisp"], maxPrice: 15, minResults: 3 } },
  { id: "buttery-chard", group: "sweet-body", q: "buttery oaky chardonnay", expect: { taste: true, grape: "Chardonnay", tags: ["oaky", "creamy"] } },
  { id: "off-dry-riesling", group: "sweet-body", q: "off-dry riesling", expect: { taste: true, grape: "Riesling", sweet: "offdry" } },
  { id: "sweet-bubbly", group: "sweet-body", q: "something sweet and bubbly", expect: { taste: true, type: "sparkling", sweet: "sweet" } },
  { id: "smooth-red", group: "sweet-body", q: "smooth red wine under 20", expect: { taste: true, type: "red", tags: ["smooth"], maxPrice: 20, minResults: 3 } },
  { id: "dry-rose", group: "sweet-body", q: "bone dry rosé", expect: { taste: true, type: "rose", sweet: "dry", minResults: 2 } },
  { id: "fruity-rose", group: "sweet-body", q: "fruity rose not too dry", expect: { taste: true, type: "rose", sweet: "offdry", tags: ["fruity"] } },

  // Budget and place.
  { id: "range", group: "budget-place", q: "red wine between $20 and $30 full-bodied", expect: { taste: true, type: "red", minPrice: 20, maxPrice: 30, body: "full" } },
  { id: "around", group: "budget-place", q: "white wine around $25, crisp", expect: { taste: true, maxPrice: 30, tags: ["crisp"] } },
  { id: "cheap", group: "budget-place", q: "cheap sweet white wine", expect: { taste: true, maxPrice: 15, sweet: "sweet" } },
  { id: "near-park-city", group: "budget-place", q: "dry white wine near Park City", expect: { taste: true, area: "Park City", sweet: "dry" } },
  { id: "picker-area", group: "budget-place", q: "crisp white wine", picker: "Sandy", expect: { taste: true, area: "Sandy", tags: ["crisp"] } },
  { id: "typed-beats-picker", group: "budget-place", q: "crisp white wine near Draper", picker: "Sandy", expect: { taste: true, area: "Draper" } },
  { id: "near-me-no-area", group: "budget-place", q: "dry red near me", expect: { taste: true, area: "me", clarify: "area" } },
  { id: "url-area-any", group: "budget-place", q: "crisp white wine", picker: "Sandy", params: { area: "any" }, expect: { taste: true, area: null } },

  // "Not super common" and friends.
  { id: "unusual-white", group: "novelty", q: "an unusual white wine under $25", expect: { taste: true, novelty: "ask", clarify: "novelty" } },
  { id: "unusual-grape", group: "novelty", q: "white wine with a less common grape", expect: { taste: true, novelty: "style", clarify: null } },
  { id: "hard-to-find-red", group: "novelty", q: "hard to find red wine", expect: { taste: true, novelty: "scarce" } },
  { id: "novelty-choice", group: "novelty", q: "an unusual white wine under $25", params: { novel: "scarce" }, expect: { taste: true, novelty: "scarce", clarify: null } },

  // Missing information: return fewer, never pad.
  { id: "sweet-sparkling-cheap", group: "missing", q: "sweet sparkling wine under $10 near Draper", expect: { taste: true, maxPrice: 10 } },
  { id: "full-bodied-rose", group: "missing", q: "full-bodied rosé", expect: { taste: true, type: "rose", body: "full" } },
  { id: "floral-red", group: "missing", q: "floral red wine under $12", expect: { taste: true, tags: ["floral"], maxPrice: 12 } },
  { id: "no-type", group: "missing", q: "a wine that's not too dry under $20", expect: { taste: true, type: null, clarify: "type" } },

  // No qualifying nearby stock: say so, offer to widen, don't widen.
  { id: "tiny-budget-area", group: "no-stock", q: "dry white wine under $5 near Draper", expect: { taste: true, maxPrice: 5, area: "Draper", empty: true } },
  { id: "far-area", group: "no-stock", q: "off-dry riesling near Moab", expect: { taste: true, area: "Moab" } },

  // Vintages / editions / reused codes: never profiled (checked by the runner).
  { id: "vintage-bottle", group: "identity", q: "ridge petite sirah", expect: { taste: false } },
  { id: "red-zin-vs-white-zin", group: "identity", q: "white zinfandel not too dry", expect: { taste: true, type: "rose", grape: null } },

  // Contradictions: explicit contradictions exclude; conflicts are explained.
  { id: "dry-and-sweet", group: "contradiction", q: "a sweet dry white wine", expect: { taste: true } },
  { id: "light-and-bold", group: "contradiction", q: "light but bold red", expect: { taste: true, body: "light" } },
  { id: "sweet-max-followup", group: "followup", q: "sweet white wine", followup: "sweeter", expect: { taste: true, sweet: "sweet" } },

  // Unread words: shown, and the request still works without the model.
  { id: "unread-birthday", group: "model", q: "white wine for my sister's birthday, not too dry", expect: { taste: true, sweet: "offdry", unused: ["sister", "birthday"] } },
  // Budget only (no taste words the rules can read): ordinary search, unless
  // the model step is on and finds taste words in "barbecue".
  { id: "unread-bbq", group: "model", q: "red wine for a barbecue under $20", expect: { taste: false, maxPrice: 20 } },
  // Pairings aren't something we have evidence for: without the model step this
  // stays ordinary search (with it, the model may only add taste words).
  { id: "unread-salmon", group: "model", q: "white wine that goes with salmon", expect: { taste: false, type: "white" } },

  // Follow-ups keep earlier constraints.
  { id: "fu-sweeter", group: "followup", q: "A white wine that's not super common and not too dry, under $30 near Draper", followup: "sweeter", expect: { taste: true, maxPrice: 30, area: "Draper", sweet: "sweet" } },
  { id: "fu-lighter", group: "followup", q: "bold red under $25", followup: "lighter", expect: { taste: true, maxPrice: 25, body: "medium" } },
  { id: "fu-cheaper", group: "followup", q: "crisp white wine under $30 near Sandy", followup: "cheaper", expect: { taste: true, maxPrice: 25, area: "Sandy", tags: ["crisp"] } },

  // Guided panel: same request, no typed words.
  { id: "guided-basic", group: "guided", params: { via: "guided", wine: "white", max: "20", sweet: "offdry", body: "any", like: "", novel: "none", area: "any" }, expect: { taste: true, type: "white", maxPrice: 20, sweet: "offdry" } },
  { id: "guided-area", group: "guided", params: { via: "guided", wine: "red", max: "30", sweet: "any", body: "light", like: "fruity", novel: "none", area: "Salt Lake City" }, expect: { taste: true, type: "red", body: "light", area: "Salt Lake City", tags: ["fruity"] } },
];
