#!/usr/bin/env python3
"""Extract the official AK 3GEN 2024 chart. Requires pdfplumber, pypdfium2, Pillow.

Usage: python import-ak.py [--pdf /path/to/AK_ACRYLICS_2024_DOSSIER.pdf]
The source is hash-pinned: a revised manufacturer chart requires layout review.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
from statistics import median
from urllib.request import urlopen

import pdfplumber
import pypdfium2

SOURCE = 'https://ak-masters.com//app/pdf/AK_ACRYLICS_2024_DOSSIER.pdf'
SHA256 = '6d5b6543da46c2a03feac6244b3034549ee3825cf00cf45f1c21cde9844d27e5'
ROOT = Path(__file__).resolve().parents[2]
# These modify paint/adhesion and do not have an intrinsic paint color.
EXCLUDED = {'AK11231', 'AK11232', 'AK11233', 'AK11234', 'AK11235', 'AK11262'}


def sample(image, box, scale=3):
    x0, y0, x1, y1 = box
    dx, dy = (x1-x0)/4, (y1-y0)/4
    pixels = list(image.crop(tuple(round(v*scale) for v in
        (x0+dx, y0+dy, x1-dx, y1-dy))).convert('RGB').getdata())
    return '#' + ''.join(f'{round(median(p[c] for p in pixels)):02X}' for c in range(3))


def extract(data):
    import re
    assert hashlib.sha256(data).hexdigest() == SHA256, 'Source changed; review chart before importing.'
    rendered = pypdfium2.PdfDocument(data)
    rows = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for index in range(5, 10):
            page = pdf.pages[index]
            words = page.extract_words(x_tolerance=.8, y_tolerance=.8)
            image = rendered[index].render(scale=3).to_pil()
            headers = []
            for word in words:
                if word['text'] not in ('Name', 'Color'):
                    continue
                rectangles = [r for r in page.rects if r['x0'] <= word['x0']
                    and r['x1'] >= word['x1'] and r['top'] <= word['top']
                    and r['bottom'] >= word['bottom'] and 15 < r['height'] < 25]
                if rectangles:
                    headers.append((word['text'], rectangles[0]))
            for word in words:
                code = word['text']
                if not re.fullmatch(r'AK11\d{3}', code):
                    continue
                right = word['x0'] > 595
                columns = {t: r for t, r in headers if (r['x0'] > 595) == right
                    and r['bottom'] < word['top']}
                if set(columns) != {'Name', 'Color'}:
                    continue  # Left-hand marketing content on page 6, not the chart.
                color = columns['Color']
                cx = (color['x0'] + color['x1']) / 2
                cy = (word['top'] + word['bottom']) / 2
                cells = [r for r in page.rects if r['x0'] < cx < r['x1']
                    and r['top'] < cy < r['bottom'] and 20 < r['width'] < 60
                    and 8 < r['height'] < 20]
                if not cells:
                    # White/gradient swatches have no filled rectangle. The type
                    # cell supplies the identical row bounds; color header gives x.
                    cells = [dict(r, x0=color['x0'], x1=color['x1']) for r in page.rects
                        if 15 < r['width'] < 20 and r['top'] < cy < r['bottom']
                        and (r['x0'] > 595) == right and 8 < r['height'] < 20]
                assert len(cells) == 1, (index+1, code, len(cells))
                cell = cells[0]
                name_column = columns['Name']
                name = page.crop((name_column['x0'], cell['top'], name_column['x1'],
                    cell['bottom'])).extract_text(x_tolerance=.7, y_tolerance=.7)
                assert name, code
                if code in EXCLUDED:
                    continue
                name = ' '.join(name.split())
                number = int(code[2:])
                family = ('3GEN Air Series' if number >= 11800 else '3GEN Figure Series'
                    if number >= 11400 else '3GEN AFV Series' if number >= 11300
                    else '3GEN General Series')
                finish = 'metallic' if 11191 <= number <= 11212 else (
                    None if 11213 <= number <= 11218 or 11260 <= number <= 11263
                    or 'Fluorescent' in name else 'matte')
                box = [cell[k] for k in ('x0', 'top', 'x1', 'bottom')]
                source = f'{SOURCE}#page={index+1}'
                rows.append({
                    'id': f'ak-interactive-{code.lower()}', 'brand': 'AK Interactive',
                    'range': family, 'name': name, 'code': code, 'finish': finish,
                    'swatch': {'hex': sample(image, box), 'kind': 'sampled-manufacturer-chart',
                        'sourceUrl': source,
                        'note': 'AK 3GEN 2024 dossier, PDF page '+str(index+1)+'. '
                        'Median RGB of the central 50% of the printed swatch, rendered by PDFium at 3x. '
                        'Approximate digital reference, not a calibrated physical paint measurement; '
                        'a flat color cannot reproduce metallic or effect behavior.'},
                    'sourceUrl': source, 'verifiedAt': '2026-10-07',
                })
    assert len(rows) == 471, len(rows)
    assert len({r['id'] for r in rows}) == len(rows)
    return sorted(rows, key=lambda row: row['code'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT/'src/data/paints/ak.json')
    args = parser.parse_args()
    data = args.pdf.read_bytes() if args.pdf else urlopen(SOURCE, timeout=60).read()
    rows = extract(data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
    print(f'Imported {len(rows)} AK Interactive chart entries to {args.output}')
