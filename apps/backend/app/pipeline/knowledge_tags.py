"""Parses authored Knowledge Layer tags out of a question block.

Content authors may add, anywhere in a question (normally right after the Difficulty tag):

    [Concepts: Right to Equality; Reservation]
    [Entities: Article 15; Article 15(4); Government of India Act, 1935]
    [Relationships: Article 15 -> Right to Equality;
                    Article 15(4) -(provides_for)-> Special Provisions for SEBC/SC/ST]

Rules:
- A tag runs to its matching "]" and may span several lines (OCR page-break markers inside are ignored).
- Items are separated by ";" (new lines are then just wrapping). Without any ";", new lines and
  commas separate items, except a comma followed by a 4-digit year ("Government of India Act, 1935").
- "A -> B" is a `related_to` relationship; "A -(relation)-> B" names the relation. "→" and "-&gt;" work too.

The tags are removed from the text so they never leak into the stem, options or solution.
"""
import re
from typing import Dict, List, Optional, Tuple

from app.pipeline.patterns import OPTION_LINE_PATTERN, PAGE_BREAK_PATTERN

_TAG_OPEN = re.compile(r"\\?\[\s*(?P<kind>Concepts?|Entit(?:y|ies)|Relationships?)\s*:", re.IGNORECASE)
# OCR sometimes drops the brackets: accept a bare "Concepts: ..." line too, but only in the header area
# (before the first option) so a solution sentence like "Concept: ..." is never mistaken for a tag
_BARE_TAG_LINE = re.compile(r"(?im)^[ \t]*(?P<kind>Concepts?|Entit(?:y|ies)|Relationships?)\s*:(?P<body>[^\n]*)$")
_RELATION = re.compile(
    r"^(?P<src>.+?)\s*(?:"
    r"[-–—]+\s*\(\s*(?P<rel>[A-Za-z _-]+?)\s*\)\s*[-–—]*\s*(?:>|&gt;|→)"  # A -(rel)-> B
    r"|[-–—]+\s*(?:>|&gt;)"  # A -> B
    r"|→"  # A → B
    r")\s*(?P<tgt>.+)$"
)
_ITEM_BULLET = re.compile(r"^\s*(?:[-–—•*■]+\s*)")
_COMMA_SPLIT = re.compile(r",(?!\s*\d{4}\b)")


def _kind_key(kind: str) -> str:
    k = kind.lower()
    if k.startswith("concept"):
        return "concepts"
    if k.startswith("entit"):
        return "entities"
    return "relationships"


def _split_items(body: str) -> List[str]:
    body = PAGE_BREAK_PATTERN.sub(" ", body)
    # With ";" separators a new line is only OCR/authoring wrap ("Quit India\nMovement" is one item)
    parts = body.replace("\n", " ").split(";") if ";" in body else [
        p for line in body.split("\n") for p in _COMMA_SPLIT.split(line)
    ]
    items = []
    for part in parts:
        item = _ITEM_BULLET.sub("", part).strip().strip(",").strip()
        item = re.sub(r"\s+", " ", item)
        if item:
            items.append(item)
    return items


def _parse_relationship(item: str) -> Dict[str, str] | None:
    m = _RELATION.match(item)
    if not m:
        return None
    src, tgt = m.group("src").strip(), m.group("tgt").strip()
    if not src or not tgt:
        return None
    return {"source": src, "relation": (m.group("rel") or "").strip(), "target": tgt}


def _find_bracket_end(text: str, start: int) -> int:
    """Index just past the "]" closing the tag opened before `start`, or the end of that line if unclosed."""
    depth = 1
    for i in range(start, len(text)):
        if text[i] == "[":
            depth += 1
        elif text[i] == "]":
            depth -= 1
            if depth == 0:
                return i + 1
    line_end = text.find("\n", start)
    return len(text) if line_end == -1 else line_end


def extract_knowledge_tags(text: str) -> Tuple[str, Dict[str, list]]:
    """Returns (text without the tags, {"concepts": [...], "entities": [...], "relationships": [...], "issues": [...]})."""
    found: Dict[str, list] = {"concepts": [], "entities": [], "relationships": [], "issues": []}
    if not text:
        return text, found

    spans: List[Tuple[int, int, str, str]] = []
    pos = 0
    while True:
        m = _TAG_OPEN.search(text, pos)
        if not m:
            break
        end = _find_bracket_end(text, m.end())
        body = text[m.end():end]
        body = body[:-1] if body.endswith("]") else body
        spans.append((m.start(), end, _kind_key(m.group("kind")), body.rstrip("\\")))
        pos = end

    covered = [(s, e) for s, e, _, _ in spans]
    first_option = OPTION_LINE_PATTERN.search(text)
    header_end = first_option.start() if first_option else len(text)
    for m in _BARE_TAG_LINE.finditer(text, 0, header_end):
        if not any(s <= m.start() < e for s, e in covered):
            spans.append((m.start(), m.end(), _kind_key(m.group("kind")), m.group("body")))

    for _, _, kind, body in sorted(spans):
        for item in _split_items(body):
            if kind == "relationships":
                rel = _parse_relationship(item)
                if rel:
                    found["relationships"].append(rel)
                else:
                    found["issues"].append(f"UNPARSED_RELATIONSHIP: {item}")
            elif item not in found[kind]:
                found[kind].append(item)

    cleaned = text
    for start, end, _, _ in sorted(spans, reverse=True):
        cleaned = cleaned[:start] + cleaned[end:]
    # Collapse blank lines left behind where a whole tag line was removed
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned, found


def knowledge_tags_from_record(record) -> Optional[dict]:
    """The `questions.knowledge_tags_raw` payload for a parsed QuestionRecord (None when it has nothing)."""
    payload = {
        "concepts": list(getattr(record, "concepts_raw", []) or []),
        "entities": list(getattr(record, "entities_raw", []) or []),
        "relationships": list(getattr(record, "relationships_raw", []) or []),
        "related_refs": list(getattr(record, "related_refs", []) or []),
        "issues": list(getattr(record, "knowledge_issues", []) or []),
    }
    return payload if any(payload.values()) else None
