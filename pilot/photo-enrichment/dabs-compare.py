"""Photo pilot follow-up: measure the DABS-attached images and compare them
with the external candidates already downloaded.

    python3 pilot/photo-enrichment/dabs-compare.py <sheet_dir>

Adds to data/dabs-images.json: width/height/format, perceptual hashes,
identical-file matches across CSCs, and the nearest external candidate
(same CSC and anywhere in the pilot) by perceptual-hash distance. Draws one
contact sheet per CSC with an image: the DABS picture first, then the
nearest external candidates, for visual review.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps
import imagehash

DIR = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(DIR, ".cache")
SHEETS = sys.argv[1]
os.makedirs(SHEETS, exist_ok=True)
D = json.load(open(os.path.join(DIR, "data/dabs-images.json")))
ext = json.load(open(os.path.join(DIR, "data/images.json")))
results = {p["csc"]: p for p in json.load(open(os.path.join(DIR, "data/results.json")))["products"]}

def flat(path):
    im = Image.open(path)
    rgba = im.convert("RGBA")
    bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    return im, Image.alpha_composite(bg, rgba).convert("RGB")

ext_hash = {h: imagehash.hex_to_hash(v["phash"]) for h, v in ext.items() if v.get("phash")}
by_sha = {}
for csc, r in D.items():
    if not r.get("has_image"): continue
    im, rgb = flat(os.path.join(CACHE, r["file"]))
    r.update(width=im.size[0], height=im.size[1], format=im.format, mode=im.mode,
             phash=str(imagehash.phash(rgb)), dhash=str(imagehash.dhash(rgb)))
    # Rough sharpness: variance of a Laplacian-like edge filter, for comparing sources (not a pass/fail rule).
    from PIL import ImageFilter, ImageStat
    r["edge_variance"] = round(ImageStat.Stat(rgb.convert("L").filter(ImageFilter.FIND_EDGES)).var[0], 1)
    by_sha.setdefault(r["sha256"], []).append(csc)
    ph = imagehash.hex_to_hash(r["phash"])
    own = {c["sha256"] for c in results[csc]["candidates"]}
    dist = sorted(((ph - v, h) for h, v in ext_hash.items()), key=lambda x: x[0])
    r["nearest_external_any"] = [{"sha256": h, "distance": int(d), "same_csc": h in own, "found_for": [f["csc"] for f in ext[h]["found_for"]][:3]} for d, h in dist[:3]]
    own_d = sorted(((ph - ext_hash[h], h) for h in own if h in ext_hash), key=lambda x: x[0])
    r["nearest_external_same_csc"] = [{"sha256": h, "distance": int(d)} for d, h in own_d[:3]]
for csc, r in D.items():
    if r.get("has_image"):
        r["identical_file_on_other_cscs"] = [c for c in by_sha[r["sha256"]] if c != csc]
json.dump(D, open(os.path.join(DIR, "data/dabs-images.json"), "w"), indent=1)

try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except OSError:
    font = small = ImageFont.load_default()
CELL = 300
for csc, r in D.items():
    if not r.get("has_image"): continue
    tiles = [("DABS", os.path.join(CACHE, r["file"]), f"{r['width']}x{r['height']} {r['format']}", "attached to CSC")]
    chosen = results[csc]["chosen"]
    seen = set()
    for n in r["nearest_external_same_csc"][:2]:
        seen.add(n["sha256"])
        tag = "pilot choice" if n["sha256"] == chosen else "pilot candidate"
        e = ext[n["sha256"]]
        tiles.append((f"ext d={n['distance']}", os.path.join(CACHE, f"img-{n['sha256']}"), f"{e['width']}x{e['height']}", tag))
    if chosen and chosen not in seen and chosen in ext:
        e = ext[chosen]
        tiles.append(("ext chosen", os.path.join(CACHE, f"img-{chosen}"), f"{e['width']}x{e['height']}", "pilot choice"))
    sheet = Image.new("RGB", (len(tiles) * CELL, 34 + CELL + 36), "white")
    d = ImageDraw.Draw(sheet)
    d.text((6, 8), f"{csc}  {results[csc]['dabs_name']}", fill="black", font=font)
    for k, (label, path, dims, tag) in enumerate(tiles):
        _, rgb = flat(path)
        # DABS images are small: show them at their real pixel size (no upscaling) so quality reads true.
        img = rgb.copy(); img.thumbnail((CELL - 10, CELL - 10))
        x = k * CELL
        sheet.paste(img, (x + (CELL - img.width) // 2, 34 + (CELL - img.height) // 2))
        d.text((x + 4, 34 + CELL), f"{chr(65 + k)} {label} {dims}", fill="black", font=small)
        d.text((x + 4, 34 + CELL + 15), tag, fill="gray", font=small)
    sheet.save(os.path.join(SHEETS, f"dabs-{csc}.jpg"), quality=88)
    json.dump({chr(65 + k): t[0] for k, t in enumerate(tiles)}, open(os.path.join(SHEETS, f"dabs-{csc}.json"), "w"))

imgs = [r for r in D.values() if r.get("has_image")]
print(len(imgs), "DABS images")
print("sizes:", sorted({(r["width"], r["height"]) for r in imgs}))
print("formats:", {r["format"] for r in imgs}, "bytes median:", sorted(r["bytes"] for r in imgs)[len(imgs) // 2])
print("identical across CSCs:", {s: c for s, c in by_sha.items() if len(c) > 1})
print("near-identical to an external candidate (d<=6):", sum(1 for r in imgs if r["nearest_external_any"][0]["distance"] <= 6))
