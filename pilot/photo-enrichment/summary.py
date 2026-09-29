"""Photo/enrichment pilot: the numbers for the report and review packet.

    python3 pilot/photo-enrichment/summary.py   → data/summary.json (+ prints it)
"""
import json, os
from collections import Counter, defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(DIR, "data/results.json")))["products"]
facts = json.load(open(os.path.join(DIR, "data/facts.json")))
images = json.load(open(os.path.join(DIR, "data/images.json")))
cands = json.load(open(os.path.join(DIR, "data/candidates.json")))
hosts = json.load(open(os.path.join(DIR, "data/hosts.json")))
CLS = ["exact", "representative", "possible", "none"]

def bucket(rows, key):
    t = defaultdict(Counter)
    for p in rows: t[key(p)][p["classification"]] += 1
    return t

def rows_for(t, order=None):
    out = []
    for k in (order or sorted(t)):
        c = t[k]; n = sum(c.values())
        out.append([k, n] + [c.get(x, 0) for x in CLS] + [f"{round(100 * (c.get('exact', 0)) / n)}%", f"{round(100 * (c.get('exact', 0) + c.get('representative', 0)) / n)}%"])
    return out
head = ["", "listings", "exact", "representative", "possible", "no image", "exact %", "exact+repr. %"]

# Wrong-image measurements (per candidate image, deduplicated per listing).
all_c = [(p, c) for p in R for c in p["candidates"]]
wrong = [(p, c) for p, c in all_c if c["visual"] == "wrong"]
product_photo_wrong = [(p, c) for p, c in wrong if not any(w in (c["review_notes"] or "").lower() for w in ("logo", "banner", "photo", "illustration", "graphic", "placeholder", "icon", "shelves", "map", "bark", "stills", "interior", "people", "landscape", "cigar"))]
text_exact_wrong = [(p, c) for p, c in wrong if c["text_only"] == "exact"]
text_any_wrong = [(p, c) for p, c in wrong if c["text_only"] in ("exact", "representative", "possible")]
by_kind_err = defaultdict(lambda: [0, 0])
for p, c in all_c:
    by_kind_err[p["kind"]][0] += 1
    if c["visual"] == "wrong": by_kind_err[p["kind"]][1] += 1
by_grp_err = defaultdict(lambda: [0, 0])
for p, c in all_c:
    g = "popular" if p["group"].startswith("popular") else p["group"]
    by_grp_err[g][0] += 1
    if c["visual"] == "wrong": by_grp_err[g][1] += 1

exact = [p for p in R if p["classification"] == "exact"]
def chosen(p): return next(c for c in p["candidates"] if c["sha256"] == p["chosen"])
perm = Counter(chosen(p)["permission"] for p in exact)
src_type_exact = Counter(chosen(p)["source_type"] for p in exact)
src_type_all = Counter(chosen(p)["source_type"] for p in R if p["chosen"])

# Facts: listings with at least one verified claim per attribute, by source type.
ATTR = ["producer", "category", "region", "grape_or_grain", "abv", "size", "age", "vintage", "tasting_notes"]
cov = {a: defaultdict(set) for a in ATTR}
conflicts = defaultdict(set)
for f in facts:
    if f["status"] == "verified": cov[f["attribute"]][f["source_type"]].add(f["csc"])
    if f["status"] == "conflict": conflicts[f["attribute"]].add(f["csc"])
unverified_candidates = Counter(f["attribute"] for f in facts if f["status"] == "unverified")
facts_head = ["attribute", "DABS", "producer", "other source", "any verified", "conflicts kept", "auto candidates (unverified)"]
facts_rows = [[a.replace("_", " "), len(cov[a]["dabs"]), len(cov[a]["producer"]), len(cov[a]["other"]), len(set().union(*cov[a].values()) if cov[a] else set()), len(conflicts[a]), unverified_candidates[a]] for a in ATTR]

pages = [pg for v in cands.values() for pg in v]
status = Counter("ok" if pg.get("http_status") == 200 else (pg.get("note") or f"HTTP {pg.get('http_status')}")[:40] for pg in pages)
blocked = sorted(h for h, v in hosts.items() if v.get("blocked"))
img_bytes = sum(v.get("bytes", 0) for v in images.values())

S = {
    "classification": Counter(p["classification"] for p in R),
    "by_kind_head": head, "by_kind_rows": rows_for(bucket(R, lambda p: p["kind"]), ["spirits", "wine", "beer", "other"]),
    "by_group_head": head, "by_group_rows": rows_for(bucket(R, lambda p: p["group"])),
    "popular_vs_difficult": rows_for(bucket(R, lambda p: p["group"].split(":")[0]), ["popular", "difficult"]),
    "exact_permission": perm, "exact_source_type": src_type_exact, "chosen_source_type": src_type_all,
    "rights_text": (f"All {len(exact)} exact matches have unknown permission: none of their pages states that the image may be reused "
                    f"(the pipeline looked for media-kit, press-image or reuse wording and found none that grants use). "
                    f"{src_type_exact.get('retailer', 0)} of the {len(exact)} come from retailer pages and {src_type_exact.get('producer', 0)} from producer pages; "
                    "retailer copies are usually the producer's own pack shot, but that is an inference, not permission."),
    "candidates_total": len(all_c), "pages_total": len(pages), "images_downloaded": len(images),
    "images_distinct_phash_groups": len({v.get('dup_group') for v in images.values() if v.get('dup_group')}),
    "image_bytes_total": img_bytes,
    "visually_wrong": len(wrong), "visually_wrong_product_photos": len(product_photo_wrong),
    "text_rules_would_accept_wrong_as_exact": len(text_exact_wrong),
    "text_rules_would_not_reject_wrong": len(text_any_wrong),
    "listings_with_caught_note": sum(1 for p in R if p.get("caught")),
    "wrong_rate_by_kind": {k: f"{v[1]}/{v[0]} candidate images" for k, v in by_kind_err.items()},
    "wrong_rate_by_group": {k: f"{v[1]}/{v[0]}" for k, v in sorted(by_grp_err.items())},
    "page_status": status, "blocked_hosts": blocked,
    "facts_head": facts_head, "facts_rows": facts_rows,
    "reused_codes": sum(1 for p in R if p.get("reused_code")),
}
json.dump(S, open(os.path.join(DIR, "data/summary.json"), "w"), indent=1, default=dict)
print(json.dumps(S, indent=1, default=dict))
