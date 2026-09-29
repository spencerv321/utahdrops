"""Photo/enrichment pilot: build the review packet (one self-contained HTML page).

    python3 pilot/photo-enrichment/packet.py <out.html>

Reads data/results.json, data/facts.json, data/highlights.json and the local
thumbnails (.cache/thumbs). Thumbnails are embedded as small data URIs so the
packet works offline and as a private review page; it is a review aid, never
a production asset, and it isn't committed to git.
"""
import base64, html, io, json, os, sys
from collections import Counter, defaultdict
from PIL import Image

DIR = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
R = json.load(open(os.path.join(DIR, "data/results.json")))
products = R["products"]
facts = json.load(open(os.path.join(DIR, "data/facts.json")))
hl = json.load(open(os.path.join(DIR, "data/highlights.json")))
summary = json.load(open(os.path.join(DIR, "data/summary.json")))
DI = json.load(open(os.path.join(DIR, "data/dabs-images.json")))
DS = json.load(open(os.path.join(DIR, "data/dabs-images-siblings.json")))
DV = json.load(open(os.path.join(DIR, "data/dabs-review.json")))["items"]
DY = json.load(open(os.path.join(DIR, "data/dabs-yield.json")))
DH = json.load(open(os.path.join(DIR, "data/dabs-highlights.json")))
SIB = json.load(open(os.path.join(DIR, "data/sibling-codes.json")))["codes"]
e = lambda s: html.escape(str(s if s is not None else ""))

_thumbs = {}
def thumb(sha):
    if sha in _thumbs: return _thumbs[sha]
    p = os.path.join(DIR, ".cache", "thumbs", f"{sha}.jpg")
    if not os.path.exists(p): return None
    im = Image.open(p).convert("RGB"); im.thumbnail((200, 200))
    b = io.BytesIO(); im.save(b, "JPEG", quality=68)
    _thumbs[sha] = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
    return _thumbs[sha]

def dabs_thumb(rec, box=200):
    """DABS pictures are only 350 px tall; shown at most at that size, never upscaled."""
    key = "d" + rec["sha256"] + str(box)
    if key in _thumbs: return _thumbs[key]
    im = Image.open(os.path.join(DIR, ".cache", rec["file"])).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); im = Image.alpha_composite(bg, im).convert("RGB")
    im.thumbnail((box, box)); b = io.BytesIO(); im.save(b, "JPEG", quality=72)
    _thumbs[key] = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
    return _thumbs[key]

CAND_LABEL = {"exact": "✓ This image: accepted as exact", "representative": "✓ This image: accepted as representative (wine)", "possible": "? This image: possible, not accepted", "reject": "✕ This image: rejected"}
CLS_LABEL = {"exact": "Exact", "representative": "Representative", "possible": "Possible", "reject": "Rejected", "none": "No image"}
VIS_LABEL = {"matches": "looked: matches", "family-only": "looked: family only", "wrong": "looked: wrong item", "not-inspected": "not inspected"}

def pick(cands):
    """Best candidates first, then the instructive rejects (visually wrong), one per near-duplicate group."""
    seen, keep = set(), []
    good = [c for c in cands if c["classification"] != "reject"]
    wrong = [c for c in cands if c["classification"] == "reject" and c["visual"] == "wrong"]
    other = [c for c in cands if c["classification"] == "reject" and c["visual"] != "wrong"]
    for group, limit in ((good, 3), (wrong, 3), (other, 2)):
        n = 0
        for c in group:
            g = c.get("dup_group") or c["sha256"]
            if g in seen or n >= limit: continue
            seen.add(g); keep.append(c); n += 1
    return keep

