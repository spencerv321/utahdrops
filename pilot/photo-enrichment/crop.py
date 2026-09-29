"""crop.py <csc> <letter> <x0> <y0> <x1> <y1> (fractions) -> scratch zoom image"""
import json, sys, os
from PIL import Image
S = os.environ["S"]; DIR = os.path.dirname(os.path.abspath(__file__))
csc, letter, *box = sys.argv[1:]
m = json.load(open(f"{S}/sheets/{csc}.json"))
im = Image.open(os.path.join(DIR, ".cache", "img-" + m[letter]["sha256"])).convert("RGB")
w, h = im.size
x0, y0, x1, y1 = [float(b) for b in box]
c = im.crop((int(x0*w), int(y0*h), int(x1*w), int(y1*h)))
c.thumbnail((900, 900)) if c.width > 900 else c.resize((c.width*2, c.height*2))
out = f"{S}/zoom-{csc}-{letter}.jpg"; c.save(out, quality=90); print(out, c.size)
