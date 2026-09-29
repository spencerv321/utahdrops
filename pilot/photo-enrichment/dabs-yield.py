"""Photo pilot follow-up: practical yield with external sources, the DABS
attached image, and both, on the frozen 100.

    python3 pilot/photo-enrichment/dabs-yield.py   → data/dabs-yield.json (+ prints tables)

Rules (the pilot's, unchanged):
  exact  = right item confirmed visually, size proven (legible volume on the
           picture, or a page that sells only that size), no conflict, wine
           vintage confirmed or non-vintage, clean packshot, long side ≥ 400 px.
A DABS attachment adds provenance (the picture is the one DABS uses for this
CSC); by itself it proves neither size nor vintage.

Tiers reported:
  external          the pilot's result
  dabs_strict       DABS picture: matches, clean, size legible on the picture,
                    no conflict (wine: vintage or NV confirmed)
  dabs_shape        as dabs_strict, but an unambiguous shape (1.75 L PET, flask,
                    12 vs 16 oz can) also counts as size evidence  [sensitivity]
  one_size_catalog  DABS picture matches and DABS's whole catalog (active and
                    delisted) has no other size of the same item  [sensitivity]
Every DABS image is 350 px tall, below the pilot's 400 px card rule, so each
DABS tier is also shown with that rule applied (it zeroes them).
"""
import json, os, re, subprocess
from collections import defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
R = {p["csc"]: p for p in json.load(open(os.path.join(DIR, "data/results.json")))["products"]}
D = json.load(open(os.path.join(DIR, "data/dabs-images.json")))
V = json.load(open(os.path.join(DIR, "data/dabs-review.json")))["items"]

# Other sizes of the same item anywhere in DABS's catalog (local copy of the catalog job's table).
def base(n): return re.sub(r"\s*\d+(\.\d+)?\s*(ml|l|m)?\s*$", "", n, flags=re.I).strip().upper()
rows = subprocess.run(["psql", "postgresql://postgres:postgres@127.0.0.1:5432/ud", "-Atc", "select csc, name, coalesce(size_ml,0) from products"],
                      capture_output=True, text=True, check=True).stdout.splitlines()
sizes = defaultdict(set)
for line in rows:
    csc, name, size = line.split("|")
    sizes[base(name)].add(int(size))
def other_sizes(csc):
    p = R[csc]
    return sorted(s for s in sizes[base(p["dabs_name"])] if s and s != (p["size_ml"] or 0))

def dabs_ok(csc, size_ok):
    v = V.get(csc)
    if not v or v["visual"] != "matches" or not v["usable"]: return False
    if R[csc]["kind"] == "wine" and v["vintage"] not in ("nv",) and not re.match(r"^\d{4}", v["vintage"] or ""): return False
    return size_ok(v, csc)
strict = lambda v, c: v["size_evidence"] == "label"
shape = lambda v, c: v["size_evidence"] in ("label", "shape")
onesize = lambda v, c: v["size_evidence"] in ("label", "shape") or (v["size_evidence"] == "none" and not other_sizes(c))

T = {}
for c, p in R.items():
    ext = p["classification"] == "exact"
    T[c] = {
        "external": ext,
        "dabs_image": bool(D[c].get("has_image")),
        "dabs_strict": dabs_ok(c, strict),
        "dabs_shape": dabs_ok(c, shape),
        "one_size_catalog": dabs_ok(c, onesize),
        "other_sizes_in_catalog": other_sizes(c),
        "external_class": p["classification"],
        "dabs_visual": (V.get(c) or {}).get("visual"),
    }

def grp(p): return "popular" if p["group"].startswith("popular") else "difficult"
cuts = {"all": lambda p: True, "popular": lambda p: grp(p) == "popular", "difficult": lambda p: grp(p) == "difficult",
        "spirits": lambda p: p["kind"] == "spirits", "wine": lambda p: p["kind"] == "wine", "beer": lambda p: p["kind"] == "beer", "other": lambda p: p["kind"] == "other"}
cols = [
    ("External only", lambda t: t["external"]),
    ("DABS image present", lambda t: t["dabs_image"]),
    ("DABS only, strict", lambda t: t["dabs_strict"]),
    ("Combined, strict", lambda t: t["external"] or t["dabs_strict"]),
    ("Combined + shape cue", lambda t: t["external"] or t["dabs_shape"]),
    ("Combined + one-size catalog", lambda t: t["external"] or t["one_size_catalog"]),
]
table = []
for name, f in cuts.items():
    cs = [c for c, p in R.items() if f(p)]
    table.append([name, len(cs)] + [sum(1 for c in cs if g(T[c])) for _, g in cols])

possible = [c for c, p in R.items() if p["classification"] == "possible"]
up = {k: [c for c in possible if T[c][k]] for k in ("dabs_strict", "dabs_shape", "one_size_catalog")}
new_from_none = {k: [c for c, p in R.items() if p["classification"] == "none" and T[c][k]] for k in ("dabs_strict", "dabs_shape", "one_size_catalog")}
conflicts = [c for c, v in V.items() if v["visual"] == "conflict"]
wine_repr = [c for c, v in V.items() if R[c]["kind"] == "wine" and v["visual"] in ("matches", "family") and v["usable"] and T[c]["dabs_image"]]
imgs = [r for r in D.values() if r.get("has_image")]
out = {
    "columns": ["cut", "listings"] + [n for n, _ in cols],
    "table": table,
    "possible_upgraded": up, "none_to_exact": new_from_none,
    "dabs_conflicts": conflicts,
    "wine_dabs_representative_candidates": wine_repr,
    "dabs_images": len(imgs), "dabs_bytes_total": sum(r["bytes"] for r in imgs),
    "dabs_bytes_median": sorted(r["bytes"] for r in imgs)[len(imgs) // 2],
    "dabs_height_px": sorted({r["height"] for r in imgs}),
    "pilot_400px_rule_passes": sum(1 for r in imgs if max(r["width"], r["height"]) >= 400),
    "per_listing": T,
}
json.dump(out, open(os.path.join(DIR, "data/dabs-yield.json"), "w"), indent=1)
print("\t".join(out["columns"]))
for r in table: print("\t".join(str(x) for x in r))
for k, v in up.items(): print(f"possible → exact via {k}: {len(v)} {v}")
for k, v in new_from_none.items(): print(f"no image → exact via {k}: {len(v)} {v}")
print("DABS conflicts:", conflicts)
print("images:", len(imgs), "bytes:", out["dabs_bytes_total"], "median:", out["dabs_bytes_median"], "heights:", out["dabs_height_px"], "pass 400px rule:", out["pilot_400px_rule_passes"])