def cand_html(c, chosen=None):
    t = thumb(c["sha256"])
    img = f'<img src="{t}" alt="" loading="lazy">' if t else '<div class="noimg">no thumbnail</div>'
    cmp = c["comparison"]
    stated = c["stated"]
    bits = []
    if stated["sizes"]: bits.append("sizes " + "/".join(str(s) for s in stated["sizes"]) + " ml")
    if stated["proofs"]: bits.append("proof " + "/".join(str(s) for s in stated["proofs"]))
    if stated["vintages"]: bits.append("vintage " + "/".join(str(s) for s in stated["vintages"]))
    if c.get("gtins"): bits.append(", ".join(c["gtins"]))
    return f"""<figure class="cand c-{c['classification']}">
  <div class="thumb">{img}{'<span class="xmark" aria-hidden="true">✕</span>' if c['classification'] == 'reject' else ''}</div>
  <figcaption>
    <span class="cverdict cv-{c['classification']}">{CAND_LABEL[c['classification']]}</span>
    {'<span class="shown">Image proposed for this listing</span>' if c['sha256'] == chosen else ''}
    <span class="vis">{e(VIS_LABEL.get(c['visual'], c['visual']))}</span>
    <p class="note">{e(c.get('review_notes') or '')}</p>
    <p class="why">{e('; '.join(c['why'][:3]))}</p>
    {'<p class="conf">Conflicts: ' + e('; '.join(cmp['conflicts'])) + '</p>' if cmp['conflicts'] else ''}
    <dl>
      <dt>Source</dt><dd><a href="{e(c['source_page'])}" target="_blank" rel="noopener">{e(c['source_org'])}</a> · {e(c['source_type'])}</dd>
      <dt>Image</dt><dd><a href="{e(c['image_url'])}" target="_blank" rel="noopener">{e(c.get('width'))}×{e(c.get('height'))} {e(c.get('format'))}</a> · {e(c['via'])}</dd>
      <dt>Page says</dt><dd>{e(c['source_name'][:90])}{(' · ' + e(', '.join(bits))) if bits else ''}</dd>
      <dt>Rights</dt><dd>{e(c['permission'])}</dd>
      <dt>Hash</dt><dd class="mono">sha256 {e(c['sha256'][:12])}… · phash {e(c.get('phash'))}</dd>
      <dt>Found by</dt><dd>{e(c['found_by'])} · {e((c.get('retrieved_at') or '')[:10])}</dd>
    </dl>
  </figcaption>
</figure>"""

FACT_ORDER = ["producer", "category", "region", "grape_or_grain", "abv", "size", "age", "vintage", "tasting_notes"]
def facts_html(csc):
    rows = [f for f in facts if f["csc"] == csc and f["status"] != "unknown"]
    unknown = [f["attribute"] for f in facts if f["csc"] == csc and f["status"] == "unknown"]
    rows.sort(key=lambda f: (FACT_ORDER.index(f["attribute"]), f["source_type"]))
    out = []
    for f in rows[:18]:
        src = f'<a href="{e(f["source_url"])}" target="_blank" rel="noopener">{e(f["source_type"])}</a>' if (f["source_url"] or "").startswith("http") else e(f["source_type"])
        out.append(f'<tr class="st-{e(f["status"])}"><td>{e(f["attribute"].replace("_", " "))}</td><td>{e(f["value"][:140])}</td><td>{src}</td><td>{e(f["status"])}</td><td class="q">{e((f["quote"] or "")[:160])}</td></tr>')
    return f"""<details class="facts"><summary>Proposed facts ({len(rows)} claims; unknown: {e(', '.join(a.replace('_', ' ') for a in unknown)) or 'none'})</summary>
<div class="tablewrap"><table><thead><tr><th>Attribute</th><th>Value</th><th>Source</th><th>Status</th><th>Exact supporting text</th></tr></thead><tbody>{''.join(out)}</tbody></table></div></details>"""

