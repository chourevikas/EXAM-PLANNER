"""Name canonicalization for Knowledge Layer concepts and entities.

`normalize_key` turns any spelling of a name into the key used for alias lookup, so
"Art. 15", "Article 15" and "article  15" all resolve to the same node, and
"GoI Act 1935" / "Government of India Act, 1935" to the same Act.
"""
import re
import unicodedata
from typing import Optional

_DASHES = dict.fromkeys(map(ord, "‐‑‒–—―−"), "-")
_QUOTES = dict.fromkeys(map(ord, "‘’‚‛′`"), "'") | dict.fromkeys(map(ord, "“”„‟″"), '"')

# Whole-word abbreviations expanded before comparison (applied to the lowercased text)
_ABBREVIATIONS = [
    (re.compile(r"\bart(?:s)?\b\.?"), "article"),
    (re.compile(r"\bgoi\b"), "government of india"),
    (re.compile(r"\bgovt\b\.?"), "government"),
    (re.compile(r"\bconst\b\.?"), "constitution"),
    (re.compile(r"\bamdt\b\.?"), "amendment"),
    (re.compile(r"\bsch\b\.?"), "schedule"),
    (re.compile(r"\bvs?\b\.?"), "v"),
    (re.compile(r"\bversus\b"), "v"),
]
_NUMBER_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
    "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
    "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18",
    "nineteen": "19", "twenty": "20",
}
_ARTICLE_WORD_NUMBER = re.compile(r"\barticle (" + "|".join(_NUMBER_WORDS) + r")\b")

# Normalized provision key: "article 15", "article 15(4)", "article 21a", "article 15(4)(a)"
_PROVISION_KEY = re.compile(r"^article (?P<num>\d+[a-z]?)(?P<clauses>(?:\([0-9a-z]+\))*)$")


def clean_display_name(text: str) -> str:
    """Tidy a name for display: unicode-normalize, unify dashes/quotes, collapse whitespace."""
    text = unicodedata.normalize("NFKC", text or "").translate(_DASHES).translate(_QUOTES)
    text = re.sub(r"\s+", " ", text).strip()
    return text.strip(" .;,:-")


def normalize_key(text: str) -> str:
    """Canonical lookup key for a concept/entity name or alias."""
    text = clean_display_name(text).lower()
    for pattern, replacement in _ABBREVIATIONS:
        text = pattern.sub(replacement, text)
    text = _ARTICLE_WORD_NUMBER.sub(lambda m: f"article {_NUMBER_WORDS[m.group(1)]}", text)
    text = re.sub(r"\barticle(?=\d)", "article ", text)
    # "Act, 1935" == "Act 1935"; drop punctuation except clause parentheses
    text = re.sub(r"[^\w\s()]", " ", text)
    text = re.sub(r"\s*\(\s*", "(", text)
    text = re.sub(r"\s*\)\s*", ") ", text)
    text = re.sub(r"(\d)\s+\(", r"\1(", text)
    text = re.sub(r"\)\s+\(", ")(", text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_provision(name: str) -> Optional[tuple[str, list[str]]]:
    m = _PROVISION_KEY.match(normalize_key(name))
    if not m:
        return None
    num = m.group("num")
    num = num[:-1] + num[-1].upper() if num[-1].isalpha() else num
    return num, re.findall(r"\(([0-9a-z]+)\)", m.group("clauses"))


def canonical_provision_name(name: str) -> Optional[str]:
    """Display form for an Article reference ("Art 15 (4)" -> "Article 15(4)"), or None if not one."""
    parsed = _parse_provision(name)
    if not parsed:
        return None
    num, clauses = parsed
    return f"Article {num}" + "".join(f"({c})" for c in clauses)


def provision_parent(name: str) -> Optional[str]:
    """For a constitutional sub-provision returns its parent provision's display name.

    "Article 15(4)" -> "Article 15", "Article 15(4)(a)" -> "Article 15(4)", "Article 15" -> None.
    """
    parsed = _parse_provision(name)
    if not parsed or not parsed[1]:
        return None
    num, clauses = parsed
    return f"Article {num}" + "".join(f"({c})" for c in clauses[:-1])
