"""Append source refs to data/sources.json. Line format (stdin):
csc | url | org | source_type | query | rank
"""
import json, sys, os
p = os.path.join(os.path.dirname(__file__), "data/sources.json")
d = json.load(open(p)) if os.path.exists(p) else {}
for line in sys.stdin:
    line = line.strip()
    if not line or line.startswith("#"): continue
    csc, url, org, st, q, rank = [x.strip() for x in line.split("|")]
    refs = d.setdefault(csc, [])
    if any(r["url"] == url for r in refs): continue
    refs.append({"url": url, "found_by": f'WebSearch "{q}" rank {rank}' if q else "none (search found no page)", "org": org, "source_type": st})
json.dump(d, open(p, "w"), indent=1)
print(len(d), "products,", sum(len(v) for v in d.values()), "refs")
