"""Export the canonical write-up as one page. Requires ReportLab, fontTools and pypdf."""
from pathlib import Path
import html
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/submission-writeup.md"
OUTPUT = ROOT / "output/pdf/layer-submission-writeup.pdf"
FONTS = ROOT / "artifacts/final-review/fonts"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
FONTS.mkdir(parents=True, exist_ok=True)
font_source = ROOT / "node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2"
for name, weight in (("Layer", 400), ("LayerMedium", 550)):
    path = FONTS / f"{name}.ttf"
    if not path.exists():
        from fontTools.ttLib import TTFont as FontToolsFont
        from fontTools.varLib.instancer import instantiateVariableFont
        font = FontToolsFont(font_source)
        font.flavor = None
        font = instantiateVariableFont(font, {"wght": weight}, inplace=True)
        for record in font["name"].names:
            if record.nameID in (1, 4, 6):
                font["name"].setName(name, record.nameID, record.platformID, record.platEncID, record.langID)
        font.save(path)
    pdfmetrics.registerFont(TTFont(name, str(path)))
pdfmetrics.registerFontFamily("Layer", normal="Layer", bold="LayerMedium", italic="Layer", boldItalic="LayerMedium")


def inline(text):
    text = html.escape(text).replace("\n", " ")
    text = re.sub(r"\[([^]]+)\]\((https?://[^)]+)\)",
                  r'<a href="\2" color="#25469e"><u>\1</u></a>', text)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)


body = ParagraphStyle("Body", fontName="Layer", fontSize=10.4, leading=14.8,
                      textColor=colors.HexColor("#202328"), spaceAfter=12)
quiet = ParagraphStyle("Quiet", parent=body, fontSize=9, leading=12,
                       textColor=colors.HexColor("#626b78"), spaceAfter=0)
title = ParagraphStyle("Title", parent=body, fontSize=34, leading=38,
                       fontName="LayerMedium", spaceAfter=8)
blocks = SOURCE.read_text().strip().split("\n\n")
heading = blocks.pop(0).removeprefix("# ")
byline = blocks.pop(0)
story = [Paragraph(inline(heading.lower() + "."), title),
         Paragraph(inline(byline), quiet), Spacer(1, 17),
         HRFlowable(width="100%", thickness=.6, color=colors.HexColor("#dbe0e6")),
         Spacer(1, 18)]
for block in blocks:
    story.append(Paragraph(inline(block), body))


def footer(canvas, doc):
    canvas.setFont("Layer", 8)
    canvas.setFillColor(colors.HexColor("#626b78"))
    canvas.drawString(42, 25, "Sean Lynch")
    canvas.drawRightString(A4[0] - 42, 25, "Layer · 1")


SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=42, rightMargin=42,
                  topMargin=35, bottomMargin=40,
                  title="Layer: miniature painting companion", author="Sean Lynch").build(
                      story, onFirstPage=footer, onLaterPages=footer)
reader = PdfReader(OUTPUT)
if len(reader.pages) != 1:
    raise SystemExit(f"Expected one page, rendered {len(reader.pages)}; revise copy or spacing.")
assert "Vercel AI Gateway" in reader.pages[0].extract_text()
assert "Foundry" in reader.pages[0].extract_text()
print(f"Created {OUTPUT} (1 page)")