def dabs_panel(p):
    rec = DI.get(p["csc"]) or {}
    y = DY["per_listing"][p["csc"]]
    if not rec.get("has_image"):
        return '<div class="dabs none"><span class="dlab">DABS attached image</span> <span class="muted">none on the DABS detail page for this CSC</span></div>'
    v = DV[p["csc"]]
    exact = y["dabs_strict"]
    depict = ("Yes, strict: size legible in the picture" if exact else
              "Only with the shape-cue rule (sensitivity)" if y["dabs_shape"] else
              "Only with the one-size-catalog rule (sensitivity)" if y["one_size_catalog"] else
              "No: conflicts with the listing" if v["visual"] == "conflict" else "No: " + ("size not shown" if v["size_evidence"] == "none" else "not proven"))
    near = rec.get("nearest_external_same_csc") or []
    near_txt = f"closest pilot candidate for this CSC: phash distance {near[0]['distance']}" + (" (same packshot)" if near[0]['distance'] <= 10 else "") if near else "no pilot candidate to compare"
    return f"""<div class="dabs dv-{v['visual']}">
  <img src="{dabs_thumb(rec)}" alt="Image DABS attaches to {e(p['csc'])}">
  <div class="dbody">
    <span class="dlab">DABS attached image</span> <span class="mono">{rec['width']}×{rec['height']} PNG · {rec['bytes']//1024} KB · sha256 {rec['sha256'][:12]}…</span>
    <ul class="judg">
      <li><b>Attached to the official CSC:</b> yes (inline on the DABS detail page for {e(p['csc'])})</li>
      <li><b>Visually verified exact depiction:</b> {e(depict)}</li>
      <li><b>Reuse rights:</b> not established (DABS hosting ≠ permission; Utah.gov disclaims copyright warranties)</li>
    </ul>
    <p>{e(v['notes'])}</p>
    <p class="muted">Looked: {e(v['visual'])} · size evidence: {e(v['size_evidence'])} · vintage: {e(v['vintage'])} · {e(near_txt)}{(' · identical file on sample codes ' + e(', '.join(rec['identical_file_on_other_cscs']))) if rec.get('identical_file_on_other_cscs') else ''}</p>
  </div>
</div>"""

def product_html(p):
    cls = p["classification"]
    cands = pick(p["candidates"])
    pages = "".join(f'<li><a href="{e(pg["url"])}" target="_blank" rel="noopener">{e(pg["org"])}</a> <span class="muted">{e(pg["source_type"])} · HTTP {e(pg["http_status"])}{(" · " + e(pg["note"])) if pg.get("note") else ""} · review: {e(pg["verdict"])}</span></li>' for pg in p["pages"]) or "<li class='muted'>No public page found</li>"
    return f"""<article class="product" id="p{p['csc']}" data-cls="{cls}" data-kind="{p['kind']}" data-group="{e(p['group'].split(':')[0])}" data-sub="{e(p['group'])}">
  <header>
    <div class="ident">
      <span class="code mono">{p['csc']}</span>
      <h3>{e(p['dabs_name'])}</h3>
      <p class="muted">{e(p['category'])} · {e(p['size_ml'] or '?')} ml · {e(p['kind'])} · {e(p['group'])} — {e(p['selection_reason'][:120])}</p>
      {('<p class="muted">Sold under: ' + e(' | '.join(p['sale_names'])) + '</p>') if len(p['sale_names']) > 1 else ''}
      {('<p class="desc">DABS text: “' + e(p['dabs_description']) + '”</p>') if p.get('dabs_description') else ''}
    </div>
    <div class="lverdict lv-{cls}"><span class="lvlab">Listing result</span><span class="lvval">{CLS_LABEL[cls]}</span><span class="lvsub">external sources, pilot rules</span></div>
  </header>
  {dabs_panel(p)}
  {('<p class="caught">Caught in review: ' + e(p['caught']) + '</p>') if p.get('caught') else ''}
  {('<p class="pnote">' + e(p['notes']) + '</p>') if p.get('notes') else ''}
  <div class="cands">{''.join(cand_html(c, p['chosen']) for c in cands) or '<p class="muted">No candidate image.</p>'}</div>
  <details class="pages"><summary>Sources tried ({len(p['pages'])})</summary><ul>{pages}</ul></details>
  {facts_html(p['csc'])}
</article>"""

