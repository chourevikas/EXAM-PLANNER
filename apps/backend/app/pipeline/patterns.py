"""Centralized OCR-noise-tolerant regex patterns for deterministic question extraction.

Tolerant of typical OCR noise:
- Bullet variations: •, ◦, ●, ▪, ·, *, -, —, –, ■
- Punctuation noise: missing periods, spaces around colons, square brackets read as parentheses or braces
- Section markers: dash variations, bold markdown asterisks
- Case insensitivity across headers and labels
"""
import re

# Page break sentinel inserted during docling document conversion
PAGE_BREAK_PATTERN = re.compile(r"<!--\s*PAGE_BREAK\s+p=(\d+)\s*-->", re.IGNORECASE)

# Question Header Start: Q1. or Q 1 or Q1: or Q.1 or # Q1
# Captures: Group 1 = Question Number, Group 2 = Remainder of Header Line
Q_HEADER_PATTERN = re.compile(
    r"(?i)^[#\s]*Q\s*(\d+)\s*[\.:\-]?\s*(.*)$",
    re.MULTILINE,
)

# Numbered question bank format ("1. On the 1st April, 1999, ... [MPSC Mains 2017]"): the question
# number starts the stem line. Only used when a document has no Q<N> headers, and only numbers that
# continue a run (N, N+1, ...) count, so "2011." wrapped from a solution never splits a question.
NUMBERED_Q_HEADER_PATTERN = re.compile(
    r"^[ \t]*(\d{1,4})\.[ \t]+(\S.*)$",
    re.MULTILINE,
)

# Chapter heading between questions: "— Unemployment and Employment —" (em/en dashes only)
SECTION_HEADING_PATTERN = re.compile(
    r"^[ \t]*[—–]+[ \t]*([^—–\n]{2,80}?)[ \t]*[—–]+[ \t]*$",
    re.MULTILINE,
)

# Source of a question-bank item, at the end of its stem: "[MPSC Mains 2017]", "[ASO Mains Oct 2023]",
# "[Tax Asst. 2016]" (may wrap across lines). Group 1 = label, group 2 = year.
SOURCE_TAG_PATTERN = re.compile(
    r"\[\s*([A-Za-z][^\[\]]{0,60}?\b((?:19|20)\d{2}))\s*\]",
)

# Statement / sub-prompt lines in a stem marked with an arrow: "➤ (a) Rural Works Programme"
ARROW_LINE_PATTERN = re.compile(r"^\s*[➤►▶➢]\s*(.*)$")
# Arrow lines that are only a label for the options below ("➤ Answer Options:")
ANSWER_OPTIONS_LABEL_PATTERN = re.compile(r"(?i)^\s*answer\s+options?\s*:?\s*$")

# Header Tag Extractors (tolerant of [, (, {, <, missing brackets, line breaks, extra spaces)
# Example: [Subject: History & Culture] [Topic: Ancient Indian Literature] [Sub-topic: Sanskrit Dramatists] [Difficulty: Tough] [Type: Chronology]
# Also supports: [Microtheme: ...] as Topic, [Nano Theme: ...] as Subtopic, [Question Type: ...] as Type
SUBJECT_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*Subject\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Topic|Micro[-\s]?theme|Sub[-\s]?topic|Nano[-\s]?theme|Difficulty|Question\s*Type|Question\s*Nature|Type)\s*:|$)",
    re.UNICODE,
)
TOPIC_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*(?:Topic|Micro[-\s]?theme)\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Sub[-\s]?topic|Nano[-\s]?theme|Difficulty|Subject|Question\s*Type|Question\s*Nature|Type)\s*:|$)",
    re.UNICODE,
)
SUBTOPIC_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*(?:Sub[-\s]?topic|Nano[-\s]?theme)\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Difficulty|Subject|Topic|Micro[-\s]?theme|Question\s*Type|Question\s*Nature|Type)\s*:|$)",
    re.UNICODE,
)
DIFFICULTY_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*Difficulty\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Subject|Topic|Micro[-\s]?theme|Sub[-\s]?topic|Nano[-\s]?theme|Question\s*Type|Question\s*Nature|Type)\s*:|$)",
    re.UNICODE,
)
TYPE_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*(?:Question\s*Type|Question\s*Nature|Type)\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Subject|Topic|Micro[-\s]?theme|Sub[-\s]?topic|Nano[-\s]?theme|Difficulty)\s*:|$)",
    re.UNICODE,
)

# Option lines: (A) text, (B) text, etc.
# Tolerant of (A), [A], A), A. at line start
OPTION_LINE_PATTERN = re.compile(
    r"(?i)^\s*[\(\[]?([A-D])[\)\]\.]\s+(.*)$",
    re.MULTILINE,
)

