"""Tables and diagrams in exam PDFs: kept in place during extraction and attached to the right question."""
from pathlib import Path

from app.pipeline.docling_ocr_extractor import (
    DoclingOcrExtractor,
    detect_page_furniture,
    rows_to_markdown,
    strip_furniture_from_text,
)
from app.pipeline.regex_question_parser import parse_question_block, split_into_question_blocks

FIXTURE_PDF = Path(__file__).parent / "fixtures" / "match_list_table_and_diagram.pdf"

# Q12 as extracted: a match-the-list table (marker + GFM), a picture marker in Q13, and a
# short-form Reverse Logic Box ("(A) 3 2 4 1 — ... Trap: ...") split across a page break.
MARKDOWN = """
<!-- PAGE_BREAK p=9 -->

Q12. [Subject: Arts & Culture] [Microtheme: Bhakti and Sufi Movements] [Nano Theme: Bhakti
Movement Saints] [Difficulty: Easy]
Match List I with List II and select the correct answer using the code given below the
lists.

<!-- TABLE id=0 -->
| List-I (Disciple) | List-II (Guru) |
|---|---|
| A. Kabir | 1. Guru Nanak Dev |
| B. Amir Khusrau | 2. Swami Ramananda |
| C. Surdas | 3. Nizamuddin Auliya |
| D. Mardana | 4. Vallabhacharya |

Code:
A B C D
(A) 3 2 4 1
(B) 3 2 1 4
(C) 2 3 4 1
(D) 2 3 1 4
Answer: (C)
Solution:
• Kabir — disciple of Swami Ramananda (Varanasi), by tradition.
• Code: A-2, B-3, C-4, D-1.
Reverse Logic Box — why the other options are wrong
(A) 3 2 4 1 — Makes Kabir a disciple of Nizamuddin Auliya and Khusrau of Ramananda — a
straight swap of the two Varanasi/Delhi gurus. Trap: associating Kabir's Muslim background with a
Sufi guru.

<!-- PAGE_BREAK p=10 -->

(B) 3 2 1 4 — Same Kabir–Khusrau swap. Trap: forgetting that Mardana is Nanak's best-known companion.
(D) 2 3 1 4 — Gets Kabir and Khusrau right but swaps Surdas and Mardana.
Q13. [Subject: Geography] [Microtheme: Maps] [Nano Theme: Diagrams] [Difficulty: Easy]
Study the following diagram and answer the question.
<!-- PICTURE id=0 -->
Which shape is drawn inside the rectangle?
(A) Circle
(B) Square
(C) Triangle
(D) Star
Answer: (A)
Solution:
• A red circle is drawn at the centre.
"""

TABLES = [{"id": 0, "page_no": 9, "bbox": [70, 900, 800, 1000], "markdown": "| List-I (Disciple) | ... |"}]
PICTURES = [{"id": 0, "page_no": 10, "bbox": [70, 300, 400, 500]}]


def _records(markdown=MARKDOWN, pictures=PICTURES, tables=TABLES):
    return [parse_question_block(b, pictures=pictures, tables=tables) for b in split_into_question_blocks(markdown)]


def test_match_list_table_stays_in_stem_as_markdown_table():
    q12 = _records()[0]
    assert "<!-- TABLE" not in q12.stem
    # Blank lines around the table so markdown renders it as a table, not as a paragraph
    assert "lists.\n\n| List-I (Disciple) | List-II (Guru) |\n|---|---|\n| A. Kabir | 1. Guru Nanak Dev |" in q12.stem
    assert "| D. Mardana | 4. Vallabhacharya |\n\nCode:\nA B C D" in q12.stem
    # Table rows are neither statements nor options
    assert q12.statement_lines == []
    assert q12.options == {"A": "3 2 4 1", "B": "3 2 1 4", "C": "2 3 4 1", "D": "2 3 1 4"}
    assert q12.answer_label == "C"
    assert [t["id"] for t in q12.tables] == [0]
    assert q12.extraction_issues == []