def hl_html(items, kind):
    by = {p["csc"]: p for p in products}
    out = []
    for i, h in enumerate(items, 1):
        p = by[h["csc"]]
        c = next((x for x in p["candidates"] if x["sha256"] == h.get("sha")), None) or (p["candidates"][0] if p["candidates"] else None)
        t = thumb(c["sha256"]) if c else None
        ccls = c["classification"] if c else None
        out.append(f"""<li class="hl hl-{kind}"><a href="#p{p['csc']}" class="hlimg{' rej' if ccls == 'reject' else ''}">{f'<img src="{t}" alt="">' if t else '<div class="noimg">—</div>'}{'<span class="xmark" aria-hidden="true">✕</span>' if ccls == 'reject' else ''}</a>
<div><strong>{i}. {e(p['dabs_name'])}</strong>
<p class="twov"><span class="cverdict cv-{ccls}">{CAND_LABEL.get(ccls, 'no image')}</span> <span class="lvinline">Listing result: <b class="p-{p['classification']}">{CLS_LABEL[p['classification']]}</b></span></p>
<p>{e(h['lesson'])}</p>
{f'<p class="muted"><a href="{e(c["source_page"])}" target="_blank" rel="noopener">{e(c["source_org"])}</a> · <a href="{e(c["image_url"])}" target="_blank" rel="noopener">image</a></p>' if c else ''}</div></li>""")
    return "".join(out)

def sib_html():
    groups = {}
    for c in SIB: groups.setdefault(c["group"], []).append(c["csc"])
    out = []
    for g in DH["sibling_groups"]:
        full = next(k for k in groups if k.startswith(g["group"]))
        samp = full.split("sample: ")[1].split()[0].rstrip(",)")
        tiles = []
        for c in [samp] + groups[full]:
            rec = DI.get(c) or DS.get(c)
            name = rec.get("page_name", c)
            if rec.get("has_image"):
                tiles.append(f'<figure><img src="{dabs_thumb(rec, 140)}" alt=""><figcaption>{e(name[-12:])}<br><span class="mono">{rec["sha256"][:8]}</span></figcaption></figure>')
            else:
                tiles.append(f'<figure><div class="noimg">no image</div><figcaption>{e(name[-12:])}</figcaption></figure>')
        out.append(f'<div class="sib"><p><b>{e(g["group"])}</b> — {e(g["finding"])}</p><div class="sibrow">{"".join(tiles)}</div></div>')
    return "".join(out)

def dabs_hl(items, kind):
    by = {p["csc"]: p for p in products}
    out = []
    for i, h in enumerate(items, 1):
        p = by[h["csc"]]; rec = DI[h["csc"]]
        out.append(f"""<li class="hl hl-{kind}"><a href="#p{p['csc']}" class="hlimg"><img src="{dabs_thumb(rec, 140)}" alt=""></a>
<div><strong>{i}. {e(p['dabs_name'])}</strong>
<p class="twov"><span class="cverdict cv-{'exact' if DY['per_listing'][p['csc']]['dabs_strict'] else ('reject' if DV[p['csc']]['visual'] == 'conflict' else 'possible')}">DABS image: {e(DV[p['csc']]['visual'])}, size evidence {e(DV[p['csc']]['size_evidence'])}</span> <span class="lvinline">Listing result (external): <b class="p-{p['classification']}">{CLS_LABEL[p['classification']]}</b></span></p>
<p>{e(h['lesson'])}</p></div></li>""")
    return "".join(out)

def table(rows, head):
    return '<div class="tablewrap"><table><thead><tr>' + "".join(f"<th>{e(h)}</th>" for h in head) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{e(x)}</td>" for x in r) + "</tr>" for r in rows) + "</tbody></table></div>"