# Answer line: Answer: (B) playwrights or Ans: (B) or Answer: B or Answer B (no colon)
# The letter must stand alone, so "Answer Options:" is never read as an answer.
ANSWER_LINE_PATTERN = re.compile(
    r"(?i)^[ \t]*Ans(?:wer)?[ \t]*[:\-–]?[ \t]*[\(\[]?([A-D])(?:[\)\]\.]|(?=[ \t])|$)[ \t]*(.*)$",
    re.MULTILINE,
)

# Solution header: Solution: / Solution. / Solution (alone) / Solution:Bhavabhuti was...
SOLUTION_HEADER_PATTERN = re.compile(
    r"(?i)^[ \t]*Solution[ \t]*(?:[:\.]|$)[ \t]*(.*)$",
    re.MULTILINE,
)

# Solution bullet line
# Bullet char may OCR as •, ◦, ●, ▪, ·, *, -, —, –, or ■
# "■ Related Articles / Acts / Cases:" list inside a solution (items follow as "– ..." lines)
RELATED_REFS_HEADER_PATTERN = re.compile(
    r"(?i)^\s*(?:[■•*#-]\s*)*Related\s+(?:Articles?|Acts?|Cases?)(?:\s*/\s*(?:Articles?|Acts?|Cases?))*\s*:?\s*$"
)

SOLUTION_BULLET_PATTERN = re.compile(
    r"^\s*([•◦●▪·*■]|[-–—])\s+(.*)$",
    re.MULTILINE,
)

# A labelled note closing a solution ("Answer-key note: ...") starts its own paragraph
SOLUTION_NOTE_PATTERN = re.compile(r"(?i)^(?:answer[- ]key\s+)?note\s*:")

# Common Mistake header and content
# ■ Common Mistake: ... or Common Mistake: ...
COMMON_MISTAKE_HEADER_PATTERN = re.compile(
    r"(?i)^[#\s]*[■▪●\*–—\-]?\s*Common\s+Mistake\s*:\s*(.*)$",
    re.MULTILINE,
)

# Reverse Logic Box Header
# ■ Reverse Logic Box — Why the other options are wrong or Reverse Logic Box Why the other options are wrong
REVERSE_LOGIC_HEADER_PATTERN = re.compile(
    r"(?i)^[#\s]*[■▪●\*–—\-]?\s*Reverse\s+Logic\s+Box(?:\s*[-–—:]?\s*Why\s+the\s+other\s+options\s+are\s+wrong)?.*$",
    re.MULTILINE,
)

# Reverse Logic Option block pattern
# Matches: Option (A): *Why it seems tempting* — <text> *What's actually true* — <text>
# or Option (A): Why it seems tempting - <text> What's actually true - <text>
REVERSE_LOGIC_OPTION_PATTERN = re.compile(
    r"(?i)Option\s*[\(\[]?([A-D])[\)\]\.]?\s*:\s*"
    r"(?:\*?\s*Why\s+it\s+seems\s+tempting\s*\*?\s*[-–—:]?\s*)"
    r"(.*?)"
    r"(?:\*?\s*What(?:'s|\s+is)\s+actually\s+true\s*\*?\s*[-–—:]?\s*)"
    r"(.*?)(?=(?:Option\s*[\(\[]?[A-D][\)\]\.]?\s*:|$))",
    re.DOTALL | re.IGNORECASE,
)

# Reverse Logic option in the short form: "(A) 3 2 4 1 — Makes Kabir a disciple of ... Trap: ..."
# Group 1 = option letter, group 2 = option text (repeated from the options), group 3 = the reasoning,
# which runs (across wrapped lines) until the next "(X)" line or the end of the box.
REVERSE_LOGIC_SHORT_OPTION_PATTERN = re.compile(
    r"^[ \t]*[\(\[]([A-D])[\)\]][ \t]*(.*?)[ \t]+[—–-][ \t]+(.+?)(?=^[ \t]*[\(\[][A-D][\)\]]|\Z)",
    re.DOTALL | re.MULTILINE,
)
# "Trap: ..." sentence at the end of a short-form Reverse Logic entry: why the option is tempting
REVERSE_LOGIC_TRAP_PATTERN = re.compile(r"(?i)\bTrap\s*:\s*")

# Asset placeholders left in the markdown by the extractor where a picture or table sits
PICTURE_MARKER_PATTERN = re.compile(r"<!--\s*PICTURE\s+id=(\d+)\s*-->")
TABLE_MARKER_PATTERN = re.compile(r"<!--\s*TABLE\s+id=(\d+)\s*-->")
# A markdown table row ("| A. Kabir | 1. Guru Nanak Dev |") or its "|---|---|" separator
TABLE_ROW_PATTERN = re.compile(r"^\s*\|.*\|\s*$")

