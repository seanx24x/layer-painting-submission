#!/usr/bin/env python3
"""Extract official Vallejo Model Color and Game Color charts.

Requires pdfplumber, pypdfium2, Pillow. Optional --model-pdf / --game-pdf permit
local sources. Hashes pin chart editions; review layout before updating them.
"""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from statistics import median
from urllib.request import urlopen

import pdfplumber
import pypdfium2

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    'model': ('https://acrylicosvallejo.com/wp-content/uploads/2024/03/CC329-R00-Model-Color-NewIC.pdf',
        '5e226eb3b27c02fdc5e09dabe24da0d6e04e53cf66fe4de29c386351e4269abb'),
    'game': ('https://acrylicosvallejo.com/wp-content/uploads/2024/02/CC266-Game_Color-NewIC.pdf',
        'abc91b1bf56805f99f076ae4874a018bfc9e04a9fe5eef508a931ba505b40422'),
}


def sample(image, box, scale=3):
    x0, y0, x1, y1 = box
    dx, dy = (x1-x0)/4, (y1-y0)/4
    pixels = list(image.crop(tuple(round(v*scale) for v in
        (x0+dx, y0+dy, x1-dx, y1-dy))).convert('RGB').getdata())
    return '#' + ''.join(f'{round(median(p[c] for p in pixels)):02X}' for c in range(3))


def extract(data, family):
    source, expected_hash = SOURCES[family]
    assert hashlib.sha256(data).hexdigest() == expected_hash, 'Source changed; review before importing.'
    rendered = pypdfium2.PdfDocument(data)
    image = rendered[0].render(scale=3).to_pil()
    rows = {}
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        page = pdf.pages[0]
        for rect in page.rects:
            if family == 'model':
                is_swatch = 36.5 < rect['width'] < 36.7 and 22.6 < rect['height'] < 22.8 \
                    and (415 < rect['x0'] < 810 or 1660 < rect['x0'] < 2100)
            else:
                is_swatch = 40.25 < rect['width'] < 40.4 and 24 < rect['height'] < 24.2 \
                    and (415 < rect['x0'] < 810 or 1660 < rect['x0'] < 2070)
            if not is_swatch:
                continue
            text = page.crop((rect['x0']-.5, rect['bottom'], rect['x1']+1,
                rect['bottom']+30)).extract_text(x_tolerance=.5, y_tolerance=.5) or ''
            lines = text.splitlines()
            match = re.search(r'7[023]\.\d{3}', lines[0] if lines else '')
            if not match:
                continue
            code = match[0]
            if family == 'model':
                # Code, display position, English name, Spanish name are separate lines.
                assert len(lines) >= 4 and lines[1].isdigit(), (code, lines)
                name = lines[2]
                position = int(lines[1])
                range_name = 'Model Color'
                finish = 'metallic' if position >= 195 else 'gloss' if code == '70.861' \
                    else None if code in ('70.828', '70.939') else 'matte'
                edition = 'CC329 R00, March 2024'
            else:
                assert len(lines) >= 2, (code, lines)
                name = lines[1]
                if code.startswith('73.'):
                    range_name, finish = 'Game Color Wash', None
                elif rect['x0'] < 810:
                    range_name, finish = 'Game Color Fluo', None
                elif rect['top'] > 490:
                    range_name, finish = 'Game Color Ink', None
                elif rect['top'] > 430:
                    range_name, finish = 'Game Color Metallic', 'metallic'
                else:
                    range_name, finish = 'Game Color', 'matte'
                edition = 'CC266 Rev01, February 2024'
            box = [rect[k] for k in ('x0', 'top', 'x1', 'bottom')]
            row = {
                'id': 'vallejo-'+code.replace('.', ''), 'brand': 'Vallejo',
                'range': range_name, 'name': name, 'code': code, 'finish': finish,
                'swatch': {'hex': sample(image, box), 'kind': 'sampled-manufacturer-chart',
                    'sourceUrl': source+'#page=1',
                    'note': f'Vallejo {edition}, PDF page 1. Median RGB of the central 50% '
                    'of the printed swatch, rendered by PDFium at 3x. Approximate digital reference, '
                    'not a calibrated physical paint measurement. Metallic gradients, transparent '
                    'inks, washes and fluorescent paint cannot be represented fully by one RGB value.'},
                'sourceUrl': source+'#page=1', 'verifiedAt': '2026-10-07',
            }
            assert code not in rows or rows[code] == row, f'Conflicting duplicate {code}'
            rows[code] = row
    assert len(rows) == (204 if family == 'model' else 117), (family, len(rows))
    return list(rows.values())


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model-pdf', type=Path)
    parser.add_argument('--game-pdf', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT/'src/data/paints/vallejo.json')
    args = parser.parse_args()
    rows = []
    for family in ('model', 'game'):
        path = getattr(args, family+'_pdf')
        data = path.read_bytes() if path else urlopen(SOURCES[family][0], timeout=60).read()
        rows.extend(extract(data, family))
    assert len({r['id'] for r in rows}) == len(rows)
    rows.sort(key=lambda row: row['code'])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
    print(f'Imported {len(rows)} Vallejo chart entries to {args.output}')