S = summary
cls_counts = Counter(p["classification"] for p in products)
tiles = "".join(f'<div class="tile t-{k}"><span class="num">{cls_counts.get(k, 0)}</span><span class="lab">{CLS_LABEL[k]}</span></div>' for k in ["exact", "representative", "possible", "none"])

body = f"""
<header class="top">
  <p class="eyebrow">Utah Drops · staging only · not published</p>
  <h1>Product photo & facts pilot</h1>
  <p><a href="#dabs">Jump to the DABS image follow-up</a></p>
  <p class="lede">100 DABS listings, {S['candidates_total']} candidate images from {S['pages_total']} public pages, every downloaded image looked at. Generated {e(R['generated_at'][:16].replace('T', ' '))} UTC. Classification rules: exact needs brand, expression and size confirmed, no conflicts and a visual check; wine without a confirmed vintage is at most representative; anything unclear is possible or nothing.</p>
  <div class="tiles">{tiles}</div>
</header>
<section class="summary">
  <h2>Coverage by type and group</h2>
  {table(S['by_kind_rows'], S['by_kind_head'])}
  {table(S['by_group_rows'], S['by_group_head'])}
  <h2>Rights</h2>
  <p>{e(S['rights_text'])}</p>
  <h2>Facts coverage</h2>
  {table(S['facts_rows'], S['facts_head'])}
</section>
<section class="dabsfu" id="dabs">
  <h2>Follow-up: the image DABS attaches to each CSC</h2>
  <p class="lede">The only DABS product image is embedded in each product's public detail page (inline PNG, 350 px tall, alt “Product bottle or can”). The catalog table, the monthly XLSX and the drawing/allocated pages carry none. 38 of the frozen 100 have one. Three claims are kept apart: <b>attached to the CSC</b> (provenance), <b>visually verified exact depiction</b> (size, expression, vintage in the picture), and <b>reuse rights</b> (not established for any image).</p>
  {table(DY['table'], DY['columns'])}
  <p class="muted">Strict = the pilot's rules (size legible in the picture or a single-size page). Shape cue and one-size-catalog are looser sensitivity rules, not recommendations. Every DABS picture is 350 px tall; under the pilot's 400 px card rule only 3 of 38 qualify and neither strict DABS gain does.</p>
  <h3 class="sub">DABS reuses one file across sizes (sibling annex, outside the frozen 100)</h3>
  <div class="sibs">{sib_html()}</div>
  <h3 class="sub">DABS image: instructive successes</h3><ol class="hls">{dabs_hl(DH['successes'], 'ok')}</ol>
  <h3 class="sub">DABS image: dangerous failures</h3><ol class="hls">{dabs_hl(DH['failures'], 'bad')}</ol>
</section>
<section class="highlights">
  <h2>Ten instructive successes</h2><ol class="hls">{hl_html(hl['successes'], 'ok')}</ol>
  <h2>Ten instructive failures</h2><ol class="hls">{hl_html(hl['failures'], 'bad')}</ol>
</section>
<section class="all">
  <h2>All 100 listings</h2>
  <div class="filters" role="group" aria-label="Filter listings">
    <label for="f-cls">Result</label><select id="f-cls"><option value="">All</option>{''.join(f'<option value="{k}">{v}</option>' for k, v in CLS_LABEL.items() if k != 'reject')}</select>
    <label for="f-kind">Type</label><select id="f-kind"><option value="">All</option><option>spirits</option><option>wine</option><option>beer</option><option>other</option></select>
    <label for="f-group">Sample</label><select id="f-group"><option value="">All</option><option value="popular">Popular</option><option value="difficult">Difficult</option></select>
    <span id="f-count" class="muted"></span>
  </div>
  {''.join(product_html(p) for p in products)}
</section>
"""

