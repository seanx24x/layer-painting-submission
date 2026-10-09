#!/usr/bin/env python3
"""Reproduce the Citadel/Warhammer Colour catalogue from an official PDF.

Requires Python 3.10+, pdfplumber, Pillow, and Poppler's pdftoppm. No application
dependencies or network services are needed. Run with --help for inputs.
"""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import shutil
import statistics
import subprocess
import tempfile
import urllib.request

import pdfplumber
from PIL import Image

SOURCE_URL = "https://assets.warhammer-community.com/warhammer_christmas_gift_guide_2025-ab0gbw34xo-t3umfix5so.pdf"
SOURCE_SHA256 = "e625d1c0b9fac1dd29ada5b50e06e478d17fc7b924ffe7e4f2d658d4125682a9"
VERIFIED_AT = "2026-10-07"
ROOT = Path(__file__).resolve().parents[2]
EXPECTED_COUNTS = {"Base": 57, "Layer": 93, "Shade": 19, "Contrast": 61, "Dry": 24, "Technical": 21}

# The PDF contains overlapping original/corrected text layers. Resolve only
# these inspected extraction artefacts against the visible manufacturer label.
LABEL_CORRECTIONS = {
    "VALHALLAN VALHALLAN B B L L IZ IZ Z A A R R D D": "VALHALLAN BLIZZARD",
    "TTEESSSEERRAACCTT GLOW": "TESSERACT GLOW",
    "MMAAGGOOSS PURPLE": "MAGOS PURPLE",
    "LLUUXXIIOONN PURPLE": "LUXION PURPLE",
    "LLEEVVIIAATTHHAANN PURPLE": "LEVIATHAN PURPLE",
    "DDEEAATTHH GUARD GREEN": "DEATH GUARD GREEN",
    "TA'AUU L LIIGGHHTT OCHRE": "TAU LIGHT OCHRE",
    "KKNNIIGGHHTT- QUESTOR FLESH": "KNIGHT-QUESTOR FLESH",
    "CCAASSSAANNDDOORRAA YELLOW": "CASANDORA YELLOW",
    "AADDMMIINNIISSTTRRAATTUUMM GREY": "ADMINISTRATUM GREY",
    "AGRAX EEAARRTTHHSSHHAADDEE": "AGRAX EARTHSHADE",
    "SOULBLIGHT GGRREEYY": "SOULBLIGHT GREY",
}
NO_COLOUR = {"Stormshield", "'Ardcoat", "Lahmian Medium", "Contrast Medium"}
REQUIRED_PAINTS = {
    ("Base", "Macragge Blue"), ("Layer", "Calgar Blue"), ("Layer", "Blue Horror"),
    ("Base", "Abaddon Black"), ("Shade", "Nuln Oil"), ("Layer", "Altdorf Guard Blue"),
    ("Layer", "Fenrisian Grey"), ("Layer", "Warpstone Glow"),
    ("Contrast", "Dark Angels Green"), ("Layer", "Moot Green"),
}


def display_name(text):
    text = re.sub(r"\s+", " ", text.replace("™", "").replace("’", "'")).strip()
    text = LABEL_CORRECTIONS.get(text, text)
    if text == "XV-88":
        return text
    if text == "ARDCOAT":
        return "'Ardcoat"
    name = text.title()
    name = re.sub(r"(?<=[a-z])'S\b", "'s", name)
    return re.sub(r"\b(Of|For|The)\b", lambda match: match.group(0).lower() if match.start() else match.group(0), name)


def chart_cells(page, page_number):
    groups = []
    for rectangle in page.rects:
        if not (54 <= rectangle["width"] <= 59 and 27 <= rectangle["height"] <= 30):
            continue
        center_x = (rectangle["x0"] + rectangle["x1"]) / 2
        center_y = (rectangle["top"] + rectangle["bottom"]) / 2
        group = next((entry for entry in groups if abs(entry[0] - center_x) < 3 and abs(entry[1] - center_y) < 3), None)
        if group:
            group[2].append(rectangle)
        else:
            groups.append([center_x, center_y, [rectangle]])

    for _, _, rectangles in groups:
        box = (
            min(r["x0"] for r in rectangles), min(r["top"] for r in rectangles),
            max(r["x1"] for r in rectangles), max(r["bottom"] for r in rectangles),
        )
        text = page.crop(box).extract_text(x_tolerance=1, y_tolerance=2) or ""
        if page_number == 22:
            paint_range = "Contrast" if box[0] > 600 else "Dry" if box[1] > 210 else "Technical"
        else:
            paint_range = "Layer" if box[0] > 600 else "Shade" if box[1] > 300 else "Base"
        yield display_name(text), paint_range, box


