"""Record visual review verdicts into data/review.json. Stdin blocks:
@<csc> pages 0=same 1=family 2=other
A matches usable | notes
B wrong | notes            (usable defaults to yes; 'unusable' marks it no)
note: free text
caught: plausible wrong bottle rejected
fact: attribute | value | source_type | url | quote
Letters refer to the contact sheet (sheets/<csc>.json). 'same' = same-product,
'family' = product family only, 'other' = another product.
"""
import json, os, sys
DIR = os.path.dirname(os.path.abspath(__file__))
SHEETS = sys.argv[1]
p = os.path.join(DIR, "data/review.json")
d = json.load(open(p)) if os.path.exists(p) else {}
V = {"same": "same-product", "family": "family", "other": "other-product"}
cur = None
for raw in sys.stdin:
    line = raw.strip()
    if not line: continue
    if line.startswith("@"):
        parts = line[1:].split()
        csc = parts[0]
        cur = d.setdefault(csc, {"pages": {}, "images": {}})
        m = json.load(open(os.path.join(SHEETS, f"{csc}.json")))
        for kv in parts[2:] if len(parts) > 1 and parts[1] == "pages" else []:
            k, v = kv.split("="); cur["pages"][k] = V[v]
        continue
    if line.startswith("nv:"): cur["nv"] = line[3:].strip(); continue
    if line.startswith("note:"): cur["notes"] = line[5:].strip(); continue
    if line.startswith("caught:"): cur["caught"] = (cur.get("caught", "") + " " + line[7:].strip()).strip(); continue
    if line.startswith("fact:"):
        a, v, st, u, q = [x.strip() for x in line[5:].split("|", 4)]
        cur.setdefault("facts", []).append({"attribute": a, "value": v, "source_type": st, "source_url": u, "quote": q, "evidence": "checked by hand against the page during review"})
        continue
    head, _, notes = line.partition("|")
    toks = head.split()
    letter, visual = toks[0], toks[1]
    sha = m[letter]["sha256"]
    cur["images"][sha] = {"visual": {"match": "matches", "matches": "matches", "family": "family-only", "wrong": "wrong"}[visual],
                          "usable": "unusable" not in toks, "size_on_label": "size" in toks, "notes": notes.strip(), "letter": letter}
json.dump(d, open(p, "w"), indent=1)
print(len(d), "products reviewed")
