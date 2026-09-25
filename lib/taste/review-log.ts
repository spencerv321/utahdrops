/**
 * Sample review of pilot profiles before public use (2026-09-25): 50 of the
 * 260, stratified by style (16 white, 16 red, 9 rosé, 9 sparkling), each
 * checked by hand against its DABS name, category and listing text. Values
 * are what was checked; the profile job writes them to wine_profile_reviews
 * and report.yml → taste flags any profile that has changed since.
 * Errors found were fixed in the extraction rules (not per bottle), so every
 * profile with the same pattern got the fix.
 */
export interface ReviewEntry {
  csc: string;
  verdict: "ok" | "corrected" | "excluded";
  note?: string;
  values: Record<string, unknown>;
}

export const REVIEWER = "Claude (rules checked against DABS text), 2026-09-25";
export const REVIEWED_ON = "2026-09-25";

export const REVIEW_LOG: ReviewEntry[] = [
  { csc: "513505", verdict: "ok", values: {"grapes": ["Merlot"], "region": null, "fizz": "still", "sweetness": "dry", "body": "medium", "tags": ["oaky"]} },
  { csc: "907747", verdict: "ok", values: {"grapes": ["Merlot"], "region": null, "fizz": "still", "sweetness": "dry", "body": "medium", "tags": ["smooth"]} },
  { csc: "443939", verdict: "ok", values: {"grapes": ["Pinot Noir"], "region": null, "fizz": "still", "sweetness": "dry", "body": "light", "tags": []} },
  { csc: "426192", verdict: "ok", values: {"grapes": null, "region": "Argentina", "fizz": "still", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "684920", verdict: "ok", values: {"grapes": ["Grenache"], "region": null, "fizz": "sparkling", "sweetness": null, "body": null, "tags": []} },
  { csc: "918156", verdict: "ok", values: {"grapes": null, "region": "France", "fizz": "still", "sweetness": "dry", "body": null, "tags": ["earthy", "spicy", "smooth"]} },
  { csc: "947588", verdict: "ok", values: {"grapes": ["Cabernet Franc"], "region": "Italy", "fizz": "still", "sweetness": "dry", "body": null, "tags": ["spicy"]} },
  { csc: "948327", verdict: "ok", values: {"grapes": null, "region": "Bordeaux, France", "fizz": "still", "sweetness": "dry", "body": null, "tags": ["mineral"]} },
  { csc: "478100", verdict: "ok", values: {"grapes": ["Cabernet Sauvignon"], "region": null, "fizz": "still", "sweetness": "dry", "body": "full", "tags": ["oaky", "spicy"]} },
  { csc: "411894", verdict: "ok", values: {"grapes": ["Cabernet Sauvignon"], "region": "Australia", "fizz": "still", "sweetness": "dry", "body": "full", "tags": []} },
  { csc: "516810", verdict: "ok", values: {"grapes": ["Merlot"], "region": null, "fizz": "still", "sweetness": "dry", "body": "medium", "tags": ["smooth"]} },
  { csc: "915664", verdict: "ok", values: {"grapes": ["Sangiovese"], "region": "Chianti, Italy", "fizz": "still", "sweetness": "dry", "body": null, "tags": ["fruity"]} },
  { csc: "919112", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "442537", verdict: "ok", values: {"grapes": ["Pinot Noir"], "region": null, "fizz": "still", "sweetness": "dry", "body": "light", "tags": ["earthy", "smooth"]} },
  { csc: "424300", verdict: "ok", values: {"grapes": ["Grenache"], "region": "Spain", "fizz": "still", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "926702", verdict: "ok", values: {"grapes": ["Primitivo"], "region": "Italy", "fizz": "still", "sweetness": "dry", "body": "full", "tags": ["earthy", "spicy"]} },
  { csc: "922642", verdict: "corrected", note: "“Fruity and sweet rosé” was missed (accented é broke the word match). Fixed by rule.", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": "sweet", "body": null, "tags": ["refreshing", "fruity", "floral"]} },
  { csc: "652163", verdict: "corrected", note: "“WH ZINFANDEL” was read as a red Zinfandel (dry, full-bodied). Fixed by rule: White Zinfandel style, red-grape rules only for red wines.", values: {"grapes": ["Zinfandel"], "region": null, "fizz": "still", "sweetness": "off-dry", "body": null, "tags": ["crisp", "fruity", "floral"]} },
  { csc: "291503", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": null, "body": null, "tags": []} },
  { csc: "918664", verdict: "ok", values: {"grapes": null, "region": "United States", "fizz": "still", "sweetness": null, "body": null, "tags": ["refreshing"]} },
  { csc: "275081", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": null, "body": "full", "tags": ["crisp", "smooth"]} },
  { csc: "275091", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": "dry", "body": null, "tags": ["smooth"]} },
  { csc: "279694", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": null, "body": null, "tags": []} },
  { csc: "279693", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": null, "body": null, "tags": []} },
  { csc: "680069", verdict: "ok", values: {"grapes": null, "region": "United States", "fizz": "still", "sweetness": null, "body": null, "tags": []} },
  { csc: "952087", verdict: "ok", values: {"grapes": null, "region": "Alsace, France", "fizz": "sparkling", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "907649", verdict: "ok", values: {"grapes": null, "region": "Italy (Prosecco)", "fizz": "sparkling", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "741400", verdict: "corrected", note: "“toasty notes” tagged oaky; toast in sparkling wine isn't oak. Fixed by rule (only “toasted oak” counts).", values: {"grapes": null, "region": null, "fizz": "sparkling", "sweetness": "dry", "body": null, "tags": ["crisp", "refreshing"]} },
  { csc: "710701", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "sparkling", "sweetness": null, "body": null, "tags": ["smooth"]} },
  { csc: "736990", verdict: "ok", values: {"grapes": null, "region": "France", "fizz": "sparkling", "sweetness": null, "body": null, "tags": ["crisp", "smooth"]} },
  { csc: "219392", verdict: "ok", values: {"grapes": null, "region": "France", "fizz": "sparkling", "sweetness": null, "body": null, "tags": []} },
  { csc: "768650", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "sparkling", "sweetness": "off-dry", "body": null, "tags": ["refreshing", "floral"]} },
  { csc: "704035", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "sparkling", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "776101", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "sparkling", "sweetness": null, "body": null, "tags": []} },
  { csc: "588715", verdict: "ok", values: {"grapes": ["Chardonnay"], "region": null, "fizz": "still", "sweetness": "dry", "body": null, "tags": ["crisp", "refreshing", "mineral"]} },
  { csc: "914983", verdict: "ok", values: {"grapes": ["Chardonnay"], "region": "Sonoma, California", "fizz": "still", "sweetness": "dry", "body": null, "tags": ["creamy", "smooth"]} },
  { csc: "417586", verdict: "ok", values: {"grapes": ["Pinot Grigio"], "region": "Italy", "fizz": "still", "sweetness": "dry", "body": "light", "tags": ["floral"]} },
  { csc: "562446", verdict: "ok", values: {"grapes": ["Chardonnay"], "region": null, "fizz": "still", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "550190", verdict: "ok", values: {"grapes": ["Pinot Grigio"], "region": null, "fizz": "still", "sweetness": "dry", "body": "light", "tags": []} },
  { csc: "545266", verdict: "ok", values: {"grapes": ["Pinot Grigio"], "region": "France", "fizz": "still", "sweetness": "dry", "body": "light", "tags": []} },
  { csc: "550805", verdict: "ok", values: {"grapes": ["Sauvignon Blanc"], "region": "Napa Valley, California", "fizz": "still", "sweetness": "dry", "body": null, "tags": ["crisp"]} },
  { csc: "917587", verdict: "ok", values: {"grapes": ["Chardonnay"], "region": "Sonoma, California", "fizz": "still", "sweetness": "dry", "body": null, "tags": ["oaky", "mineral"]} },
  { csc: "908825", verdict: "ok", values: {"grapes": ["Pinot Gris"], "region": null, "fizz": "still", "sweetness": "dry", "body": "light", "tags": ["floral"]} },
  { csc: "950760", verdict: "ok", values: {"grapes": null, "region": null, "fizz": "still", "sweetness": null, "body": null, "tags": ["refreshing", "floral"]} },
  { csc: "588634", verdict: "corrected", note: "“PNT GRIGIO” abbreviation not recognized; grape came from the DABS category instead. Fixed by rule.", values: {"grapes": ["Pinot Grigio"], "region": null, "fizz": "still", "sweetness": "dry", "body": "light", "tags": ["crisp", "refreshing", "floral"]} },
  { csc: "928179", verdict: "ok", values: {"grapes": null, "region": "Spain", "fizz": "still", "sweetness": null, "body": "medium", "tags": []} },
  { csc: "597774", verdict: "ok", values: {"grapes": ["Pinot Grigio"], "region": null, "fizz": "still", "sweetness": "dry", "body": "light", "tags": ["floral"]} },
  { csc: "607906", verdict: "ok", values: {"grapes": ["Chardonnay"], "region": null, "fizz": "still", "sweetness": "dry", "body": null, "tags": []} },
  { csc: "355618", verdict: "corrected", note: "“a light fizz” not read as lightly sparkling. Fixed by rule.", values: {"grapes": ["Moscato"], "region": null, "fizz": "lightly sparkling", "sweetness": "sweet", "body": null, "tags": ["refreshing"]} },
  { csc: "910789", verdict: "ok", values: {"grapes": ["Chardonnay"], "region": null, "fizz": "still", "sweetness": "dry", "body": "full", "tags": ["oaky", "smooth"]} },
];
