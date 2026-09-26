"""Deterministic Knowledge Layer extraction from question text (no AI).

Used on every question in addition to authored tags, and as the only source for PDFs that
carry no [Concepts]/[Entities]/[Relationships] tags:
- Article references: "Article 15(4)", "Art. 21A", "Articles 14, 15 and 16"
- Acts with a year: "Government of India Act, 1935", "Indian Councils Acts, 1861 / 1892 / 1909"
- Items of the solution's "Related Articles / Acts / Cases" list
- Any known alias of a curated concept/entity (dictionary scan over the text)
"""
import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

from app.knowledge.normalize import canonical_provision_name, clean_display_name, normalize_key
from app.pipeline.patterns import RELATED_REFS_HEADER_PATTERN

_ARTICLE_REF = re.compile(
    r"\b(?:Articles?|Arts?\.?)\s*"
    r"(?P<list>\d+[A-Z]?(?:\s*\(\s*[0-9a-z]+\s*\))*(?:\s*(?:,|and|&|or)\s*\d+[A-Z]?(?:\s*\(\s*[0-9a-z]+\s*\))*)*)",
    re.IGNORECASE,
)
_ARTICLE_ITEM = re.compile(r"\d+[A-Z]?(?:\s*\(\s*[0-9a-z]+\s*\))*", re.IGNORECASE)
_NAME_WORD = r"(?:[A-Z][\w'’.&-]*|of|the|and|for|on|in)"
_ACT_REF = re.compile(
    rf"\b(?P<name>[A-Z][\w'’.&-]*(?:\s+{_NAME_WORD}){{0,8}}?)\s+Acts?\b,?\s*(?:of\s+)?"
    r"(?P<years>(?:1[6-9]\d{2}|20\d{2})(?:\s*(?:/|,|&|and)\s*(?:1[6-9]\d{2}|20\d{2}))*)"
)
_YEAR = re.compile(r"1[6-9]\d{2}|20\d{2}")
_PARENTHETICAL = re.compile(r"\s*\([^)]*\)\s*$")


@dataclass
class ExtractedNames:
    """Candidate names found by rules, split by where they appeared (stem/answer weigh more than solution)."""
    core: List[str] = field(default_factory=list)  # stem, options, answer
    supporting: List[str] = field(default_factory=list)  # solution, related refs

    def add(self, name: str, core: bool) -> None:
        target = self.core if core else self.supporting
        if name and name not in self.core and name not in target:
            target.append(name)
            if core and name in self.supporting:
                self.supporting.remove(name)


def article_refs(text: str) -> List[str]:
    refs = []
    for m in _ARTICLE_REF.finditer(text or ""):
        for item in _ARTICLE_ITEM.findall(m.group("list")):
            name = canonical_provision_name(f"Article {item}")
            if name and name not in refs:
                refs.append(name)
    return refs


def act_refs(text: str) -> List[str]:
    refs = []
    for m in _ACT_REF.finditer(text or ""):
        name = re.sub(r"^(?:The|A|An)\s+", "", m.group("name").strip())
        for year in _YEAR.findall(m.group("years")):
            ref = f"{name} Act {year}"
            if ref not in refs:
                refs.append(ref)
    return refs


def related_refs_from_solution(solution_text: str) -> List[str]:
    """Recovers the "Related Articles / Acts / Cases" items from a stored solution text."""
    refs, collecting = [], False
    for line in re.split(r"\n+", solution_text or ""):
        line = line.strip()
        if not line:
            continue
        if RELATED_REFS_HEADER_PATTERN.match(line):
            collecting = True
            continue
        if collecting:
            item = re.sub(r"^[-–—•■*]+\s*", "", line).strip()
            if item:
                refs.append(item)
    return refs


class AliasScanner:
    """Finds known aliases (already normalized) inside normalized text, longest match first."""

    def __init__(self, aliases: Iterable[str], min_length: int = 3):
        keys = sorted({a for a in aliases if len(a) >= min_length}, key=len, reverse=True)
        self._pattern = (
            re.compile(r"(?<![\w(])(?:" + "|".join(re.escape(k) for k in keys) + r")(?![\w])") if keys else None
        )

    def scan(self, text: str) -> List[str]:
        if not self._pattern or not text:
            return []
        found = []
        for m in self._pattern.finditer(normalize_key(text)):
            if m.group(0) not in found:
                found.append(m.group(0))
        return found


def extract_names(
    core_texts: Iterable[Optional[str]],
    supporting_texts: Iterable[Optional[str]],
    related_refs: Iterable[str],
    scanner: Optional[AliasScanner] = None,
) -> ExtractedNames:
    """Rule-based candidate names. Resolution to canonical nodes happens in the enrichment service."""
    names = ExtractedNames()
    core = [t for t in core_texts if t]
    supporting = [t for t in supporting_texts if t]
    for is_core, texts in ((True, core), (False, supporting)):
        for text in texts:
            for ref in article_refs(text) + act_refs(text):
                names.add(ref, is_core)
            if scanner:
                for alias in scanner.scan(text):
                    names.add(alias, is_core)

    for ref in related_refs:
        found = article_refs(ref) + act_refs(ref)
        if found:
            for name in found:
                names.add(name, False)
        else:
            # "Kesavananda Bharati v. State of Kerala (1973)" -> the item itself, minus trailing notes
            item = clean_display_name(_PARENTHETICAL.sub("", ref.split("—")[0]))
            if 3 <= len(item) <= 120:
                names.add(item, False)
    return names


def alias_keys_by_kind(rows: Iterable[tuple]) -> Dict[str, List[str]]:
    by_kind: Dict[str, List[str]] = {}
    for key, kind in rows:
        by_kind.setdefault(kind, []).append(key)
    return by_kind
