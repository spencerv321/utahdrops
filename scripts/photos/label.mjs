// Search query / label key for a DABS product name (sizes stripped, abbreviations expanded).
const ALIASES = { sngl: "single", sgl: "single", brrl: "barrel", brl: "barrel", bbl: "barrel", brbn: "bourbon", bbn: "bourbon", whsky: "whisky",
  rsv: "reserve", rsrv: "reserve", blnc: "blanc", sauv: "sauvignon", cab: "cabernet", chard: "chardonnay", slct: "select", blnd: "blend",
  dbl: "double", dble: "double", ltd: "limited", edtn: "edition", prf: "proof", teq: "tequila", spcl: "special", zin: "zinfandel",
  repo: "reposado", liq: "liqueur", orig: "original", btch: "batch", prv: "private", yr: "year", yrs: "year", grpfrt: "grapefruit", strwbry: "strawberry",
  vdka: "vodka", champ: "champagne", pnot: "pinot", pn: "pinot noir", cs: "cabernet sauvignon", sb: "sauvignon blanc" };

export function query(x) {
  let s = x.name.replace(/\s*\d+(\.\d+)?\s*(ml|m|l)$/i, "").replace(/\b\d+(\.\d+)?\s?(ml|l)\b/gi, "");
  s = s.toLowerCase().replace(/(\d)([a-z])/g, "$1 $2").replace(/\(/g, " ").split(/\s+/).map((w) => ALIASES[w] ?? w).join(" ");
  s = s.replace(/'(\d\d)\b/g, " 20$1").replace(/\s+/g, " ").trim();
  return `${s} bottle`;
}
