import { createHash } from "node:crypto";

/**
 * Wine taste profiles for the taste-search pilot (lib/taste/*).
 *
 * Every attribute keeps its evidence: where the value came from, what kind of
 * evidence it is, a verbatim quote when it came from DABS text, and how sure
 * we are. Three kinds of evidence, never blended:
 *   - "product": stated for this product by DABS — its listing text, the
 *     label words in its name ("BRUT", "LATE HARVEST"), or its DABS category.
 *   - "style":   general knowledge about the grape or wine style ("Pinot
 *     Grigio is typically dry"), shown as such, never as a product claim.
 *   - "manual":  a documented correction (wine_profile_overrides).
 * No value is ever guessed from memory about a specific bottle. When nothing
 * supports a value it stays unknown (value null, evidence "none").
 *
 * Extraction is plain rules, not a model: each rule is testable, and any
 * value from listing text carries the exact words it came from.
 */
export const EXTRACTOR_VERSION = "taste-rules-7";

export type Evidence = "product" | "style" | "manual" | "none";
export type Confidence = "high" | "medium" | "low";
export type Sweetness = "dry" | "off-dry" | "medium-sweet" | "sweet";
export type Body = "light" | "medium" | "full";
export type Fizz = "still" | "lightly sparkling" | "sparkling";
export type Color = "white" | "red" | "rose";
export type Tag =
  | "crisp"
  | "refreshing"
  | "fruity"
  | "oaky"
  | "creamy"
  | "floral"
  | "mineral"
  | "earthy"
  | "spicy"
  | "smooth";

export const SWEETNESS_ORDER: Sweetness[] = ["dry", "off-dry", "medium-sweet", "sweet"];
export const BODY_ORDER: Body[] = ["light", "medium", "full"];
export const TAGS: Tag[] = ["crisp", "refreshing", "fruity", "oaky", "creamy", "floral", "mineral", "earthy", "spicy", "smooth"];

export interface Attr<T> {
  value: T | null;
  evidence: Evidence;
  /** dabs_description | dabs_name | dabs_category | style:<rule> | override */
  source: string | null;
  /** The DABS words the value came from (product evidence only). */
  quote?: string;
  confidence: Confidence | null;
  /** Style rules: the plain-language general statement shown to shoppers. */
  note?: string;
}

export interface WineProfile {
  color: Attr<Color>;
  grapes: Attr<string[]>;
  region: Attr<string>;
  fizz: Attr<Fizz>;
  sweetness: Attr<Sweetness>;
  body: Attr<Body>;
  tags: (Attr<Tag> & { value: Tag })[];
}

export interface ProfileInput {
  name: string;
  category: string | null;
  sizeMl: number | null;
  description: string | null;
}

export interface IdentityCheck {
  status: "ok" | "ambiguous";
  note: string | null;
}

const unknown = <T>(): Attr<T> => ({ value: null, evidence: "none", source: null, confidence: null });

/** Cache key: re-extract only when the inputs or the rules change. */
export function inputHash(input: ProfileInput): string {
  return createHash("sha1")
    .update([EXTRACTOR_VERSION, input.name, input.category ?? "", input.sizeMl ?? "", input.description ?? ""].join("␟"))
    .digest("hex");
}

/**
 * Products whose code can't be pinned to one wine get no taste profile: a
 * name listing several vintages ("'21/23"), or DABS pointing to another code
 * ("(USE 460445)"). The rarity job's reused-code finding is added by the job.
 */
