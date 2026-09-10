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

# Header Tag Extractors (tolerant of [, (, {, <, missing brackets, line breaks, extra spaces)
# Example: [Subject: History & Culture] [Topic: Ancient Indian Literature] [Sub-topic: Sanskrit Dramatists] [Difficulty: Tough]
# Also supports: [Microtheme: ...] as Topic, [Nano Theme: ...] as Subtopic
SUBJECT_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*Subject\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Topic|Micro[-\s]?theme|Sub[-\s]?topic|Nano[-\s]?theme|Difficulty)\s*:|$)",
    re.UNICODE,
)
TOPIC_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*(?:Topic|Micro[-\s]?theme)\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Sub[-\s]?topic|Nano[-\s]?theme|Difficulty|Subject)\s*:|$)",
    re.UNICODE,
)
SUBTOPIC_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*(?:Sub[-\s]?topic|Nano[-\s]?theme)\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Difficulty|Subject|Topic|Micro[-\s]?theme)\s*:|$)",
    re.UNICODE,
)
DIFFICULTY_TAG_PATTERN = re.compile(
    r"(?i)[\[\(\{<]?\s*Difficulty\s*:\s*([^\]\)\}>\n\r]+?)(?=[\]\)\}>]|\s*(?:Subject|Topic|Micro[-\s]?theme|Sub[-\s]?topic|Nano[-\s]?theme)\s*:|$)",
    re.UNICODE,
)

# Option lines: (A) text, (B) text, etc.
# Tolerant of (A), [A], A), A. at line start
OPTION_LINE_PATTERN = re.compile(
    r"(?i)^\s*[\(\[]?([A-D])[\)\]\.]\s+(.*)$",
    re.MULTILINE,
)

# Answer line: Answer: (B) playwrights or Ans: (B) or Answer: B
ANSWER_LINE_PATTERN = re.compile(
    r"(?i)^\s*Ans(?:wer)?\s*:\s*[\(\[]?([A-D])[\)\]\.]?\s*(.*)$",
    re.MULTILINE,
)

# Solution header: Solution: or Solution:Bhavabhuti was...
SOLUTION_HEADER_PATTERN = re.compile(
    r"(?i)^\s*Solution\s*:\s*(.*)$",
    re.MULTILINE,
)

# Solution bullet line
# Bullet char may OCR as •, ◦, ●, ▪, ·, *, -, —, –, or ■
SOLUTION_BULLET_PATTERN = re.compile(
    r"^\s*([•◦●▪·*■]|[-–—])\s+(.*)$",
    re.MULTILINE,
)

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

# Statement lines inside question stem: e.g. 1. The Montagu-Chelmsford... or (1) ... or (i) ...
STATEMENT_LINE_PATTERN = re.compile(
    r"^\s*(?:\(?\d+\)?\.?|\(?[ivxLCDM]+\)?\.?)\s+(.*)$",
    re.MULTILINE,
)


def extract_header_tags(header_line: str) -> dict:
    """Extracts Subject, Topic, Subtopic, and Difficulty from a Q_HEADER line."""
    subject = None
    topic = None
    subtopic = None
    difficulty = None

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

    return {
        "subject_raw": subject,
        "topic_raw": topic,
        "subtopic_raw": subtopic,
        "difficulty_raw": difficulty,
    }
