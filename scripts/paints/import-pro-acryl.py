#!/usr/bin/env python3
"""Import official Pro Acryl products and code-matched manufacturer-chart colours.

Requires pdfplumber, pypdfium2 and Pillow. The PDF is linked by Monument Hobbies
at https://monumenthobbies.com/pages/color-brochure (PRO Acryl Paint List).
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import statistics
import tempfile
import urllib.request

import pdfplumber
import pypdfium2

SHOP = "https://monumenthobbies.com"
CHART = "https://drive.google.com/uc?export=download&id=1s37xlpZDHq1IGg4wyGyhsNbBSnrLqTzZ"
CHART_SHA256 = "bd4b7071d50e51ee60620dfa7635c91ff3d427bbe1d52d5094bb54d90aaa68e6"
ROOT = Path(__file__).resolve().parents[2]


def download(url, cache, refresh):
    target = cache / hashlib.sha256(url.encode()).hexdigest()
    if refresh or not target.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "LayerPaintCatalogue/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())
    return target


def chart_swatches(path):
    if hashlib.sha256(path.read_bytes()).hexdigest() != CHART_SHA256:
        raise ValueError("Manufacturer chart changed; review its code labels and geometry before importing.")
    document = pypdfium2.PdfDocument(str(path))
    image = document[0].render(scale=2).to_pil().convert("RGB")
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        # Printed text has overlapping stroke/fill copies; deduplicate glyphs.
        words = page.dedupe_chars(tolerance=1).extract_words()
        codes = [word for word in words if re.fullmatch(r"\d{3}|[SF]\d{2}", word["text"])]
        circles = [curve for curve in page.curves if curve.get("fill")
                   and 104 < curve["width"] < 105 and 104 < curve["height"] < 105]
        result = {}
        for word in codes:
            label_x = (word["x0"] + word["x1"]) / 2
            label_y = (word["top"] + word["bottom"]) / 2
            containing = [circle for circle in circles
                          if circle["x0"] < label_x < circle["x1"]
                          and circle["top"] < label_y < circle["bottom"]]
            if not containing:
                continue
            # The first 1-Step set has coincident colour and border circles.
            # Accept those only when all centres agree within one PDF point.
            centres = [((c["x0"] + c["x1"]) / 2, (c["top"] + c["bottom"]) / 2) for c in containing]
            if any(max(c[axis] for c in centres) - min(c[axis] for c in centres) > 1 for axis in (0, 1)):
                continue
            circle = containing[0]
            # Visually checked interior, away from name/code text. Four cells
            # have lettering/decorative marks in the usual upper-left patch;
            # their left-side patches were checked to have zero RGB variation.
            cx, cy = (circle["x0"] + circle["x1"]) / 2, (circle["top"] + circle["bottom"]) / 2
            dx, dy = (-43, 0) if word["text"] in {"S17", "200", "201", "202"} else (-35, -25)
            x, y = round((cx + dx) * 2), round((cy + dy) * 2)
            pixels = [image.getpixel((px, py)) for py in range(y - 3, y + 4) for px in range(x - 3, x + 4)]
            rgb = [round(statistics.median(pixel[channel] for pixel in pixels)) for channel in range(3)]
            result[word["text"]] = "#%02X%02X%02X" % tuple(rgb)
    document.close()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verified-at", required=True)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--cache-dir", type=Path, default=Path(tempfile.gettempdir()) / "layer-manufacturer-paints")
    args = parser.parse_args()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.verified_at):
        parser.error("--verified-at must be YYYY-MM-DD")
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    swatches = chart_swatches(download(CHART, args.cache_dir, args.refresh))
    products = {}
    for page in range(1, 21):
        url = f"{SHOP}/collections/pro-acryl-paints/products.json?limit=250&page={page}"
        entries = json.loads(download(url, args.cache_dir, args.refresh).read_text())["products"]
        products.update((product["id"], product) for product in entries)
        if len(entries) < 250:
            break
    else:
        raise ValueError("Unexpected pagination; refusing a potentially partial catalogue.")

    records = []
    for product in products.values():
        code = product["variants"][0]["sku"]
        if product["product_type"] != "Paint Singles" or not re.fullmatch(r"MPA-(?:\d{3}|[SF]\d{2})", code):
            continue
        if "Medium" in product["title"]:
            continue
        short_code = code[4:]
        title = product["title"]
        name = re.sub(r"^PRO Acryl 1-Step \d{3}\s*-\s*", "", title, flags=re.I)
        name = re.sub(r"^(?:\d{3}|[SF]\d{2})\s*-\s*(?:Pro Acryl\s*)?", "", name, flags=re.I)
        tags = {tag.lower() for tag in product["tags"]}
        paint_range = "Pro Acryl"
        if "signatureseries" in tags:
            paint_range = "Pro Acryl Signature Series"
        elif "1-step paints" in tags:
            paint_range = "Pro Acryl 1-Step"
        elif "fluorescents" in tags:
            paint_range = "Pro Acryl Fluorescents"
        elif "pro acryl washes" in tags or "washes" in tags:
            paint_range = "Pro Acryl Washes"
        finish = None
        if "Satin" in title:
            finish = "satin"
        elif "metallics" in tags:
            finish = "metallic"
        elif re.search(r"matte finish", product["body_html"], re.I):
            finish = "matte"
        sampled = swatches.get(short_code)
        source = f"{SHOP}/products/{product['handle']}"
        records.append({
            "id": "monument-hobbies-" + code.lower(),
            "brand": "Monument Hobbies",
            "range": paint_range,
            "name": name,
            "code": code,
            "finish": finish,
            "swatch": {"hex": sampled,
                       "kind": "sampled-manufacturer-chart" if sampled else "unverified",
                       "sourceUrl": CHART if sampled else source,
                       "note": "Median RGB from a label-free 7x7 patch inside the official chart circle, matched by printed paint code and rendered at 2x with PDFium. Illustrative, not a calibrated paint measurement; does not reproduce sheen, opacity or fluorescence." if sampled else "No code-matched swatch was verified in the official chart; colour intentionally omitted."},
            "sourceUrl": source,
            "verifiedAt": args.verified_at,
        })
    records.sort(key=lambda paint: paint["code"])
    if len({paint["id"] for paint in records}) != len(records):
        raise ValueError("Duplicate manufacturer SKU")
    output = ROOT / "src/data/paints/pro-acryl.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"paints": len(records), "swatches": sum(p["swatch"]["hex"] is not None for p in records), "output": str(output)}))


if __name__ == "__main__":
    main()