def test_short_form_reverse_logic_box_across_page_break():
    rl = _records()[0].reverse_logic
    assert set(rl) == {"A", "B", "D"}
    assert rl["A"]["whats_actually_true"].startswith("Makes Kabir a disciple of Nizamuddin Auliya")
    assert rl["A"]["whats_actually_true"].endswith("Varanasi/Delhi gurus.")
    assert rl["A"]["why_tempting"] == "associating Kabir's Muslim background with a Sufi guru."
    assert rl["B"]["why_tempting"] == "forgetting that Mardana is Nanak's best-known companion."
    # No "Trap:" sentence: the whole entry is the explanation
    assert rl["D"] == {"why_tempting": "", "whats_actually_true": "Gets Kabir and Khusrau right but swaps Surdas and Mardana."}


def test_picture_attaches_only_to_the_question_containing_its_marker():
    q12, q13 = _records()
    assert q12.pictures == []
    assert [p["id"] for p in q13.pictures] == [0]
    assert "<!-- PICTURE" not in q13.stem
    assert q13.stem == "Study the following diagram and answer the question.\nWhich shape is drawn inside the rectangle?"
    assert "MISSING_VISUAL_ASSET" not in q13.extraction_issues


def test_question_pointing_at_a_missing_diagram_is_flagged_for_review():
    q13 = _records(pictures=[])[1]
    assert "MISSING_VISUAL_ASSET" in q13.extraction_issues


def test_rows_to_markdown_cleans_cells():
    md = rows_to_markdown([["List-I", "List-II", None], ["A. a|b", "1. wrapped\ncell", ""], [None, None, None]])
    assert md == "| List-I | List-II |\n|---|---|\n| A. a\\|b | 1. wrapped cell |"


def test_running_header_and_page_numbers_are_removed():
    def line(text):
        return {"text": text, "chars": []}

    header = "UPPCS Prelims 2025 · General Studies Paper-I · Solved with Explanations"
    # The same content line opening several pages ("Answer: (A)") is not a header
    pages = [[line(header), line("Answer: (A)"), line(f"Body text {n}"), line(str(n))] for n in (9, 10, 11)]
    pages.append([line(header), line("Q14. [Subject: Polity]"), line("Stem"), line("Answer: (A)"), line("Solution:"), line("More"), line("12")])
    furniture = detect_page_furniture(pages)
    assert furniture == {header.lower()}

    text = f"D. Mardana 4. Vallabhacharya UPSC Planner Mentorship{header}\nCode:\n9\nA B C D"
    cleaned = strip_furniture_from_text(text, [header, "UPSC Planner Mentorship"], ["9"])
    assert "Mentorship" not in cleaned and "Prelims" not in cleaned
    assert cleaned.split("\n")[0].strip() == "D. Mardana 4. Vallabhacharya"
    assert "\n9\n" not in cleaned


def test_digital_pdf_extraction_keeps_table_picture_and_drops_running_header():
    res = DoclingOcrExtractor().extract(FIXTURE_PDF)
    md = res["full_markdown"]
    assert "Mentorship" not in md
    assert len(res["tables"]) == 1 and len(res["pictures"]) == 1
    # Cropped picture bbox is in rendered page-image pixels, inside the page
    pic = res["pictures"][0]
    img_w, img_h = res["page_images"][pic["page_no"]].size
    x0, top, x1, bottom = pic["bbox"]
    assert 0 <= x0 < x1 <= img_w and 0 <= top < bottom <= img_h

    records = {r.question_number: r for r in (parse_question_block(b, res["pictures"], res["tables"]) for b in split_into_question_blocks(md))}
    q12, q13 = records[12], records[13]
    assert "| A. Kabir | 1. Guru Nanak Dev |" in q12.stem and "| D. Mardana | 4. Vallabhacharya |" in q12.stem
    assert q12.answer_label == "C" and len(q12.options) == 4
    assert set(q12.reverse_logic) == {"A", "B", "D"}
    assert len(q13.pictures) == 1 and q12.pictures == []
    assert records[11].pictures == [] and records[11].tables == []