CSS = """
/* Layout: one reading column of listing cards; each card = DABS identity, then candidates side by side, then sources and facts. */
:root{--bg:#f6f5f1;--panel:#ffffff;--fg:#221d18;--muted:#6d655c;--line:#e2ddd4;--accent:#8a3b1e;
--exact:#1f6b3a;--rep:#2d5a8a;--poss:#9a6a00;--none:#6d655c;--bad:#a3261e;--badbg:#fbeceb;--okbg:#e9f3ec;
--display:'Fraunces',Georgia,serif;--body:'Source Sans 3',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1a1714;--panel:#24201c;--fg:#ece6dd;--muted:#a79d91;--line:#3a332d;--accent:#e08a62;--exact:#6cc48c;--rep:#8ab6e6;--poss:#e0b54a;--none:#a79d91;--bad:#f08a80;--badbg:#3a2220;--okbg:#1f3326;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1a1714;--panel:#24201c;--fg:#ece6dd;--muted:#a79d91;--line:#3a332d;--accent:#e08a62;--exact:#6cc48c;--rep:#8ab6e6;--poss:#e0b54a;--none:#a79d91;--bad:#f08a80;--badbg:#3a2220;--okbg:#1f3326;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--body);font-size:15px;line-height:1.5}
main{max-width:1180px;margin:0 auto;padding-inline:16px;padding-block:24px 64px;display:grid;grid-template-columns:minmax(0,1fr);gap:40px}
main>*{min-width:0}
h1,h2,h3{font-family:var(--display);text-wrap:balance;margin:0}
h1{font-size:2.2rem;font-weight:600}h2{font-size:1.35rem;margin-block:8px}h3{font-size:1.05rem;font-family:var(--body);font-weight:700}
a{color:var(--accent)}a:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.75rem;color:var(--accent);margin:0 0 6px}
.lede{max-width:70ch;color:var(--muted)}
.muted{color:var(--muted)}.mono{font-family:var(--mono);font-size:.78rem}
.tiles{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
.tile{flex:1 1 140px;background:var(--panel);border:1px solid var(--line);padding:12px 14px;display:flex;flex-direction:column}
.tile .num{font-family:var(--display);font-size:2rem;font-variant-numeric:tabular-nums}
.tile .lab{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.t-exact .num{color:var(--exact)}.t-representative .num{color:var(--rep)}.t-possible .num{color:var(--poss)}.t-none .num{color:var(--none)}
.tablewrap{overflow-x:auto;margin-block:8px 16px}
table{border-collapse:collapse;font-size:.85rem;font-variant-numeric:tabular-nums;min-width:100%}
th,td{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
th{font-weight:600;color:var(--muted)}
td.q{color:var(--muted);max-width:40ch}
.pill{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border:1px solid currentColor}
.pill.big{font-size:.8rem;padding:4px 10px;align-self:flex-start;white-space:nowrap}
.p-exact{color:var(--exact)}.p-representative{color:var(--rep)}.p-possible{color:var(--poss)}.p-none{color:var(--none)}.p-reject{color:var(--bad)}
.hls{list-style:none;padding:0;display:grid;gap:10px}
.hl{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px;background:var(--panel);border:1px solid var(--line);padding:10px}
.hl img,.hl .noimg{width:90px;height:90px;object-fit:contain;background:#fff}
.hl p{margin:4px 0}.hl-bad{border-left:3px solid var(--bad)}.hl-ok{border-left:3px solid var(--exact)}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
select{font:inherit;padding:3px 6px}
.product{background:var(--panel);border:1px solid var(--line);padding:14px;margin-bottom:14px}
.product header{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}
.ident{min-width:0}.ident p{margin:2px 0;font-size:.85rem}
.code{color:var(--muted)}
.desc{font-style:italic;color:var(--muted)}
.caught{background:var(--badbg);padding:6px 10px;margin:10px 0 0;font-size:.88rem}
.pnote{font-size:.88rem;margin:8px 0 0}
.cands{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:12px}
.cand{margin:0;border:1px solid var(--line);display:flex;flex-direction:column;min-width:0}
.cand.c-reject{border-color:var(--bad)}
.cand .thumb{background:#fff;height:180px;display:flex;align-items:center;justify-content:center}
.cand img{max-height:170px;max-width:100%;object-fit:contain}
.noimg{color:#888;font-size:.8rem}
figcaption{padding:8px;font-size:.8rem;display:grid;gap:4px;min-width:0}
figcaption p{margin:0}.vis{color:var(--muted);margin-left:6px}.why{color:var(--muted)}.conf{color:var(--bad)}
dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 8px;margin:4px 0 0}
dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}
details{margin-top:10px;font-size:.85rem}summary{cursor:pointer;color:var(--accent)}
.pages ul{margin:6px 0;padding-left:18px}
.lverdict{display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:2px solid currentColor;padding:6px 10px;min-width:9.5rem}
.lvlab{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.lvval{font-family:var(--display);font-size:1.15rem;font-weight:600}
.lvsub{font-size:.7rem;color:var(--muted)}
.lv-exact{color:var(--exact)}.lv-representative{color:var(--rep)}.lv-possible{color:var(--poss)}.lv-none{color:var(--none)}
.cverdict{display:inline-block;font-size:.74rem;font-weight:700;padding:2px 6px;border-radius:2px;color:var(--panel)}
.cv-exact{background:var(--exact)}.cv-representative{background:var(--rep)}.cv-possible{background:var(--poss)}.cv-reject{background:var(--bad)}.cv-None{background:var(--none)}
.shown{display:inline-block;font-size:.72rem;font-weight:600;color:var(--exact);border:1px dashed var(--exact);padding:1px 5px}
.thumb{position:relative}
.xmark{position:absolute;top:4px;right:6px;font-size:1.6rem;font-weight:700;color:var(--bad);line-height:1}
.cand.c-reject .thumb img{opacity:.55;filter:grayscale(.6)}
.cand.c-reject{border:2px solid var(--bad)}
.hlimg{position:relative;display:block}.hlimg.rej img{opacity:.55;filter:grayscale(.6);outline:2px solid var(--bad)}
.twov{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.lvinline{font-size:.82rem;color:var(--muted)}
.dabs{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;margin-top:12px;padding:10px;border:1px solid var(--line);background:var(--bg)}
.dabs.none{display:block}
.dabs img{max-height:175px;width:auto;background:#fff}
.dv-conflict{border:2px solid var(--bad)}
.dlab{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--accent)}
.judg{margin:6px 0;padding-left:18px;font-size:.85rem}.dbody p{margin:4px 0;font-size:.85rem}
.sub{font-family:var(--body);font-size:1rem;margin-top:16px}
.sibs{display:grid;gap:10px}.sib p{margin:4px 0}
.sibrow{display:flex;flex-wrap:wrap;gap:8px}
.sibrow figure{margin:0;background:#fff;border:1px solid var(--line);padding:4px;width:110px;text-align:center}
.sibrow img{max-height:140px;max-width:100%}
.sibrow figcaption{font-size:.7rem;color:#555}
@media (max-width:560px){.product header{flex-direction:column}h1{font-size:1.7rem}}
"""
JS = """
const f=['f-cls','f-kind','f-group'].map(id=>document.getElementById(id));
function apply(){const [c,k,g]=f.map(x=>x.value);let n=0;document.querySelectorAll('.product').forEach(p=>{const ok=(!c||p.dataset.cls===c)&&(!k||p.dataset.kind===k)&&(!g||p.dataset.group===g);p.hidden=!ok;if(ok)n++});document.getElementById('f-count').textContent=n+' shown'}
f.forEach(x=>x.addEventListener('change',apply));apply();
"""
page = f"""<title>Photo pilot review</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono&family=Source+Sans+3:wght@400;600;700&display=swap">
<style>{CSS}</style>
<main>{body}</main>
<script>{JS}</script>"""
open(OUT, "w").write(page)
print(OUT, round(len(page) / 1e6, 2), "MB")