def sample_swatch(image, page, box):
    # A small lower-centre interior patch avoids labels, checkboxes and borders.
    # RGB is sampled after Poppler colour management, never guessed from names.
    left, top, right, bottom = box
    width, height = right - left, bottom - top
    scale_x, scale_y = image.width / page.width, image.height / page.height
    sample_box = (left + width * .45, top + height * .91, left + width * .55, top + height * .94)
    assert not any(
        char["x0"] < sample_box[2] and char["x1"] > sample_box[0]
        and char["top"] < sample_box[3] and char["bottom"] > sample_box[1]
        for char in page.chars
    ), "Sample overlaps a text label; review sampling geometry."
    region = image.crop((
        round(sample_box[0] * scale_x), round(sample_box[1] * scale_y),
        round(sample_box[2] * scale_x), round(sample_box[3] * scale_y),
    ))
    pixels = [region.getpixel((x, y)) for x in range(region.width) for y in range(region.height)]
    rgb = [round(statistics.median(pixel[channel] for pixel in pixels)) for channel in range(3)]
    return "#" + "".join(f"{channel:02X}" for channel in rgb)


def import_catalogue(pdf_path, workdir):
    digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError("Official source differs from the reviewed edition; inspect it before updating this importer.")
    if not shutil.which("pdftoppm"):
        raise RuntimeError("pdftoppm is required; set PATH to an existing Poppler installation.")
    prefix = workdir / "citadel-chart"
    subprocess.run(["pdftoppm", "-f", "22", "-l", "23", "-r", "144", "-png", str(pdf_path), str(prefix)], check=True)

    entries = []
    with pdfplumber.open(pdf_path) as document:
        for page_number in (22, 23):
            page = document.pages[page_number - 1].dedupe_chars(tolerance=1)
            image = Image.open(workdir / f"citadel-chart-{page_number}.png").convert("RGB")
            for name, paint_range, box in chart_cells(page, page_number):
                source_url = f"{SOURCE_URL}#page={page_number}"
                swatch = None if name in NO_COLOUR else sample_swatch(image, page, box)
                bounds = ", ".join(f"{value:.2f}" for value in box)
                note = (
                    "No colour value: the manufacturer's grey chart placeholder denotes a varnish or medium."
                    if swatch is None else
                    f"Sampled from the 2025 manufacturer chart, PDF page {page_number}, cell ({bounds}) pt; "
                    "median RGB of lower-centre interior (x45-55%, y91-94%) rendered by Poppler at 144 dpi. "
                    "Chart illustration, including gradients; not a measured physical paint colour or a published RGB specification."
                )
                slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
                entries.append({
                    "id": f"citadel-{paint_range.lower()}-{slug}",
                    "brand": "Warhammer Colour", "range": paint_range, "name": name,
                    "code": None, "finish": None,
                    "swatch": {
                        "hex": swatch,
                        "kind": "sampled-manufacturer-chart" if swatch else "unverified",
                        "sourceUrl": source_url, "note": note,
                    },
                    "sourceUrl": source_url, "verifiedAt": VERIFIED_AT,
                })

    counts = Counter(entry["range"] for entry in entries)
    assert counts == EXPECTED_COUNTS, f"Unexpected chart coverage: {counts}"
    assert len({entry["id"] for entry in entries}) == len(entries), "Duplicate paint IDs"
    assert REQUIRED_PAINTS <= {(entry["range"], entry["name"]) for entry in entries}, "A guide paint is missing"
    assert sum(entry["swatch"]["hex"] is None for entry in entries) == 4, "Unexpected empty swatches"
    assert not any(re.search(r"([A-Za-z])\1([A-Za-z])\2([A-Za-z])\3", entry["name"]) for entry in entries), "Possible doubled PDF text"
    # The paint-colour catalogue excludes colourless varnishes and mediums.
    entries = [entry for entry in entries if entry["swatch"]["hex"] is not None]
    order = list(EXPECTED_COUNTS)
    return sorted(entries, key=lambda entry: (order.index(entry["range"]), entry["name"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, help="Previously downloaded official PDF; otherwise downloads the pinned public URL.")
    parser.add_argument("--output", type=Path, default=ROOT / "src/data/paints/citadel.json")
    parser.add_argument("--check", action="store_true", help="Verify the committed catalogue is reproducible without writing it.")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="layer-citadel-") as temporary:
        workdir = Path(temporary)
        pdf_path = args.pdf or workdir / "official-chart.pdf"
        if args.pdf is None:
            urllib.request.urlretrieve(SOURCE_URL, pdf_path)
        entries = import_catalogue(pdf_path, workdir)
        encoded = json.dumps(entries, ensure_ascii=False, indent=2) + "\n"
        if args.check:
            assert args.output.read_text() == encoded, "Catalogue differs from the source import"
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(encoded)
        print(json.dumps({"entries": len(entries), "ranges": dict(Counter(entry["range"] for entry in entries)), "swatches": sum(entry["swatch"]["hex"] is not None for entry in entries), "sourceSha256": SOURCE_SHA256, "check": args.check}))


if __name__ == "__main__":
    main()