# A numbered stem item ("1. ...", "(2) ...") and the prompt that closes the list ("Select the correct
# answer ...", "Which of the above ...", "Codes:"); capitalised, so a wrapped item ("which flows ...") is not one
STEM_LIST_ITEM_PATTERN = re.compile(r"^\s*\(?\d{1,2}[.)]\s")
STEM_CLOSING_PROMPT_PATTERN = re.compile(r"^\s*(?:Select|Choose|Which|How many|Codes?\s*:)")

# Stem wording that points at a figure/table the question cannot be answered without
VISUAL_REFERENCE_PATTERN = re.compile(
    r"(?i)\b(?:(?:following|given|above|below|adjoining)\s+(?:figure|diagram|map|graph|chart|table|image|picture)"
    r"|(?:figure|diagram|map|graph|chart|table|image|picture)\s+(?:given\s+)?(?:below|above))\b"
)

# Statement lines inside question stem: e.g. 1. The Montagu-Chelmsford... or (1) ... or (i) ...
STATEMENT_LINE_PATTERN = re.compile(
    r"^\s*(?:\(?\d+\)?\.?|\(?[ivxLCDM]+\)?\.?)\s+(.*)$",
    re.MULTILINE,
)


def extract_header_tags(header_line: str) -> dict:
    """Extracts Subject, Topic, Subtopic, Difficulty, and Type from a Q_HEADER line."""
    subject = None
    topic = None
    subtopic = None
    difficulty = None
    type_raw = None

    sm = SUBJECT_TAG_PATTERN.search(header_line)
    if sm:
        subject = sm.group(1).strip()

    tm = TOPIC_TAG_PATTERN.search(header_line)
    if tm:
        topic = tm.group(1).strip()

    stm = SUBTOPIC_TAG_PATTERN.search(header_line)
    if stm:
        subtopic = stm.group(1).strip()

    dm = DIFFICULTY_TAG_PATTERN.search(header_line)
    if dm:
        difficulty = dm.group(1).strip()

    tym = TYPE_TAG_PATTERN.search(header_line)
    if tym:
        type_raw = tym.group(1).strip()

    return {
        "subject_raw": subject,
        "topic_raw": topic,
        "subtopic_raw": subtopic,
        "difficulty_raw": difficulty,
        "type_raw": type_raw,
    }


def extract_option_analysis_from_text(raw_text: str, label: str) -> str | None:
    """Extracts a specific option's distractor/tempting analysis from a combined Reverse Logic block."""
    if not raw_text:
        return None
    clean = re.sub(r'[\(\)\.\s]', '', label).upper()
    label_map = {
        'A': r'(?:A|ए|अ)',
        'B': r'(?:B|बी|ब)',
        'C': r'(?:C|सी|स)',
        'D': r'(?:D|डी|द)',
    }
    lbl_re = label_map.get(clean, clean)
    all_re = r'(?:[A-D]|ए|बी|सी|डी|अ|ब|स|द)'
    pat = rf'(?:(?:^|\n|\s|—|–|-)(?:(?:Option|विकल्प|पर्याय)\s*\(?{lbl_re}\)?|\({lbl_re}\)|\*\*(?:Option|विकल्प|पर्याय)\s*\(?{lbl_re}\)?\*\*)\s*[:\-\—–]?\s*)([\s\S]*?)(?=(?:(?:^|\n|\s{{2,}}|\.\s+|—\s*|–\s*|;\s*)(?:(?:Option|विकल्प|पर्याय)\s*\(?{all_re}\)?|\({all_re}\)\s*[:\-\—–]|\*\*(?:Option|विकल्प|पर्याय)\s*\(?{all_re}\)?\*\*)|$))'
    m = re.search(pat, raw_text, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        val = re.sub(rf'^(?:(?:Option|विकल्प|पर्याय)\s*\(?{lbl_re}\)?|\(?{lbl_re}\)|\*\*(?:Option|विकल्प|पर्याय)\s*\(?{lbl_re}\)?\*\*)\s*[:\-\—–]?\s*', '', val, flags=re.IGNORECASE).strip()
        if len(val) > 5:
            return val
    return None


def clean_correct_option_text(text: str) -> str:
    """Removes the Reverse Logic Box / other options breakdown from the correct option's explanation."""
    if not text:
        return ''
    rl_match = re.search(r'(?:[◆■•·*#-]*\s*(?:Reverse\s+Logic(?:\s+Box)?|Why\s+(?:the\s+)?other\s+options\s+are\s+wrong|रिवर्स\s+लॉजिक|रिव्हर्स\s+लॉजिक)|\b(?:Option|विकल्प|पर्याय)\s*\(?(?:[B-D]|बी|सी|डी|ब|स|द)\)?\s*[:\-\—–])', text, re.IGNORECASE)
    if rl_match:
        return text[:rl_match.start()].strip()
    return text.strip()

