#!/usr/bin/env python3
"""Write the Letter-size Short-hand Gospel PDF from content/short-hand-gospel.json."""

import json
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "content/short-hand-gospel.json").read_text(encoding="utf-8"))
OUT = ROOT / "assets/short-hand-gospel.pdf"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BRAND = (212, 42, 27)
BRAND_TEXT = (184, 31, 18)
INK = (51, 45, 38)
CREAM = (247, 244, 238)


class Guide(FPDF):
    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-16)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*INK)
        self.multi_cell(0, 4, DATA["publisher"], align="C")


def write_pdf():
    pdf = Guide(format="Letter", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("DejaVu", "", FONT)
    pdf.add_font("DejaVu", "B", FONT_BOLD)
    pdf.set_title(DATA["title"])
    pdf.set_author("Pentecostal Church of God")

    pdf.add_page()
    pdf.set_fill_color(*BRAND)
    pdf.rect(0, 0, 216, 8, "F")
    pdf.set_y(48)
    pdf.set_text_color(*BRAND)
    pdf.set_font("DejaVu", "B", 28)
    pdf.multi_cell(0, 12, DATA["title"], align="C")
    pdf.ln(4)
    pdf.set_text_color(*BRAND_TEXT)
    pdf.set_font("DejaVu", "", 16)
    pdf.multi_cell(0, 8, DATA["subtitle"], align="C")
    pdf.ln(16)
    pdf.set_text_color(*INK)
    pdf.set_font("DejaVu", "", 11)
    pdf.multi_cell(0, 6, DATA["publisher"], align="C")

    pdf.add_page()
    pdf.set_text_color(*BRAND)
    pdf.set_font("DejaVu", "B", 18)
    pdf.multi_cell(0, 8, "How to use")
    pdf.ln(4)
    pdf.set_text_color(*INK)
    pdf.set_font("DejaVu", "", 12)
    for item in DATA["howTo"]:
        pdf.multi_cell(0, 7, f"•  {item}")
        pdf.ln(2)

    for number, step in enumerate(DATA["steps"], 1):
        pdf.add_page()
        pdf.set_text_color(*BRAND)
        pdf.set_font("DejaVu", "B", 16)
        pdf.multi_cell(0, 8, f"{number}. {step['title']}")
        pdf.ln(3)
        pdf.set_text_color(*BRAND)
        pdf.set_font("DejaVu", "B", 11)
        pdf.cell(0, 6, "Say this")
        pdf.ln(8)
        pdf.set_fill_color(*CREAM)
        pdf.set_text_color(*INK)
        pdf.set_font("DejaVu", "", 12)
        pdf.set_x(20)
        pdf.multi_cell(170, 7, step["say"], fill=True)
        pdf.ln(6)
        pause = DATA["pauseLast"] if number == len(DATA["steps"]) else DATA["pause"]
        pdf.set_text_color(*BRAND_TEXT)
        pdf.set_font("DejaVu", "B", 12)
        pdf.multi_cell(0, 7, pause)

    pdf.add_page()
    pdf.set_text_color(*BRAND)
    pdf.set_font("DejaVu", "B", 18)
    pdf.multi_cell(0, 8, "Notes")
    pdf.ln(8)
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(0.3)
    y = pdf.get_y()
    while y < 250:
        pdf.line(18, y, 198, y)
        y += 12

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))


if __name__ == "__main__":
    write_pdf()
