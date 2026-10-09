#!/usr/bin/env python3
"""Import official Fanatic products and sample the manufacturer's labelled chart.

Requires pdfplumber, pypdfium2 and Pillow. No product photos are sampled.
Run with --verified-at YYYY-MM-DD; --refresh bypasses the temporary download cache.
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

SHOP = "https://thearmypainter.com"
CHART = "https://cdn.shopify.com/s/files/1/0781/9850/5747/files/A3_All_Warpaints_Fanatic_Poster.pdf?v=1713535843"
CHART_SHA256 = "3bc9ecd17c48051bfd8a5321bf28ec40f23443f09d417eed186341be9f58e02c"
ROOT = Path(__file__).resolve().parents[2]


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def download(url, cache, refresh):
    target = cache / hashlib.sha256(url.encode()).hexdigest()
    if refresh or not target.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "LayerPaintCatalogue/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())
    return target


def chart_swatches(path):
    if hashlib.sha256(path.read_bytes()).hexdigest() != CHART_SHA256:
        raise ValueError("Manufacturer chart changed; review its labels and sampling geometry before importing.")
    document = pypdfium2.PdfDocument(str(path))
    image = document[0].render(scale=2).to_pil().convert("RGB")
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words()
        result = {}
        # Visually checked 18-column, 12-row honeycomb chart. Every cell is
        # matched by its extracted label, never by product-list order.
        for row in range(12):
            cy = 124.30 + 52.04 * row
            for column in range(18):
                cx = 46.09 + 62.787 * column + (31.3935 if row % 2 else 0)
                cell = [word for word in words
                        if abs((word["x0"] + word["x1"]) / 2 - cx) < 31
                        and abs((word["top"] + word["bottom"]) / 2 - cy) < 25]
                label = " ".join(word["text"] for word in sorted(
                    cell, key=lambda word: (round(word["top"] / 5), word["x0"])))
                # A 7x7 patch near the top of the hex avoids the central label.
                x, y = round(cx * 2), round((cy - 24) * 2)
                pixels = [image.getpixel((px, py)) for py in range(y - 3, y + 4) for px in range(x - 3, x + 4)]
                rgb = [round(statistics.median(pixel[channel] for pixel in pixels)) for channel in range(3)]
                result[normalize(label)] = {"hex": "#%02X%02X%02X" % tuple(rgb), "label": label}
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
        url = f"{SHOP}/collections/warpaints-fanatic/products.json?limit=250&page={page}"
        entries = json.loads(download(url, args.cache_dir, args.refresh).read_text())["products"]
        products.update((product["id"], product) for product in entries)
        if len(entries) < 250:
            break
    else:
        raise ValueError("Unexpected pagination; refusing a potentially partial catalogue.")

    records = []
    for product in products.values():
        match = re.fullmatch(r"Warpaints Fanatic(?: (Metallic|Wash|Effects))?:\s*(.+)", product["title"])
        code = product["variants"][0]["sku"]
        if not match or not re.fullmatch(r"WP3\d{3}P", code):
            continue
        subtype, name = match.groups()
        if re.search(r"Medium|Varnish|Retarder|Stabilizer|Primer", name):
            continue
        key = normalize(name)
        # The official shop now uses one L; the 2024 official poster uses two.
        if code == "WP3107P" and key == "violentvermilion":
            key = "violentvermillion"
        sampled = swatches.get(key)
        source = f"{SHOP}/products/{product['handle']}"
        note = "Median RGB from a label-free 7x7 patch in the official PDF rendered at 2x with PDFium. Illustrative chart colour, not a calibrated paint measurement."
        if subtype in {"Metallic", "Wash", "Effects"}:
            note += " A flat sample cannot describe sheen, transparency, texture or the chart's gradient."
        if code == "WP3107P":
            note += " Official chart spelling: Violent Vermillion; current shop spelling: Violent Vermilion."
        records.append({
            "id": "the-army-painter-" + code.lower(),
            "brand": "The Army Painter",
            "range": "Warpaints Fanatic",
            "name": name,
            "code": code,
            "finish": subtype.lower() if subtype else None,
            "swatch": {"hex": sampled["hex"] if sampled else None,
                       "kind": "sampled-manufacturer-chart" if sampled else "unverified",
                       "sourceUrl": CHART if sampled else source,
                       "note": note if sampled else "No matching swatch was verified in the official chart; colour intentionally omitted."},
            "sourceUrl": source,
            "verifiedAt": args.verified_at,
        })
    records.sort(key=lambda paint: paint["code"])
    if len({paint["id"] for paint in records}) != len(records):
        raise ValueError("Duplicate manufacturer SKU")
    output = ROOT / "src/data/paints/army-painter.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"paints": len(records), "swatches": sum(p["swatch"]["hex"] is not None for p in records), "output": str(output)}))


if __name__ == "__main__":
    main()
