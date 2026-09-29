"""Photo/enrichment pilot: the ten most instructive successes and failures,
chosen by hand after review (letters refer to the contact sheets).

    python3 pilot/photo-enrichment/highlights.py <sheet_dir>   → data/highlights.json
"""
import json, os, sys
DIR = os.path.dirname(os.path.abspath(__file__))
SHEETS = sys.argv[1]
sha = lambda csc, letter: json.load(open(os.path.join(SHEETS, f"{csc}.json")))[letter]["sha256"]

SUCCESSES = [
    ("016434", "E", "Exact from the producer: the label itself reads “Bottled in Bond … 100 PROOF | 50% | 750 ML”, and the brand page's 8-year and single-malt bottles were rejected."),
    ("066685", "E", "Exact from a retailer: “70 cl … 55% vol” is legible on the label, matching DABS's 700 ml. The other retailer's copies were watermarked and included a 20 cl flask and Yellow Chartreuse."),
    ("038178", "B", "Exact: the 1.75 L handle is visible. The producer's own clean packshots were the 750 ml and 1 L bottles and were rejected for this code."),
    ("005349", "B", "Exact: “1.75” is legible on the label, on a page that sells only the 1.75 L. Related-product images on another retailer page were rejected."),
    ("088296", "B", "Exact from the producer: “750 ml … 40% alc./vol.” is printed on the bottle in the image."),
    ("012478", "A", "Exact: DABS's “PET” code matched a page for the 1.75 L plastic bottle, and the plastic handle bottle is visible."),
    ("547123", "A", "Exact for a wine: the box shows “3L” and no vintage, and the producer lists it as a non-vintage box wine."),
    ("031474", "A", "Exact: the 375 ml plastic flask matches DABS's 375 ml. Another retailer's “375 ml” page showed a full-size glass bottle with an older label."),
    ("017913", "C", "Expression picked correctly: the producer page shows Small Batch, Straight Rye and Toasted Barrel in the identical bottle, and only the “TOASTED BARREL” band identifies the right one. Held at possible because no page confirms the size."),
    ("024746", "A", "Exact image, and the fact track caught a real conflict: one retailer says 45% (90 proof), while another retailer and the label in the photo say 49% (98 proof). Both claims are kept for review."),
]
FAILURES = [
    ("929191", "A", "The most convincing wrong bottle: Berry Bros.' page for the 2022 village Vosne-Romanée shows a 2021 Premier Cru “Les Suchots” from the same domaine, with the same label design."),
    ("728795", "C", "The producer's “Prosecco” page shows only the Rosé and the Demi Sec, both in the same label design. The classic Prosecco DABS sells has no image anywhere we looked."),
    ("017927", "A", "A retailer's “Elijah Craig 94 proof Private Barrel” page uses an Angel's Envy Private Selection photo. The page text alone would have accepted it."),
    ("931992", "B", "A retailer's 2023 page shows the 2022 bottle; the vintage is legible on the label. Stale-vintage images are common and can only be representative."),
    ("065127", "A", "The producer's own US page shows a label reading 700 ml, while DABS sells the 1 L. It was caught only by reading the label."),
    ("018604", "E", "High West's 375 ml product page reuses the 750 ml bottle image, and the label says 750ml. This file was correctly accepted for the 750 ml listing, but on the 375 ml page it's the wrong size, so size claims from page text alone would be wrong."),
    ("918778", "G", "The only clean Juice Force render has 19.2 oz tall-can proportions, not the 355 ml can DABS lists."),
    ("478071", "A", "The producer's Pinot Noir page uses a Cabernet “815” label close-up as its share image, which is exactly what an og:image scraper would grab."),
    ("275090", "D", "Whispering Angel: the producer page's packshot is the 20th-vintage limited label, and the same page carries “The Pale”, a different rosé in the same bottle shape."),
    ("022085", "A", "A false negative from the rules: Willett Small Batch 4 yr is sold as “Cask Strength”, but DABS's name omits it, so the added words forced a reject even though the bottle appears right."),
]
out = {k: [{"csc": c, "sha": sha(c, l), "lesson": t} for c, l, t in v] for k, v in (("successes", SUCCESSES), ("failures", FAILURES))}
json.dump(out, open(os.path.join(DIR, "data/highlights.json"), "w"), indent=1)
print("ok")
