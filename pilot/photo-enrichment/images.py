"""Photo/enrichment pilot: measure every downloaded candidate image and draw
contact sheets for visual review.

    python3 pilot/photo-enrichment/images.py [sheet_dir]

Reads data/candidates.json and the image cache (.cache/img-<sha256>), writes
data/images.json (per image: dimensions, format, bytes, sha256, perceptual
hash, near-duplicate group, codes it was found for) and, for review, one
contact sheet per product plus small review thumbnails in .cache/thumbs.
Needs Pillow and imagehash.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps
import imagehash

DIR = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(DIR, ".cache")
THUMBS = os.path.join(CACHE, "thumbs")
SHEETS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(CACHE, "sheets")
os.makedirs(THUMBS, exist_ok=True)
os.makedirs(SHEETS, exist_ok=True)

cands = json.load(open(os.path.join(DIR, "data/candidates.json")))
dabs = json.load(open(os.path.join(DIR, "data/dabs.json")))
images = {}
for csc, pages in cands.items():
    for pi, page in enumerate(pages):
        for ii, im in enumerate(page.get("images") or []):
            h = im.get("sha256")
            if not h:
                continue
            rec = images.setdefault(h, {"sha256": h, "found_for": [], "urls": []})
            rec["found_for"].append({"csc": csc, "page": pi, "image": ii})
            if im["url"] not in rec["urls"]:
                rec["urls"].append(im["url"])

for h, rec in images.items():
    path = os.path.join(CACHE, f"img-{h}")
    try:
        img = Image.open(path)
        rec["format"] = img.format
        rec["width"], rec["height"] = img.size
        rec["bytes"] = os.path.getsize(path)
        rgb = img.convert("RGBA")
        bg = Image.new("RGBA", rgb.size, (255, 255, 255, 255))
        rgb = Image.alpha_composite(bg, rgb).convert("RGB")
        rec["phash"] = str(imagehash.phash(rgb))
        rec["dhash"] = str(imagehash.dhash(rgb))
        t = rgb.copy()
        t.thumbnail((360, 360))
        t.save(os.path.join(THUMBS, f"{h}.jpg"), "JPEG", quality=80)
    except Exception as e:  # SVG, AVIF without plugin, truncated files
        rec["error"] = str(e)[:200]

# Near-duplicates: perceptual hashes within Hamming distance 6 share a group.
hs = [(h, imagehash.hex_to_hash(r["phash"])) for h, r in images.items() if "phash" in r]
group = {}
for i, (h, ph) in enumerate(hs):
    if h in group:
        continue
    group[h] = h[:12]
    for h2, ph2 in hs[i + 1:]:
        if h2 not in group and ph - ph2 <= 6:
            group[h2] = h[:12]
for h, g in group.items():
    images[h]["dup_group"] = g
json.dump(images, open(os.path.join(DIR, "data/images.json"), "w"), indent=1)

# Contact sheets: one per product, candidates labeled A, B, C… in page order.
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except OSError:
    font = small = ImageFont.load_default()
CELL = 300
for csc, pages in cands.items():
    tiles = []
    for pi, page in enumerate(pages):
        for ii, im in enumerate(page.get("images") or []):
            h = im.get("sha256")
            if h and "phash" in images.get(h, {}):
                tiles.append((pi, ii, h, page.get("org", ""), im.get("via", "")))
    name = dabs.get(csc, {}).get("name", csc)
    cols = max(1, min(4, len(tiles)))
    rows = max(1, (len(tiles) + cols - 1) // cols)
    sheet = Image.new("RGB", (cols * CELL, 34 + rows * (CELL + 36)), "white")
    d = ImageDraw.Draw(sheet)
    d.text((6, 8), f"{csc}  {name}", fill="black", font=font)
    if not tiles:
        d.text((6, 60), "no downloadable candidate images", fill="red", font=font)
    for k, (pi, ii, h, org, via) in enumerate(tiles):
        x, y = (k % cols) * CELL, 34 + (k // cols) * (CELL + 36)
        img = Image.open(os.path.join(CACHE, f"img-{h}")).convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img).convert("RGB")
        img = ImageOps.contain(img, (CELL - 10, CELL - 10))
        sheet.paste(img, (x + (CELL - img.width) // 2, y + (CELL - img.height) // 2))
        r = images[h]
        d.text((x + 4, y + CELL), f"{chr(65 + k)} p{pi}i{ii} {r['width']}x{r['height']}", fill="black", font=small)
        d.text((x + 4, y + CELL + 15), f"{org[:30]} · {via[:14]}", fill="gray", font=small)
    sheet.save(os.path.join(SHEETS, f"{csc}.jpg"), "JPEG", quality=85)
    json.dump({chr(65 + k): {"page": pi, "sha256": h} for k, (pi, ii, h, org, via) in enumerate(tiles)}, open(os.path.join(SHEETS, f"{csc}.json"), "w"))

print(len(images), "images;", sum(1 for r in images.values() if "error" in r), "unreadable;",
      len(set(group.values())), "distinct after near-duplicate grouping")