export function checkIdentity(name: string): IdentityCheck {
  if (/'\d{2}\s*\/\s*\d{2}\b/.test(name)) return { status: "ambiguous", note: "Name lists more than one vintage under one DABS code" };
  if (/\(USE \d{5,6}\)/i.test(name)) return { status: "ambiguous", note: "DABS name points to a replacement code" };
  return { status: "ok", note: null };
}

// ---------------------------------------------------------------------------
// Grapes. Patterns run on the upper-cased DABS name, category and listing text.

interface GrapeRule {
  grape: string;
  re: RegExp;
}

const GRAPES: GrapeRule[] = [
  { grape: "Cabernet Franc", re: /\bCAB(?:ERNET)?\.? FRANC\b/ },
  { grape: "Cabernet Sauvignon", re: /\bCAB(?:ERNET)?\.? SAUV(?:IGNON)?\b|\bCABERNET\b(?! FRANC)|\bCAB\b(?! FRANC)/ },
  { grape: "Sauvignon Blanc", re: /\bSAUV(?:IGNON)?\.? BL(?:ANC|C)?\b|\bFUME BLANC\b/ },
  { grape: "Chardonnay", re: /\bCHARD(?:ONNAY)?\b|\bCHD\b/ },
  { grape: "Riesling", re: /\bRIESL(?:IN)?G?\b/ },
  { grape: "Pinot Grigio", re: /\bPINOT GRIGIO\b|\bP(?:NT)?\.? GRIGIO\b/ },
  { grape: "Pinot Gris", re: /\bPINOT GRIS\b/ },
  { grape: "Pinot Blanc", re: /\bPINOT BLANC\b|\bPINOT BIANCO\b/ },
  { grape: "Pinot Noir", re: /\bPINOT NOIR\b|\bPINOT NR\b|\bPN\b(?=.*\bPINOT\b)/ },
  { grape: "Moscato", re: /\bMOSCATO\b|\bMUSCAT\b|\bMOSCATEL\b/ },
  { grape: "Gewürztraminer", re: /\bGEWURZ(?:TRAMINER)?\b/ },
  { grape: "Albariño", re: /\bALBARI[NÑ]O\b|\bALVARINHO\b/ },
  { grape: "Chenin Blanc", re: /\bCHENIN\b/ },
  { grape: "Viognier", re: /\bVIOGNIER\b/ },
  { grape: "Grüner Veltliner", re: /\bGRUNER\b|\bGR[UÜ]NER VELTLINER\b/ },
  { grape: "Vermentino", re: /\bVERMENTINO\b/ },
  { grape: "Verdejo", re: /\bVERDEJO\b/ },
  { grape: "Torrontés", re: /\bTORRONTES\b/ },
  { grape: "Sémillon", re: /\bSEMILLON\b/ },
  { grape: "Picpoul", re: /\bPICPOUL\b/ },
  { grape: "Assyrtiko", re: /\bASSYRTIKO\b/ },
  { grape: "Godello", re: /\bGODELLO\b/ },
  { grape: "Xarel·lo", re: /\bXAREL\.?L?O\b/ },
  { grape: "Garganega", re: /\bGARGANEGA\b/ },
  { grape: "Fiano", re: /\bFIANO\b/ },
  { grape: "Falanghina", re: /\bFALANGHINA\b/ },
  { grape: "Arneis", re: /\bARNEIS\b/ },
  { grape: "Cortese", re: /\bCORTESE\b/ },
  { grape: "Trebbiano", re: /\bTREBBIANO\b/ },
  { grape: "Marsanne", re: /\bMARSANNE\b/ },
  { grape: "Roussanne", re: /\bROUSSANNE\b/ },
  { grape: "Merlot", re: /\bMERLOT\b/ },
  { grape: "Zinfandel", re: /\bZIN(?:FANDEL)?\b/ },
  { grape: "Primitivo", re: /\bPRIMITIVO\b/ },
  { grape: "Petite Sirah", re: /\bPETITE SIRAH\b|\bPET(?:ITE)? SIRAH\b/ },
  { grape: "Syrah", re: /\bSYRAH\b(?<!PETITE SYRAH)|\bSHIRAZ\b/ },
  { grape: "Malbec", re: /\bMALBEC\b/ },
  { grape: "Tempranillo", re: /\bTEMPRANILLO\b/ },
  { grape: "Grenache Blanc", re: /\bGRENACHE BLANC\b|\bGARNACHA BLANCA\b/ },
  { grape: "Grenache", re: /\bGRENACHE\b(?! BLANC)|\bGARNACHA\b(?! BLANCA)/ },
  { grape: "Sangiovese", re: /\bSANGIOVESE\b/ },
  { grape: "Nebbiolo", re: /\bNEBBIOLO\b/ },
  { grape: "Barbera", re: /\bBARBERA\b/ },
  { grape: "Dolcetto", re: /\bDOLCETTO\b/ },
  { grape: "Montepulciano", re: /\bMONTEPULCIANO D'ABRUZZO\b/ },
  { grape: "Carménère", re: /\bCARMENERE\b/ },
  { grape: "Gamay", re: /\bGAMAY\b/ },
  { grape: "Mourvèdre", re: /\bMOURVEDRE\b|\bMONASTRELL\b/ },
  { grape: "Pinotage", re: /\bPINOTAGE\b/ },
  { grape: "Nero d'Avola", re: /\bNERO D'?AVOLA\b/ },
  { grape: "Aglianico", re: /\bAGLIANICO\b/ },
  { grape: "Lambrusco", re: /\bLAMBRUSCO\b/ },
  { grape: "Zweigelt", re: /\bZWEIGELT\b/ },
];

// Appellations whose grape is fixed by law or near-universal; product evidence
// through the name, not a style guess. Kept short and uncontroversial.
const APPELLATION_GRAPES: [RegExp, string[], string][] = [
  [/\bCHABLIS\b/, ["Chardonnay"], "Chablis"],
  [/\bSANCERRE\b|\bPOUILLY[- ]FUME\b/, ["Sauvignon Blanc"], "Sancerre / Pouilly-Fumé"],
  [/\bVOUVRAY\b/, ["Chenin Blanc"], "Vouvray"],
  [/\bBAROLO\b|\bBARBARESCO\b/, ["Nebbiolo"], "Barolo / Barbaresco"],
  [/\bBRUNELLO\b|\bROSSO (?:DI )?MONTALCIN/, ["Sangiovese"], "Montalcino"],
  [/\bGAVI\b/, ["Cortese"], "Gavi"],
  [/\bSOAVE\b/, ["Garganega"], "Soave"],
  [/\bMOSCATO D'ASTI\b|\bASTI SPUMANTE\b/, ["Moscato"], "Asti"],
  [/\bBEAUJOLAIS\b|\bMORGON\b|\bFLEURIE\b/, ["Gamay"], "Beaujolais"],
  [/\bMUSCADET\b/, ["Melon de Bourgogne"], "Muscadet"],
  [/\bCHIANTI\b/, ["Sangiovese"], "Chianti (mainly Sangiovese)"],
  [/\bRIBERA DEL DUERO\b/, ["Tempranillo"], "Ribera del Duero (mainly Tempranillo)"],
];

export function findGrapes(text: string): string[] {
  const found: string[] = [];
  for (const g of GRAPES) {
    if (g.re.test(text) && !found.includes(g.grape)) found.push(g.grape);
  }
  // "Cabernet Sauvignon" rule also fires on "Cabernet Franc"; "Syrah" on "Petite Sirah" text is fine.
  if (found.includes("Cabernet Franc") && !/\bCAB(?:ERNET)?\.? SAUV/.test(text) && !/\bCABERNET\b(?! FRANC)/.test(text.replace(/CAB(?:ERNET)?\.? FRANC/g, ""))) {
    return found.filter((g) => g !== "Cabernet Sauvignon");
  }
  return found;
}

/** "Blend: 91% Riesling, 9% Muscat" / "65% Merlot, 29% Cabernet Sauvignon". */
function blendFromDescription(desc: string): { grapes: string[]; quote: string } | null {
  const m = desc.match(/((?:\d{1,3}\s?%\s?[A-Za-zÀ-ÿ' .-]+?(?:,|\band\b|$|\s(?=\d)))+)/);
  if (!m || !/%/.test(m[1])) return null;
  const grapes = findGrapes(m[1].toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  return grapes.length ? { grapes, quote: m[1].trim().replace(/[,\s]+$/, "") } : null;
}

// ---------------------------------------------------------------------------
// Regions: DABS category first (explicit classification), then name/listing.

const CATEGORY_REGIONS: [RegExp, string][] = [
  [/^FRENCH (?:RED|WHITE) - BURGUNDY/, "Burgundy, France"],
  [/^FRENCH (?:RED|WHITE) - BORDEAUX/, "Bordeaux, France"],
  [/^FRENCH WHITE - BORDEAUX & LOIRE/, "Bordeaux or Loire, France"],
  [/^FRENCH RED - RHONE/, "Rhône, France"],
  [/^FRENCH (?:RED|WHITE)/, "France"],
  [/^ITALIAN RED - PIEDMONT/, "Piedmont, Italy"],
  [/^ITALIAN RED - (?:TUSCANY|CHIANTI)/, "Tuscany, Italy"],
  [/^ITALIAN (?:RED|WHITE)/, "Italy"],
  [/^SPANISH RED - RIOJA/, "Rioja, Spain"],
  [/^SPANISH (?:RED|WHITE)/, "Spain"],
  [/^PORTUG[UE]+SE/, "Portugal"],
  [/^GERMAN/, "Germany or Austria"],
  [/^NEW ZEALAND/, "New Zealand"],
  [/^AUSTRALIAN/, "Australia"],
  [/^ARGENTINE/, "Argentina"],
  [/^CHILEAN/, "Chile"],
  [/^SOUTH AFRICAN/, "South Africa"],
  [/^SPARKLING WINE - FRENCH & CHAMPAGNE/, "France"],
  [/^SPARKLING WINE - PROSECCO/, "Italy (Prosecco)"],
  [/^SPARKLING WINE - DOMESTIC|^ROSE WINE - DOMESTIC/, "United States"],
];

const NAME_REGIONS: [RegExp, string][] = [
  [/\bNAPA\b/, "Napa Valley, California"],
  [/\bSONOMA\b|\bRUSSIAN RIVER\b|\bRR\b(?=.*PINOT)|\bALX VLY\b|\bALEXANDER VALLEY\b/, "Sonoma, California"],
  [/\bPASO ROBLES\b/, "Paso Robles, California"],
  [/\bSANTA LUCIA\b|\bSLH\b/, "Santa Lucia Highlands, California"],
  [/\bLODI\b/, "Lodi, California"],
  [/\bWILLAMETTE\b/, "Willamette Valley, Oregon"],
  [/\bCOLUMBIA VALLEY\b|\bCOL VLY\b/, "Columbia Valley, Washington"],
  [/\bMARLBOROUGH\b/, "Marlborough, New Zealand"],
  [/\bCHABLIS\b/, "Chablis, France"],
  [/\bSANCERRE\b/, "Sancerre, France"],
  [/\bVOUVRAY\b/, "Vouvray, France"],
  [/\bPROVENCE\b|\bCOTES DE PROVENCE\b/, "Provence, France"],
  [/\bALSACE\b/, "Alsace, France"],
  [/\bMOSEL\b/, "Mosel, Germany"],
  [/\bRIAS BAIXAS\b/, "Rías Baixas, Spain"],
  [/\bVINHO VERDE?\b|\bVINHO VERD\b/, "Vinho Verde, Portugal"],
  [/\bTXAKOLI(?:NA)?\b|\bGETARIAKO\b/, "Basque Country, Spain (Txakoli)"],
  [/\bSOAVE\b/, "Soave, Italy"],
  [/\bORVIETO\b/, "Orvieto, Italy"],
  [/\bGAVI\b/, "Gavi, Italy"],
  [/\bASTI\b/, "Asti, Italy"],
  [/\bBAROLO\b/, "Barolo, Italy"],
  [/\bCHIANTI\b/, "Chianti, Italy"],
  [/\bMONTALCIN/, "Montalcino, Italy"],
  [/\bRIOJA\b/, "Rioja, Spain"],
  [/\bCHATEAUNEUF\b/, "Châteauneuf-du-Pape, France"],
  [/\bUTAH\b/, "Utah"],
];

// ---------------------------------------------------------------------------
// Label words in the DABS name that state sweetness (product evidence).

const LABEL_SWEETNESS: [RegExp, Sweetness, string][] = [
  [/\bBRUT NATURE\b|\bEXTRA BRUT\b|\bZERO DOSAGE\b/, "dry", "Brut Nature / Extra Brut"],
  [/\bEXTRA DRY\b|\bEXTRA SEC\b|\bEXTRA DRY\b/, "off-dry", "Extra Dry"],
  [/\bDEMI[- ]?SEC\b|\bDOUX\b|\bDOLCE\b|\bAMABILE\b|\bDULCE\b/, "sweet", "Demi-Sec / Dolce"],
  [/\bLATE HARVEST\b|\bLATE HRVST\b|\bICE ?WINE\b|\bEISWEIN\b|\bSAUTERNES\b/, "sweet", "Late Harvest"],
  [/\bSEMI[- ]?SWEET\b|\bSEMI[- ]?SWT\b/, "medium-sweet", "Semi-Sweet"],
  [/\bSWEET\b|\bSWT\b/, "sweet", "Sweet"],
  [/\bBRUT\b/, "dry", "Brut"],
  [/\bTROCKEN\b|\bDRY RIESLING\b|\bDRY ROSE\b|\bDRY\b(?! CREEK)/, "dry", "Dry"],
];

// ---------------------------------------------------------------------------
// Listing text. Each rule matches words that describe the wine itself, not
// its aromas ("sweet spice", "sweet oak" and "sweet tannins" don't count).

const FRUITY_NOT_SWEET = /^sweet (?:spice|spices|oak|tannins?|vanilla|cherr|berr|fruit|notes|aromas|tobacco|herbs?|nuance|bay|pipe|earth|smoke|toast|lemon|licorice|plum|cassis|red fruit|black fruit|dark fruit|pepper)/;

interface TextRule<T> {
  value: T;
  re: RegExp;
  confidence: Confidence;
}

const TEXT_SWEETNESS: TextRule<Sweetness>[] = [
  { value: "dry", re: /\bnot (?:overly |too )?sweet\b|\bbone[- ]dry\b|\bdry (?:white|red|wine|style|finish|and crisp|riesling|chenin|muscat|moscato|gew[uü]rztraminer|furmint|vouvray)\b|\bdry ros[eé](?![a-z])|\bcrisp(?:,| and) dry\b|\bdry,? crisp\b/i, confidence: "high" },
  { value: "off-dry", re: /\boff[- ]dry\b|\b(?:hint|touch) of sweetness\b|\b(?:slightly|lightly|gently|just) sweet\b|\bnot too dry\b/i, confidence: "high" },
  { value: "medium-sweet", re: /\bsemi[- ]sweet\b|\bmedium[- ]sweet\b|\bsweet(?:er)? style\b/i, confidence: "high" },
  { value: "sweet", re: /^sweet\b|\bsweet (?:wine|moscato|red|white|sparkling|blush|dessert)\b|\bsweet ros[eé](?![a-z])|\b(?:fruity|soft|juicy|light) and sweet\b|\bdessert wine\b|\blusciously sweet\b|\bnaturally sweet\b|\bsweet and (?:fruity|refreshing|light)\b/i, confidence: "high" },
];

const TEXT_BODY: TextRule<Body>[] = [
  { value: "light", re: /\blight[- ]bodied\b|\blight(?:er)? body\b|\blight and (?:crisp|refreshing|fresh)\b|\blightweight\b/i, confidence: "high" },
  { value: "medium", re: /\bmedium[- ]bodied\b|\bmedium(?:[- ]plus)? body\b/i, confidence: "high" },
  { value: "full", re: /\bfull[- ]bodied\b|\bfull body\b/i, confidence: "high" },
  { value: "full", re: /\b(?:big|bold|robust|powerful)\b/i, confidence: "medium" },
  { value: "light", re: /\bdelicate\b/i, confidence: "medium" },
];

const TEXT_TAGS: TextRule<Tag>[] = [
  { value: "crisp", re: /\bcrisp\b|\bzesty\b|\bzippy\b|\bracy\b|\b(?:bright|vibrant|lively|fresh|refreshing|mouthwatering) acidity\b/i, confidence: "high" },
  { value: "refreshing", re: /\brefreshing\b|\brefreshment\b/i, confidence: "high" },
  { value: "fruity", re: /\bfruit[- ]forward\b|\bfruity\b|\bjuicy\b/i, confidence: "high" },
  { value: "oaky", re: /\boak(?:y|ed)?\b|\bvanilla\b|\btoasted oak\b|\bbuttery\b/i, confidence: "high" },
  { value: "creamy", re: /\bcreamy\b|\bbuttery\b|\brich,? round\b/i, confidence: "high" },
  { value: "floral", re: /\bfloral\b|\bflowers?\b|\bblossoms?\b|\bhoneysuckle\b/i, confidence: "high" },
  { value: "mineral", re: /\bminerals?\b|\bminerality\b|\bflinty\b|\bsaline\b|\bstony\b|\bchalky\b/i, confidence: "high" },
  { value: "earthy", re: /\bearth(?:y|iness)?\b/i, confidence: "high" },
  { value: "spicy", re: /\bspic(?:e|es|y)\b|\bpepper(?:y)?\b/i, confidence: "high" },
  { value: "smooth", re: /\bsmooth\b|\bsilky\b|\bvelvety\b|\bsoft tannins\b/i, confidence: "high" },
];

const TEXT_FIZZ: TextRule<Fizz>[] = [
  { value: "lightly sparkling", re: /\beffervescen(?:t|ce)\b|\bfrizzante\b|\bp[eé]tillant\b|\blightly sparkling\b|\bspritz(?:y)?\b|\b(?:slight|light) fizz\b/i, confidence: "high" },
];

// ---------------------------------------------------------------------------
// General style knowledge, applied only when the product says nothing. Each
// rule carries the sentence shoppers see. Grapes that vary widely (Riesling,
// Chenin Blanc, Prosecco) deliberately have no sweetness rule, and there is
// no "reds are usually dry" catch-all: a semi-sweet red without listing text
// (Stella Rosa Rosso) would be called dry.

interface StyleRule {
  key: string;
  when: (p: { grapes: string[]; name: string; color: Color | null; fizz: Fizz | null; region: string | null }) => boolean;
  sweetness?: Sweetness;
  body?: Body;
  tags?: Tag[];
  confidence: Confidence;
  note: string;
}

const has = (g: string) => (p: { grapes: string[] }) => p.grapes.includes(g);
const only = (g: string) => (p: { grapes: string[] }) => p.grapes.length === 1 && p.grapes[0] === g;

const STYLE_RULES: StyleRule[] = [
  { key: "moscato-asti", when: (p) => /\bMOSCATO D'ASTI\b|\bASTI\b/.test(p.name), sweetness: "sweet", body: "light", confidence: "medium", note: "Moscato d'Asti is typically sweet, light and lightly sparkling" },
  { key: "moscato", when: has("Moscato"), sweetness: "sweet", confidence: "medium", note: "Moscato is typically made sweet" },
  { key: "white-zin", when: (p) => /\bWH(?:ITE)? ZIN/.test(p.name), sweetness: "off-dry", confidence: "medium", note: "White Zinfandel is typically off-dry to sweet" },
  { key: "gewurz", when: only("Gewürztraminer"), sweetness: "off-dry", tags: ["floral"], confidence: "low", note: "Gewürztraminer is often off-dry and floral" },
  { key: "pinot-grigio", when: (p) => only("Pinot Grigio")(p) || only("Pinot Gris")(p), sweetness: "dry", body: "light", confidence: "medium", note: "Pinot Grigio is typically dry and light-bodied" },
  { key: "sauv-blanc", when: only("Sauvignon Blanc"), sweetness: "dry", tags: ["crisp"], confidence: "medium", note: "Sauvignon Blanc is typically dry and crisp" },
  { key: "albarino", when: only("Albariño"), sweetness: "dry", body: "light", tags: ["crisp"], confidence: "medium", note: "Albariño is typically dry, light and crisp" },
  { key: "txakoli", when: (p) => /Txakoli/.test(p.region ?? ""), sweetness: "dry", body: "light", tags: ["crisp"], confidence: "medium", note: "Txakoli is typically dry, light and crisp, often with a slight spritz" },
  { key: "gruner", when: only("Grüner Veltliner"), sweetness: "dry", tags: ["crisp"], confidence: "medium", note: "Grüner Veltliner is typically dry and crisp" },
  { key: "chardonnay", when: only("Chardonnay"), sweetness: "dry", confidence: "medium", note: "Chardonnay is typically dry" },
  { key: "provence-rose", when: (p) => p.color === "rose" && /Provence/.test(p.region ?? ""), sweetness: "dry", body: "light", confidence: "medium", note: "Provence rosé is typically dry and light" },
  { key: "brut-sparkling", when: (p) => p.fizz === "sparkling" && /\bCHAMPAGNE\b|\bCAVA\b|\bCREMANT\b/.test(p.name), sweetness: "dry", confidence: "low", note: "Champagne, Cava and Crémant are most often made Brut (dry)" },
  { key: "pinot-noir", when: (p) => p.color === "red" && only("Pinot Noir")(p), sweetness: "dry", body: "light", confidence: "medium", note: "Pinot Noir is typically dry and lighter-bodied for a red" },
  { key: "gamay", when: only("Gamay"), sweetness: "dry", body: "light", tags: ["fruity"], confidence: "medium", note: "Gamay (Beaujolais) is typically dry, light and fruity" },
  { key: "big-reds", when: (p) => p.color === "red" && p.grapes.length === 1 && ["Cabernet Sauvignon", "Syrah", "Petite Sirah", "Malbec", "Zinfandel", "Primitivo"].includes(p.grapes[0]), sweetness: "dry", body: "full", confidence: "medium", note: "this grape typically makes dry, full-bodied reds" },
  { key: "merlot", when: (p) => p.color === "red" && only("Merlot")(p), sweetness: "dry", body: "medium", confidence: "medium", note: "Merlot is typically dry and medium-bodied" },
];

// ---------------------------------------------------------------------------

/** Ratings and award lines are never quoted back to shoppers. */
function cleanQuoteText(s: string): string {
  return s
    .replace(
      /\b\d{2,3}\s*(?:points?|pts?)\b\s*(?:[-–,:]\s*)?(?:by\s+)?(?:Decanter|Wine Spectator|Wine Enthusiast|Wine Advocate|James Suckling|Jeb Dunnuck|Vinous|Robert Parker|Wine & Spirits|Tasting Panel|Wine Star)?/gi,
      ""
    )
    .replace(/\b\d{2,3}\s*(?:GP|WS|WE|WA|RP|JS|JD|V|W&S|WW|D|DWWA)\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The sentence (≤ 140 chars) around a match, for the evidence quote. */
function quoteAround(text: string, index: number): string {
  const sentences = text.split(/(?<=[.!;])\s+|(?<=\.)(?=[A-Z])/);
  let pos = 0;
  for (const s of sentences) {
    const end = pos + s.length;
    if (index >= pos && index <= end + 1) return trimQuote(cleanQuoteText(s));
    pos = end + 1;
  }
  return trimQuote(cleanQuoteText(text));
}

function trimQuote(s: string): string {
  const t = s.trim();
  return t.length <= 140 ? t : t.slice(0, 137).replace(/\s+\S*$/, "") + "…";
}

function firstText<T>(rules: TextRule<T>[], desc: string, generic: boolean, skip?: RegExp): Attr<T> | null {
  // Earlier rules win, so "not too sweet" (dry-ish) isn't read as "sweet".
  for (const r of rules) {
    const m = r.re.exec(desc);
    if (!m) continue;
    if (skip && skip.test(desc.slice(m.index, m.index + 40).toLowerCase())) continue;
    return {
      value: r.value,
      evidence: "product",
      source: "dabs_description",
      quote: quoteAround(desc, m.index),
      confidence: generic && r.confidence === "high" ? "medium" : generic ? "low" : r.confidence,
    };
  }
  return null;
}

export function colorOf(category: string | null): Color | null {
  const c = (category ?? "").toUpperCase();
  if (/^ROSE WINE|^BLUSH WINE|BLANC DE NOIRS & ROSE/.test(c)) return "rose";
  if (/\bWHITE\b|^SPARKLING WINE/.test(c)) return "white";
  if (/\bRED\b/.test(c)) return "red";
  return null;
}

/**
 * Builds the profile from DABS data only. `genericDescription` marks listing
 * text that DABS repeats word for word on other products: still product
 * evidence, but not specific to this bottle, so it counts for less.
 */
export function extractProfile(input: ProfileInput, opts: { genericDescription?: boolean } = {}): WineProfile {
  const name = input.name.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const category = (input.category ?? "").toUpperCase();
  const desc = (input.description ?? "").trim();
  const descUp = desc.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const generic = !!opts.genericDescription;

  // Color and fizz: the DABS category says so explicitly.
  const colorValue = colorOf(input.category);
  const color: Attr<Color> = colorValue
    ? { value: colorValue, evidence: "product", source: "dabs_category", quote: input.category ?? undefined, confidence: "high" }
    : unknown();

  let fizz: Attr<Fizz> = unknown();
  if (/^SPARKLING WINE/.test(category)) {
    fizz = { value: "sparkling", evidence: "product", source: "dabs_category", quote: input.category ?? undefined, confidence: "high" };
  } else if (/\bFRIZZANTE\b|\bPETILLANT\b|\bMOSCATO D'ASTI\b/.test(name)) {
    fizz = { value: "lightly sparkling", evidence: "product", source: "dabs_name", quote: input.name, confidence: "high" };
  } else if (/\bSPARKLING\b|\bSPUMANTE\b|\bPROSECCO\b|\bCAVA\b|\bCHAMPAGNE\b|\bCREMANT\b/.test(name)) {
    fizz = { value: "sparkling", evidence: "product", source: "dabs_name", quote: input.name, confidence: "high" };
  } else {
    fizz = firstText(TEXT_FIZZ, desc, generic) ?? { value: "still", evidence: "product", source: "dabs_category", quote: input.category ?? undefined, confidence: "medium" };
  }

  // Grapes: name, then a stated blend, then the DABS varietal category.
  let grapes: Attr<string[]> = unknown();
  const nameGrapes = findGrapes(name);
  const appellation = APPELLATION_GRAPES.find(([re]) => re.test(name));
  const blend = desc ? blendFromDescription(desc) : null;
  const catGrape = category.match(/^(?:RED|WHITE) VARIETAL - (.+)$/)?.[1];
  const catGrapes = catGrape && !/MISC/.test(catGrape) ? findGrapes(catGrape) : [];
  if (blend) grapes = { value: blend.grapes, evidence: "product", source: "dabs_description", quote: blend.quote, confidence: generic ? "medium" : "high" };
  else if (nameGrapes.length) grapes = { value: nameGrapes, evidence: "product", source: "dabs_name", quote: input.name, confidence: "high" };
  else if (appellation) grapes = { value: appellation[1], evidence: "product", source: "dabs_name", quote: input.name, confidence: "high", note: `${appellation[2]}` };
  else if (catGrapes.length === 1) grapes = { value: catGrapes, evidence: "product", source: "dabs_category", quote: input.category ?? undefined, confidence: "medium" };
  else if (desc) {
    const g = findGrapes(descUp);
    if (g.length === 1) {
      const idx = descUp.search(GRAPES.find((r) => r.grape === g[0])!.re);
      grapes = { value: g, evidence: "product", source: "dabs_description", quote: quoteAround(desc, Math.max(0, idx)), confidence: generic ? "low" : "medium" };
    }
  }

  // Region: most specific explicit mention wins (name, listing), else category.
  let region: Attr<string> = unknown();
  const nameRegion = NAME_REGIONS.find(([re]) => re.test(name));
  const descRegion = desc ? NAME_REGIONS.find(([re]) => re.test(descUp)) : undefined;
  const catRegion = CATEGORY_REGIONS.find(([re]) => re.test(category));
  if (nameRegion) region = { value: nameRegion[1], evidence: "product", source: "dabs_name", quote: input.name, confidence: "high" };
  else if (descRegion) {
    const idx = descUp.search(descRegion[0]);
    region = { value: descRegion[1], evidence: "product", source: "dabs_description", quote: quoteAround(desc, idx), confidence: generic ? "low" : "high" };
  } else if (catRegion) region = { value: catRegion[1], evidence: "product", source: "dabs_category", quote: input.category ?? undefined, confidence: "high" };

  // Sweetness: label words, then listing text, then (below) style knowledge.
  let sweetness: Attr<Sweetness> = unknown();
  const label = LABEL_SWEETNESS.find(([re]) => re.test(name));
  if (label) {
    // The words as they appear in the name ("EXTRA BRUT" → "Extra Brut").
    const words = name.match(label[0])![0].toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
    sweetness = { value: label[1], evidence: "product", source: "dabs_name", quote: input.name, confidence: "high", note: `labeled ${words}` };
  }
  else if (desc) sweetness = firstText(TEXT_SWEETNESS, desc, generic, FRUITY_NOT_SWEET) ?? sweetness;

  let body: Attr<Body> = desc ? firstText(TEXT_BODY, desc, generic) ?? unknown() : unknown();

  const tags: (Attr<Tag> & { value: Tag })[] = [];
  if (desc) {
    for (const r of TEXT_TAGS) {
      if (tags.some((t) => t.value === r.value)) continue;
      const hit = firstText([r], desc, generic);
      if (hit) tags.push(hit as Attr<Tag> & { value: Tag });
    }
  }
  // Style knowledge fills gaps only, and is always marked as such.
  const ctx = { grapes: grapes.value ?? [], name, color: color.value, fizz: fizz.value, region: region.value };
  for (const rule of STYLE_RULES) {
    if (!rule.when(ctx)) continue;
    const base = { evidence: "style" as const, source: `style:${rule.key}`, confidence: rule.confidence, note: rule.note };
    if (rule.sweetness && sweetness.value == null) sweetness = { ...base, value: rule.sweetness };
    if (rule.body && body.value == null) body = { ...base, value: rule.body };
    for (const t of rule.tags ?? []) {
      if (!tags.some((x) => x.value === t)) tags.push({ ...base, value: t });
    }
  }

  return { color, grapes, region, fizz, sweetness, body, tags };
}

/** Text shared verbatim by at least this many products is treated as generic copy. */
export const GENERIC_DESCRIPTION_MIN = 2;
