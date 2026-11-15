#!/usr/bin/env python3
"""Rebuild a site-styled Short-hand Gospel PDF from content/short-hand-gospel.json.

assets/short-hand-gospel.pdf and assets/resources/shorthand-gospel.pdf are
copies of the published pcgmission.org PDF, so the wording matches that file.
This script writes the same words with the site colors. It does not replace
those copies unless you pass --write.
"""

import argparse
import json
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "content/short-hand-gospel.json").read_text(encoding="utf-8"))
OUTS = (
    ROOT / "assets/short-hand-gospel.pdf",
    ROOT / "assets/resources/shorthand-gospel.pdf",
)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BRAND = (212, 42, 27)
BRAND_TEXT = (184, 31, 18)
INK = (51, 45, 38)


class Guide(FPDF):
    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-16)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*INK)
        self.multi_cell(0, 4, DATA["publisher"], align="C")


def write_pdf():
    mission = DATA["mission"]
    pdf = Guide(format="Letter", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("DejaVu", "", FONT)
    pdf.add_font("DejaVu", "B", FONT_BOLD)
    pdf.set_title(DATA["title"])
    pdf.set_author("Pentecostal Church of God")

    pdf.add_page()
    pdf.set_fill_color(*BRAND)
    pdf.rect(0, 0, 216, 6, "F")
    pdf.set_y(22)
    pdf.set_text_color(*INK)
    pdf.set_font("DejaVu", "B", 28)
    pdf.multi_cell(0, 12, DATA["title"])
    pdf.ln(1)
    pdf.set_text_color(*BRAND)
    pdf.set_font("DejaVu", "B", 14)
    pdf.multi_cell(0, 8, DATA["subtitle"])
    pdf.ln(6)
    pdf.set_text_color(*INK)
    pdf.set_font("DejaVu", "B", 14)
    pdf.multi_cell(0, 8, DATA["whyTitle"])
    pdf.set_font("DejaVu", "", 11)
    pdf.multi_cell(0, 6, DATA["why"])
    pdf.ln(3)
    pdf.multi_cell(0, 6, mission["line"])
    pdf.ln(4)
    pdf.set_font("DejaVu", "B", 14)
    pdf.multi_cell(0, 8, DATA["howTitle"])
    pdf.set_font("DejaVu", "", 11)
    pdf.multi_cell(0, 6, DATA["how"])
    pdf.ln(4)
    pdf.set_font("DejaVu", "B", 14)
    pdf.multi_cell(0, 8, DATA["stepsTitle"])
    pdf.set_font("DejaVu", "", 12)
    for number, step in enumerate(mission["steps"], 1):
        pdf.multi_cell(0, 7, f"{number}. {step['title']}")
    pdf.ln(6)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(89, 85, 79)
    pdf.multi_cell(0, 5, DATA["publisher"])

    pause_after = set(mission["pauseAfter"])
    last = len(mission["steps"])
    for number, step in enumerate(mission["steps"], 1):
        pdf.add_page()
        pdf.set_text_color(*INK)
        pdf.set_font("DejaVu", "B", 16)
        pdf.multi_cell(0, 8, f"{number}. {step['title']}")
        pdf.ln(2)
        pdf.set_text_color(*BRAND)
        pdf.set_font("DejaVu", "B", 11)
        pdf.cell(0, 6, DATA["sayLabel"])
        pdf.ln(8)
        pdf.set_text_color(*INK)
        pdf.set_font("DejaVu", "", 12)
        pdf.multi_cell(0, 7, step["say"])
        if number in pause_after:
            pdf.ln(4)
            pdf.set_text_color(*BRAND_TEXT)
            pdf.set_font("DejaVu", "B", 12)
            pdf.multi_cell(0, 7, DATA["pause"])
        if number == last:
            pdf.set_text_color(*BRAND_TEXT)
            pdf.set_font("DejaVu", "B", 12)
            for line in mission["closing"]:
                pdf.multi_cell(0, 7, line)

    pdf.add_page()
    pdf.set_text_color(*INK)
    pdf.set_font("DejaVu", "B", 22)
    pdf.multi_cell(0, 10, DATA["notesTitle"])
    pdf.ln(6)
    pdf.set_draw_color(180, 170, 155)
    pdf.set_line_width(0.2)
    y = pdf.get_y()
    while y < 250:
        pdf.line(18, y, 198, y)
        y += 12

    for path in OUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        pdf.output(str(path))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--write",
        action="store_true",
        help="Replace the committed PDFs with a site-styled rebuild of the same wording.",
    )
    args = parser.parse_args()
    if not args.write:
        raise SystemExit(
            "assets/short-hand-gospel.pdf is a copy of the published pcgmission.org PDF. "
            "Pass --write to rebuild a site-styled copy with the same wording."
        )
    write_pdf()
