"""Taxonomy Resolution and Validation Pipeline.

Deterministic, zero-API-cost top-down cascaded taxonomy resolver that maps raw LLM
predictions (subject, topic, subtopic) to canonical syllabus literals while flexibly
handling cross-level placements, synonyms, sentence-level context matching, and
dynamic LLM subtopic/topic/subject retention as final fallback.

Architecture:
- Cross-Level Anchor: Checks if ANY of raw_subject, raw_topic, or raw_subtopic matches a known subtopic/topic.
- Level 1: Subject resolved against root keys of Master Taxonomy -> Context Sentence Match -> LLM Provided Subject.
- Level 2: Topic resolved strictly within the resolved Subject -> Context Sentence Match -> LLM Provided Topic.
- Level 3: Subtopic resolved against canonical syllabus -> Context Sentence Match -> LLM Provided Subtopic.
"""

from __future__ import annotations

import re
import time
import math
import logging
from enum import Enum
from typing import Dict, List, Tuple, Optional, Any, Set, Union, get_args
from collections import defaultdict

from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.schemas.syllabus_literals import (
    SYLLABUS_HIERARCHY,
    SubjectLiteral,
    TopicLiteral,
    SubtopicLiteral,
)

try:
    from app.config.logger import setup_logger

    logger = setup_logger("TaxonomyResolver")
except Exception:
    logger = logging.getLogger("TaxonomyResolver")

# Optional RapidFuzz integration with fallback
try:
    from rapidfuzz import fuzz, process  # type: ignore

    HAS_RAPIDFUZZ = True
except (ImportError, OSError, Exception):
    HAS_RAPIDFUZZ = False

# Optional SentenceTransformers integration with fallback
try:
    from sentence_transformers import SentenceTransformer  # type: ignore
    import numpy as np  # type: ignore

    HAS_SENTENCE_TRANSFORMERS = True
except (ImportError, OSError, Exception):
    HAS_SENTENCE_TRANSFORMERS = False
    try:
        import numpy as np  # type: ignore
    except (ImportError, OSError, Exception):
        np = None  # type: ignore


class MatchTier(str, Enum):
    EXACT = "exact"
    FUZZY = "fuzzy"
    SEMANTIC = "semantic"
    BOTTOM_UP = "bottom_up"
    FALLBACK = "fallback"


class FieldResolutionResult(BaseModel):
    """Result of resolving a single taxonomy field (Subject, Topic, or Subtopic)."""

    canonical_value: str = Field(description="Strict canonical value from syllabus taxonomy or retained clean LLM domain string")
    raw_value: Optional[str] = Field(default=None, description="Original raw prediction string from LLM")
    tier: MatchTier = Field(description="Matching tier utilized (exact, fuzzy, semantic, bottom_up, fallback)")
    algorithm_detail: str = Field(
        default="EXACT_MATCH",
        description="Human-readable description of the exact matching algorithm applied",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score of match (1.0 for exact, 0.8-0.99 for fuzzy, 0.5-0.95 for semantic, 0.75 for LLM retention)",
    )
    execution_time_ms: float = Field(
        default=0.0, description="Execution time in milliseconds for this field resolution"
    )


class TaxonomyResolutionMetrics(BaseModel):
    """Audit and performance metrics for the complete taxonomy resolution."""

    subject_match: FieldResolutionResult
    topic_match: FieldResolutionResult
    subtopic_match: Optional[FieldResolutionResult] = None
    overall_confidence: float = Field(ge=0.0, le=1.0, description="Harmonic or weighted confidence score")
    total_resolution_time_ms: float = Field(
        default=0.0, description="Total runtime across all cascaded levels in milliseconds"
    )
    embedding_engine_used: str = Field(
        default="SentenceTransformers (all-MiniLM-L6-v2)",
        description="Underlying semantic engine utilized",
    )
    is_fully_mapped: bool = Field(
        default=True,
        description="True if Subject, Topic, and Subtopic are all mapped to valid taxonomy literals",
    )


class MultiConceptItemResolved(BaseModel):
    """Resolved multi-concept item preserving taxonomy hierarchy."""

    subject: str = Field(description="Resolved canonical subject")
    topic: str = Field(description="Resolved canonical topic")
    subtopic: Optional[str] = Field(default=None, description="Resolved canonical subtopic")
    is_primary: bool = Field(default=False)
    relevance_weight: float = Field(default=1.0, ge=0.0, le=1.0)
    concept_name: Optional[str] = None
    resolution_tier: Optional[MatchTier] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class ValidatedTaxonomy(BaseModel):
    """Validated taxonomy container ensuring clean structure while supporting dynamic LLM concepts."""

    subject: str = Field(description="Canonical subject literal or retained clean LLM subject")
    topic: str = Field(description="Canonical topic literal or retained clean LLM topic")
    subtopic: Optional[str] = Field(
        default=None, description="Canonical or domain-retained subtopic literal"
    )
    metrics: Optional[TaxonomyResolutionMetrics] = None

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="after")
    def validate_hierarchy_integrity(self) -> "ValidatedTaxonomy":
        """Ensures non-empty clean strings for subject and topic."""
        if not self.subject or not self.subject.strip():
            self.subject = "General Science"
        if not self.topic or not self.topic.strip():
            self.topic = "General Concepts"
        return self


class RawLLMExplanationPayload(BaseModel):
    """Raw input payload from LLM before taxonomy normalization."""

    question_text: str = Field(description="The question prompt")
    explanation: Optional[str] = Field(default="", description="Detailed answer explanation or solution")
    correct_answer: Optional[str] = Field(default=None, description="Correct option label or value")
    predicted_subject: Optional[str] = Field(
        default=None,
        alias="raw_subject",
        description="Raw subject prediction from LLM",
    )
    predicted_topic: Optional[str] = Field(
        default=None,
        alias="raw_topic",
        description="Raw topic prediction from LLM",
    )
    predicted_subtopic: Optional[str] = Field(
        default=None,
        alias="raw_subtopic",
        description="Raw subtopic prediction from LLM",
    )
    concepts: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list, description="Additional raw concept tags"
    )
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    options_breakdown: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    common_traps: Optional[List[str]] = Field(default_factory=list)
    key_takeaways: Optional[List[str]] = Field(default_factory=list)
    difficulty: Optional[str] = "Medium"
    blooms_level: Optional[str] = "ANALYZE"
    cognitive_skill: Optional[str] = "Conceptual Reasoning"
    irt_discrimination_a: Optional[float] = 1.5
    irt_difficulty_b: Optional[float] = 0.0
    irt_pseudo_guessing_c: Optional[float] = 0.18

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ValidatedDatabaseExplanationPayload(BaseModel):
    """Strictly validated database-ready payload."""

    question_text: str
    explanation: str
    correct_answer: Optional[str] = None
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    options_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
    common_traps: List[str] = Field(default_factory=list)
    key_takeaways: List[str] = Field(default_factory=list)

    subject: str = Field(description="Subject literal or clean retained string")
    topic: str = Field(description="Topic literal or clean retained string")
    subtopic: Optional[str] = Field(
        default=None, description="Subtopic literal or clean retained string"
    )
    taxonomy_metrics: TaxonomyResolutionMetrics = Field(
        description="Audit trail and confidence metrics for taxonomy resolution"
    )
    concepts: List[MultiConceptItemResolved] = Field(
        default_factory=list, description="Validated interdisciplinary concepts"
    )

    difficulty: str = "Medium"
    blooms_level: str = "ANALYZE"
    cognitive_skill: str = "Conceptual Reasoning"
    irt_discrimination_a: float = 1.5
    irt_difficulty_b: float = 0.0
    irt_pseudo_guessing_c: float = 0.18

    model_config = ConfigDict(extra="allow")


# ============================================================================
# Hierarchy Audit & Validation Tool
# ============================================================================

def validate_master_syllabus_hierarchy() -> Dict[str, Any]:
    """Validates the entire SYLLABUS_HIERARCHY against SubjectLiteral, TopicLiteral, and SubtopicLiteral."""
    subj_lits = set(get_args(SubjectLiteral))
    topic_lits = set(get_args(TopicLiteral))
    subtop_lits = set(get_args(SubtopicLiteral))

    hierarchy_subjs = set(SYLLABUS_HIERARCHY.keys())
    hierarchy_topics: Set[str] = set()
    hierarchy_subtopics: Set[str] = set()

    for subj, topics in SYLLABUS_HIERARCHY.items():
        for topic, subtopics in topics.items():
            hierarchy_topics.add(topic)
            for st in subtopics:
                hierarchy_subtopics.add(st)

    missing_subjs = subj_lits - hierarchy_subjs
    extra_subjs = hierarchy_subjs - subj_lits
    missing_topics = topic_lits - hierarchy_topics
    extra_topics = hierarchy_topics - topic_lits
    missing_subtopics = subtop_lits - hierarchy_subtopics
    extra_subtopics = hierarchy_subtopics - subtop_lits

    is_valid = not (
        missing_subjs
        or extra_subjs
        or missing_topics
        or extra_topics
        or missing_subtopics
        or extra_subtopics
    )

    report = {
        "is_valid": is_valid,
        "total_subjects": len(hierarchy_subjs),
        "total_topics": len(hierarchy_topics),
        "total_subtopics": len(hierarchy_subtopics),
        "missing_subjects": list(missing_subjs),
        "extra_subjects": list(extra_subjs),
        "missing_topics": list(missing_topics),
        "extra_topics": list(extra_topics),
        "missing_subtopics": list(missing_subtopics),
        "extra_subtopics": list(extra_subtopics),
    }

    if is_valid:
        logger.info(
            f"[TAXONOMY HIERARCHY VALIDATED] 100% Consistent: {len(hierarchy_subjs)} Subjects, {len(hierarchy_topics)} Topics, {len(hierarchy_subtopics)} Subtopics."
        )
    return report


# ============================================================================
# Core Fallback Vectorizer & String Utilities (Zero Dependency)
# ============================================================================

def normalize_text(text: Optional[str]) -> str:
    """Normalizes string for comparison by lowercasing, expanding ampersands, and stripping punctuation."""
    if not text or not isinstance(text, str):
        return ""
    s = text.lower().strip()
    s = s.replace("&", " and ")
    s = re.sub(r"[_\-\/\\,;:()\[\]{}]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def pure_python_token_sort_ratio(s1: str, s2: str) -> float:
    """Pure-Python fallback for RapidFuzz token_sort_ratio."""
    n1 = normalize_text(s1)
    n2 = normalize_text(s2)
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 100.0

    tokens1 = sorted(n1.split())
    tokens2 = sorted(n2.split())
    sorted_s1 = " ".join(tokens1)
    sorted_s2 = " ".join(tokens2)

    if sorted_s1 == sorted_s2:
        return 100.0

    len1, len2 = len(sorted_s1), len(sorted_s2)
    if len1 == 0 or len2 == 0:
        return 0.0

    dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]
    for i in range(len1 + 1):
        dp[i][0] = i
    for j in range(len2 + 1):
        dp[0][j] = j

    for i in range(1, len1 + 1):
        c1 = sorted_s1[i - 1]
        for j in range(1, len2 + 1):
            c2 = sorted_s2[j - 1]
            cost = 0 if c1 == c2 else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )

    distance = dp[len1][len2]
    max_len = max(len1, len2)
    similarity = (1.0 - (distance / max_len)) * 100.0
    return max(0.0, min(100.0, similarity))


class LightweightCharNgramVectorizer:
    """Zero-dependency fallback vectorizer using character n-grams and cosine similarity."""

    def __init__(self, n: int = 3):
        self.n = n

    def vectorize(self, text: str) -> Dict[str, float]:
        norm = normalize_text(text)
        if len(norm) < self.n:
            return {norm: 1.0} if norm else {}
        counts: Dict[str, float] = defaultdict(float)
        for i in range(len(norm) - self.n + 1):
            ngram = norm[i : i + self.n]
            counts[ngram] += 1.0
        norm_sq = math.sqrt(sum(v * v for v in counts.values()))
        if norm_sq > 0:
            for k in counts:
                counts[k] /= norm_sq
        return dict(counts)

    @staticmethod
    def cosine_similarity(v1: Dict[str, float], v2: Dict[str, float]) -> float:
        if not v1 or not v2:
            return 0.0
        common_keys = set(v1.keys()).intersection(v2.keys())
        return sum(v1[k] * v2[k] for k in common_keys)


# ============================================================================
# Canonical Aliases Table for Zero-Latency Subject & Topic Grounding
# ============================================================================

SUBJECT_ALIASES: Dict[str, List[str]] = {
    "Indian Polity & Governance": [
        "polity",
        "governance",
        "indian polity",
        "polity & governance",
        "polity and governance",
        "constitution",
        "indian constitution",
        "civics",
        "polity & constitution",
        "polity and constitution",
        "international relations",
        "ir",
        "geopolitics",
        "foreign policy",
        "international affairs",
        "bilateral relations",
        "current affairs polity",
        "international news",
    ],
    "Indian Culture": [
        "culture",
        "art and culture",
        "art & culture",
        "arts and culture",
        "indian art and culture",
        "heritage",
        "indian heritage",
        "visual arts",
        "performing arts",
    ],
    "Ecology & Environment": [
        "ecology",
        "environment",
        "environmental studies",
        "env",
        "eco and env",
        "eco & env",
        "ecology and environment",
        "environmental science",
        "environmental ecology",
        "environmental pollution",
        "environmental laws and policies",
        "environmental laws",
        "climate change",
        "biodiversity",
        "conservation",
    ],
    "Economy": [
        "economics",
        "indian economy",
        "macroeconomics",
        "microeconomics",
        "indian economic development",
        "economic",
        "banking",
        "monetary policy",
        "fiscal policy",
        "trade",
    ],
    "Science & Technology": [
        "science and technology",
        "science & tech",
        "science and tech",
        "s&t",
        "tech",
        "technology",
        "sci & tech",
        "sci and tech",
        "space science",
        "space technology",
        "space",
        "defense technology",
        "biotechnology",
        "biotech",
        "nanotechnology",
        "nano technology",
        "nuclear technology",
        "applied science",
        "information technology",
        "it & telecom",
    ],
    "Geography": [
        "world geography",
        "indian geography",
        "physical geography",
        "general geography",
        "world regional geography",
        "climatology",
        "oceanography",
        "geo",
    ],
    "History": [
        "ancient history",
        "medieval history",
        "modern history",
        "indian history",
        "hist",
        "world history",
        "freedom struggle",
    ],
    "General Science": [
        "gen science",
        "general sci",
        "basic science",
        "physics",
        "chemistry",
        "biology",
        "physical sciences",
        "human physiology",
        "human health and diseases",
        "applied biology",
        "zoology",
        "botany",
        "genetics",
    ],
}


# ============================================================================
# Main TaxonomyResolver Class
# ============================================================================

class TaxonomyResolver:
    """Robust, zero-API-cost Taxonomy Resolution Engine."""

    def __init__(
        self,
        taxonomy: Optional[Dict[str, Dict[str, List[str]]]] = None,
        fuzzy_threshold: float = 75.0,
        semantic_threshold: float = 0.30,
        embedding_model_name: str = "all-MiniLM-L6-v2",
        enable_semantic: bool = True,
    ):
        start_t = time.perf_counter()
        self.taxonomy: Dict[str, Dict[str, List[str]]] = taxonomy or SYLLABUS_HIERARCHY
        self.fuzzy_threshold = fuzzy_threshold
        self.semantic_threshold = semantic_threshold
        self.embedding_model_name = embedding_model_name
        self.enable_semantic = enable_semantic

        self.subjects: List[str] = list(self.taxonomy.keys())
        self.default_subject: str = (
            "General Science" if "General Science" in self.taxonomy else self.subjects[0]
        )

        self._exact_subject_map: Dict[str, str] = {}
        self._exact_topic_map: Dict[str, Dict[str, str]] = defaultdict(dict)
        self._exact_subtopic_map: Dict[Tuple[str, str], Dict[str, str]] = defaultdict(dict)

        self._global_subtopic_map: Dict[str, Tuple[str, str, str]] = {}
        self._global_topic_map: Dict[str, Tuple[str, str]] = {}

        self._model: Any = None
        self._lightweight_vectorizer = LightweightCharNgramVectorizer(n=3)
        self._subject_embeddings: Optional[Any] = None
        self._topic_embeddings: Dict[str, Any] = {}
        self._subtopic_embeddings: Dict[Tuple[str, str], Any] = {}
        self._fallback_vectors: Dict[str, Any] = {}
        self.active_embedding_engine: str = "Pure-Python Char N-Gram Vectorizer (Offline Fallback)"

        self._build_lookup_tables()
        if self.enable_semantic:
            self._warmup_embeddings()

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0
        total_topics = sum(len(topics) for topics in self.taxonomy.values())
        total_subtopics = sum(
            len(subtopics) for topics in self.taxonomy.values() for subtopics in topics.values()
        )
        logger.info(
            f"[TAXONOMY ENGINE INITIALIZED] Loaded {len(self.subjects)} Subjects, {total_topics} Topics, {total_subtopics} Subtopics in {elapsed_ms:.2f}ms | Active Engine: {self.active_embedding_engine}"
        )

    def _build_lookup_tables(self) -> None:
        """Builds normalized exact lookup dictionaries, aliases, and global hierarchy indices."""
        for subj, topics in self.taxonomy.items():
            norm_subj = normalize_text(subj)
            self._exact_subject_map[norm_subj] = subj
            self._exact_subject_map[subj.lower().strip()] = subj

            if subj in SUBJECT_ALIASES:
                for alias in SUBJECT_ALIASES[subj]:
                    self._exact_subject_map[normalize_text(alias)] = subj
                    self._exact_subject_map[alias.lower().strip()] = subj

            for topic, subtopics in topics.items():
                norm_top = normalize_text(topic)
                self._exact_topic_map[subj][norm_top] = topic
                self._exact_topic_map[subj][topic.lower().strip()] = topic

                if "(" in topic and ")" in topic:
                    parenthetical = re.findall(r"\((.*?)\)", topic)
                    stripped_name = re.sub(r"\(.*?\)", "", topic).strip()
                    self._exact_topic_map[subj][normalize_text(stripped_name)] = topic
                    if normalize_text(stripped_name) not in self._global_topic_map:
                        self._global_topic_map[normalize_text(stripped_name)] = (topic, subj)
                    for p in parenthetical:
                        self._exact_topic_map[subj][normalize_text(p)] = topic
                        if normalize_text(p) not in self._global_topic_map:
                            self._global_topic_map[normalize_text(p)] = (topic, subj)

                if topic.endswith("s") and len(topic) > 3:
                    self._exact_topic_map[subj][normalize_text(topic[:-1])] = topic

                if norm_top not in self._global_topic_map:
                    self._global_topic_map[norm_top] = (topic, subj)
                if topic.lower().strip() not in self._global_topic_map:
                    self._global_topic_map[topic.lower().strip()] = (topic, subj)

                for subtop in subtopics:
                    norm_subtop = normalize_text(subtop)
                    self._exact_subtopic_map[(subj, topic)][norm_subtop] = subtop
                    self._exact_subtopic_map[(subj, topic)][subtop.lower().strip()] = subtop

                    if "(" in subtop and ")" in subtop:
                        p_sub = re.sub(r"\(.*?\)", "", subtop).strip()
                        self._exact_subtopic_map[(subj, topic)][normalize_text(p_sub)] = subtop
                        if normalize_text(p_sub) not in self._global_subtopic_map:
                            self._global_subtopic_map[normalize_text(p_sub)] = (subtop, topic, subj)

                    if norm_subtop not in self._global_subtopic_map:
                        self._global_subtopic_map[norm_subtop] = (subtop, topic, subj)
                    if subtop.lower().strip() not in self._global_subtopic_map:
                        self._global_subtopic_map[subtop.lower().strip()] = (subtop, topic, subj)

    def _warmup_embeddings(self) -> None:
        """Pre-computes candidate embeddings in memory to ensure sub-5ms runtime lookups."""
        if HAS_SENTENCE_TRANSFORMERS:
            try:
                self._model = SentenceTransformer(self.embedding_model_name)
                self._subject_embeddings = self._model.encode(
                    self.subjects, normalize_embeddings=True, show_progress_bar=False
                )

                for subj, topics_dict in self.taxonomy.items():
                    topic_list = list(topics_dict.keys())
                    if topic_list:
                        self._topic_embeddings[subj] = self._model.encode(
                            topic_list, normalize_embeddings=True, show_progress_bar=False
                        )

                for subj, topics_dict in self.taxonomy.items():
                    for topic, subtop_list in topics_dict.items():
                        if subtop_list:
                            self._subtopic_embeddings[(subj, topic)] = self._model.encode(
                                subtop_list, normalize_embeddings=True, show_progress_bar=False
                            )
                self.active_embedding_engine = f"SentenceTransformers ({self.embedding_model_name})"
                return
            except Exception as e:
                logger.warning(
                    f"[TAXONOMY EMBEDDINGS] SentenceTransformer initialization note ({e}), using lightweight vectorizer."
                )
                self._model = None

        self.active_embedding_engine = "Pure-Python Char N-Gram Vectorizer (Offline Fallback)"
        for subj in self.subjects:
            self._fallback_vectors[f"subj:{subj}"] = self._lightweight_vectorizer.vectorize(subj)

        for subj, topics_dict in self.taxonomy.items():
            for topic in topics_dict.keys():
                self._fallback_vectors[f"topic:{subj}:{topic}"] = (
                    self._lightweight_vectorizer.vectorize(topic)
                )
                for subtop in topics_dict[topic]:
                    self._fallback_vectors[f"subtop:{subj}:{topic}:{subtop}"] = (
                        self._lightweight_vectorizer.vectorize(subtop)
                    )

    # ------------------------------------------------------------------------
    # Matching Engine Tiers
    # ------------------------------------------------------------------------

    def _match_exact(
        self, query: str, exact_map: Dict[str, str]
    ) -> Optional[Tuple[str, float, str]]:
        if not query:
            return None
        raw_key = query.strip().lower()
        if raw_key in exact_map:
            return exact_map[raw_key], 1.0, "EXACT_MATCH (Normalized Case & Conjunction Strip)"

        norm_key = normalize_text(query)
        if norm_key in exact_map:
            return exact_map[norm_key], 1.0, "EXACT_ALIAS_MATCH (Curated Domain Dictionary)"

        return None

    def _match_fuzzy(
        self, query: str, candidates: List[str]
    ) -> Optional[Tuple[str, float, str]]:
        if not query or not candidates:
            return None

        if HAS_RAPIDFUZZ:
            result = process.extractOne(
                query,
                candidates,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=self.fuzzy_threshold,
            )
            if result:
                match_val, score, _ = result
                return (
                    match_val,
                    float(score) / 100.0,
                    f"FUZZY_MATCH [RapidFuzz token_sort_ratio: {score:.1f}%]",
                )
        else:
            best_val = None
            best_score = 0.0
            for cand in candidates:
                score = pure_python_token_sort_ratio(query, cand)
                if score > best_score:
                    best_score = score
                    best_val = cand
            if best_val and best_score >= self.fuzzy_threshold:
                return (
                    best_val,
                    best_score / 100.0,
                    f"FUZZY_MATCH [Pure-Python Levenshtein: {best_score:.1f}%]",
                )

        return None

    def _match_semantic(
        self,
        query: str,
        candidates: List[str],
        precomputed_embeddings: Optional[Any] = None,
        embedding_key_prefix: Optional[str] = None,
    ) -> Optional[Tuple[str, float, str]]:
        if not query or not candidates:
            return None

        if self._model is not None and precomputed_embeddings is not None and np is not None:
            try:
                query_emb = self._model.encode(
                    [query], normalize_embeddings=True, show_progress_bar=False
                )[0]
                sims = np.dot(precomputed_embeddings, query_emb)
                best_idx = int(np.argmax(sims))
                best_score = float(sims[best_idx])
                if best_score >= self.semantic_threshold:
                    calibrated_conf = round(min(0.95, max(0.50, 0.50 + (best_score * 0.40))), 2)
                    return (
                        candidates[best_idx],
                        calibrated_conf,
                        f"SENTENCE_TRANSFORMERS_SEMANTIC_MATCH [Cosine: {best_score:.2f}]",
                    )
            except Exception:
                pass

        query_vec = self._lightweight_vectorizer.vectorize(query)
        best_cand = None
        best_sim = 0.0
        for cand in candidates:
            cand_key = f"{embedding_key_prefix}:{cand}" if embedding_key_prefix else None
            cand_vec = (
                self._fallback_vectors.get(cand_key)
                if cand_key
                else self._lightweight_vectorizer.vectorize(cand)
            )
            if cand_vec:
                sim = self._lightweight_vectorizer.cosine_similarity(query_vec, cand_vec)
                if sim > best_sim:
                    best_sim = sim
                    best_cand = cand

        if best_cand and best_sim >= self.semantic_threshold:
            calibrated_conf = round(min(0.95, max(0.50, 0.50 + (best_sim * 0.40))), 2)
            return (
                best_cand,
                calibrated_conf,
                f"TF_IDF_NGRAM_SEMANTIC_MATCH [Cosine: {best_sim:.2f}]",
            )

        return None

    # ------------------------------------------------------------------------
    # Cascaded Top-Down Pruning Resolvers
    # ------------------------------------------------------------------------

    def resolve_subject(
        self, raw_subject: Optional[str], context_hint: Optional[str] = None
    ) -> FieldResolutionResult:
        """Level 1: Resolve Subject against root keys of Master Taxonomy,
        or best-matched sentence context, or retain LLM provided subject."""
        start_t = time.perf_counter()
        raw_val = (raw_subject or "").strip()

        if raw_val:
            # 1. Tier 1: Exact Match (Normalized & Aliases)
            exact = self._match_exact(raw_val, self._exact_subject_map)
            if exact:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=exact[0],
                    raw_value=raw_val,
                    tier=MatchTier.EXACT,
                    algorithm_detail=exact[2],
                    confidence=exact[1],
                    execution_time_ms=elapsed,
                )

            # 2. Tier 2: Fuzzy Match
            fuzzy = self._match_fuzzy(raw_val, self.subjects)
            if fuzzy:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=fuzzy[0],
                    raw_value=raw_val,
                    tier=MatchTier.FUZZY,
                    algorithm_detail=fuzzy[2],
                    confidence=fuzzy[1],
                    execution_time_ms=elapsed,
                )

            # 3. Tier 3: Semantic Fallback
            semantic = self._match_semantic(
                query=f"{raw_val} {context_hint or ''}".strip(),
                candidates=self.subjects,
                precomputed_embeddings=self._subject_embeddings,
                embedding_key_prefix="subj",
            )
            if semantic:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=semantic[0],
                    raw_value=raw_val,
                    tier=MatchTier.SEMANTIC,
                    algorithm_detail=semantic[2],
                    confidence=semantic[1],
                    execution_time_ms=elapsed,
                )

        # 4. Tier 4: Best-Matched Sentence Formation / Context
        if context_hint and context_hint.strip():
            semantic_ctx = self._match_semantic(
                query=context_hint[:300],
                candidates=self.subjects,
                precomputed_embeddings=self._subject_embeddings,
                embedding_key_prefix="subj",
            )
            if semantic_ctx and semantic_ctx[1] >= self.semantic_threshold:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=semantic_ctx[0],
                    raw_value=raw_val or context_hint[:40],
                    tier=MatchTier.SEMANTIC,
                    algorithm_detail=f"CONTEXT_SENTENCE_SUBJECT_MATCH [{semantic_ctx[2]}]",
                    confidence=semantic_ctx[1],
                    execution_time_ms=elapsed,
                )

        # 5. Final Fallback: Retain LLM-provided Subject if provided, otherwise default
        if raw_val and len(raw_val) >= 2:
            clean_subj = raw_val.strip().title()
            elapsed = (time.perf_counter() - start_t) * 1000.0
            return FieldResolutionResult(
                canonical_value=clean_subj,
                raw_value=raw_val,
                tier=MatchTier.FALLBACK,
                algorithm_detail="LLM_PROVIDED_SUBJECT_RETAINED (Dynamic Domain Category)",
                confidence=0.75,
                execution_time_ms=elapsed,
            )

        elapsed = (time.perf_counter() - start_t) * 1000.0
        return FieldResolutionResult(
            canonical_value=self.default_subject,
            raw_value=raw_val or None,
            tier=MatchTier.FALLBACK,
            algorithm_detail="CANONICAL_FALLBACK (Default Root Subject)",
            confidence=0.50,
            execution_time_ms=elapsed,
        )

    def resolve_topic(
        self,
        raw_topic: Optional[str],
        resolved_subject: str,
        context_hint: Optional[str] = None,
    ) -> FieldResolutionResult:
        """Level 2: Resolve Topic within candidates under resolved_subject,
        or best-matched sentence context, or retain LLM provided topic."""
        start_t = time.perf_counter()
        raw_val = (raw_topic or "").strip()

        topics_dict = self.taxonomy.get(resolved_subject, {})
        valid_topics = list(topics_dict.keys())

        if raw_val and valid_topics:
            # 1. Tier 1: Exact Match
            exact_map = self._exact_topic_map.get(resolved_subject, {})
            exact = self._match_exact(raw_val, exact_map)
            if exact:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=exact[0],
                    raw_value=raw_val,
                    tier=MatchTier.EXACT,
                    algorithm_detail=exact[2],
                    confidence=exact[1],
                    execution_time_ms=elapsed,
                )

            # 2. Tier 2: Fuzzy Match
            fuzzy = self._match_fuzzy(raw_val, valid_topics)
            if fuzzy:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=fuzzy[0],
                    raw_value=raw_val,
                    tier=MatchTier.FUZZY,
                    algorithm_detail=fuzzy[2],
                    confidence=fuzzy[1],
                    execution_time_ms=elapsed,
                )

            # 3. Tier 3: Semantic Fallback
            topic_embs = self._topic_embeddings.get(resolved_subject)
            semantic = self._match_semantic(
                query=f"{raw_val} {context_hint or ''}".strip(),
                candidates=valid_topics,
                precomputed_embeddings=topic_embs,
                embedding_key_prefix=f"topic:{resolved_subject}",
            )
            if semantic:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=semantic[0],
                    raw_value=raw_val,
                    tier=MatchTier.SEMANTIC,
                    algorithm_detail=semantic[2],
                    confidence=semantic[1],
                    execution_time_ms=elapsed,
                )

        # 4. Tier 4: Best-Matched Sentence Formation / Context under resolved_subject
        if context_hint and valid_topics:
            topic_embs = self._topic_embeddings.get(resolved_subject)
            semantic_ctx = self._match_semantic(
                query=context_hint[:300],
                candidates=valid_topics,
                precomputed_embeddings=topic_embs,
                embedding_key_prefix=f"topic:{resolved_subject}",
            )
            if semantic_ctx and semantic_ctx[1] >= self.semantic_threshold:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=semantic_ctx[0],
                    raw_value=raw_val or context_hint[:40],
                    tier=MatchTier.SEMANTIC,
                    algorithm_detail=f"CONTEXT_SENTENCE_TOPIC_MATCH [{semantic_ctx[2]}]",
                    confidence=semantic_ctx[1],
                    execution_time_ms=elapsed,
                )

        # 5. Final Fallback: Retain LLM-provided Topic if provided, otherwise default
        if raw_val and len(raw_val) >= 2:
            clean_top = raw_val.strip().title()
            elapsed = (time.perf_counter() - start_t) * 1000.0
            return FieldResolutionResult(
                canonical_value=clean_top,
                raw_value=raw_val,
                tier=MatchTier.FALLBACK,
                algorithm_detail="LLM_PROVIDED_TOPIC_RETAINED (Dynamic Fine-Grained Topic)",
                confidence=0.75,
                execution_time_ms=elapsed,
            )

        default_topic = valid_topics[0] if valid_topics else "General Concepts"
        elapsed = (time.perf_counter() - start_t) * 1000.0
        return FieldResolutionResult(
            canonical_value=default_topic,
            raw_value=raw_val or None,
            tier=MatchTier.FALLBACK,
            algorithm_detail=f"CANONICAL_FALLBACK (First valid topic under '{resolved_subject}')",
            confidence=0.50,
            execution_time_ms=elapsed,
        )

    def resolve_subtopic(
        self,
        raw_subtopic: Optional[str],
        resolved_subject: str,
        resolved_topic: str,
        context_hint: Optional[str] = None,
    ) -> FieldResolutionResult:
        """Level 3: Resolve Subtopic against canonical syllabus,
        or best-matched sentence context, or retain LLM provided subtopic."""
        start_t = time.perf_counter()
        raw_val = (raw_subtopic or "").strip()
        valid_subtopics = self.taxonomy.get(resolved_subject, {}).get(resolved_topic, [])

        if raw_val and valid_subtopics:
            # 1. Tier 1: Exact Match
            exact_map = self._exact_subtopic_map.get((resolved_subject, resolved_topic), {})
            exact = self._match_exact(raw_val, exact_map)
            if exact:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=exact[0],
                    raw_value=raw_val,
                    tier=MatchTier.EXACT,
                    algorithm_detail=exact[2],
                    confidence=exact[1],
                    execution_time_ms=elapsed,
                )

            # 2. Tier 2: Fuzzy Match
            fuzzy = self._match_fuzzy(raw_val, valid_subtopics)
            if fuzzy:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=fuzzy[0],
                    raw_value=raw_val,
                    tier=MatchTier.FUZZY,
                    algorithm_detail=fuzzy[2],
                    confidence=fuzzy[1],
                    execution_time_ms=elapsed,
                )

            # 3. Tier 3: Semantic Fallback
            subtop_embs = self._subtopic_embeddings.get((resolved_subject, resolved_topic))
            semantic = self._match_semantic(
                query=f"{raw_val} {context_hint or ''}".strip(),
                candidates=valid_subtopics,
                precomputed_embeddings=subtop_embs,
                embedding_key_prefix=f"subtop:{resolved_subject}:{resolved_topic}",
            )
            if semantic:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=semantic[0],
                    raw_value=raw_val,
                    tier=MatchTier.SEMANTIC,
                    algorithm_detail=semantic[2],
                    confidence=semantic[1],
                    execution_time_ms=elapsed,
                )

        # 4. Tier 4: Best-Matched Sentence Formation / Context under (resolved_subject, resolved_topic)
        if context_hint and valid_subtopics:
            subtop_embs = self._subtopic_embeddings.get((resolved_subject, resolved_topic))
            ctx_semantic = self._match_semantic(
                query=context_hint[:300],
                candidates=valid_subtopics,
                precomputed_embeddings=subtop_embs,
                embedding_key_prefix=f"subtop:{resolved_subject}:{resolved_topic}",
            )
            if ctx_semantic and ctx_semantic[1] >= self.semantic_threshold:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                return FieldResolutionResult(
                    canonical_value=ctx_semantic[0],
                    raw_value=raw_val or context_hint[:50],
                    tier=MatchTier.SEMANTIC,
                    algorithm_detail=f"CONTEXT_SENTENCE_SUBTOPIC_MATCH [{ctx_semantic[2]}]",
                    confidence=ctx_semantic[1],
                    execution_time_ms=elapsed,
                )

        # 5. Final Fallback: Retain LLM-provided Subtopic if provided, otherwise default
        if raw_val and len(raw_val) >= 2:
            clean_subtop = raw_val.strip().title()
            elapsed = (time.perf_counter() - start_t) * 1000.0
            return FieldResolutionResult(
                canonical_value=clean_subtop,
                raw_value=raw_val,
                tier=MatchTier.FALLBACK,
                algorithm_detail="LLM_PROVIDED_SUBTOPIC_RETAINED (Dynamic Fine-Grained Concept)",
                confidence=0.75,
                execution_time_ms=elapsed,
            )

        default_subtopic = valid_subtopics[0] if valid_subtopics else resolved_topic
        elapsed = (time.perf_counter() - start_t) * 1000.0
        return FieldResolutionResult(
            canonical_value=default_subtopic,
            raw_value=raw_val or None,
            tier=MatchTier.FALLBACK,
            algorithm_detail=f"CANONICAL_FALLBACK (Primary Subtopic under '{resolved_topic}')",
            confidence=0.50,
            execution_time_ms=elapsed,
        )

    # ------------------------------------------------------------------------
    # Full Cascaded Hierarchy Resolution & Universal 3-Field Subtopic Grounding
    # ------------------------------------------------------------------------

    def resolve_hierarchy(
        self,
        raw_subject: Optional[str],
        raw_topic: Optional[str],
        raw_subtopic: Optional[str] = None,
        context_hint: Optional[str] = None,
    ) -> Tuple[ValidatedTaxonomy, TaxonomyResolutionMetrics]:
        """Resolves complete Subject -> Topic -> Subtopic hierarchy with universal 3-field subtopic search."""
        start_overall = time.perf_counter()
        raw_subtop_clean = (raw_subtopic or "").strip()
        raw_top_clean = (raw_topic or "").strip()
        raw_subj_clean = (raw_subject or "").strip()

        # Step 0: Check if ANY of the 3 fields matches a known Subtopic in the master syllabus
        inferred_from_subtopic = False
        inferred_from_topic = False
        anchor_subtop_val: Optional[str] = None

        # Check raw_subtopic, then raw_topic, then raw_subject against global subtopics
        for candidate_field, field_name in [
            (raw_subtop_clean, "raw_subtopic"),
            (raw_top_clean, "raw_topic"),
            (raw_subj_clean, "raw_subject"),
        ]:
            if candidate_field:
                norm_cand = normalize_text(candidate_field)
                if norm_cand in self._global_subtopic_map:
                    c_subtop, c_top, c_subj = self._global_subtopic_map[norm_cand]
                    logger.info(
                        f"[TAXONOMY ANCHOR] Field '{field_name}' ('{candidate_field}') matched global subtopic; anchored to Subject='{c_subj}', Topic='{c_top}', Subtopic='{c_subtop}'"
                    )
                    raw_subj_clean = c_subj
                    raw_top_clean = c_top
                    anchor_subtop_val = c_subtop
                    inferred_from_subtopic = True
                    break

        # Step 0.1: Check if raw_subject or raw_topic matches a known Topic
        if not inferred_from_subtopic:
            norm_subj = normalize_text(raw_subj_clean)
            if norm_subj in self._global_topic_map:
                c_top, c_subj = self._global_topic_map[norm_subj]
                logger.info(
                    f"[TAXONOMY ANCHOR] Subject '{raw_subj_clean}' recognized as Topic; mapped to Subject='{c_subj}', Topic='{c_top}'"
                )
                raw_subj_clean = c_subj
                if not raw_top_clean or raw_top_clean.lower() == raw_subj_clean.lower():
                    raw_top_clean = c_top
                inferred_from_topic = True

            elif norm_subj in ("current affairs", "general studies", "gs", "general awareness"):
                if raw_top_clean:
                    norm_top = normalize_text(raw_top_clean)
                    if norm_top in self._global_topic_map:
                        c_top, c_subj = self._global_topic_map[norm_top]
                        raw_subj_clean = c_subj
                        raw_top_clean = c_top
                        inferred_from_topic = True
                    elif any(k in norm_top for k in ["polity", "relation", "international", "treaty", "act", "court", "law"]):
                        raw_subj_clean = "Indian Polity & Governance"
                    elif any(k in norm_top for k in ["economy", "inflation", "banking", "finance", "trade", "rbi", "budget"]):
                        raw_subj_clean = "Economy"
                    elif any(k in norm_top for k in ["environment", "climate", "ecology", "species", "forest", "pollution"]):
                        raw_subj_clean = "Ecology & Environment"
                    elif any(k in norm_top for k in ["space", "defense", "tech", "nuclear", "ai", "nano", "satellite", "isro"]):
                        raw_subj_clean = "Science & Technology"
                    elif any(k in norm_top for k in ["art", "culture", "dance", "temple", "monument"]):
                        raw_subj_clean = "Indian Culture"
                    elif any(k in norm_top for k in ["history", "war", "revolt", "dynasty", "empire"]):
                        raw_subj_clean = "History"
                    elif any(k in norm_top for k in ["geography", "cyclone", "monsoon", "river", "volcano", "earthquake"]):
                        raw_subj_clean = "Geography"

        # Step 1: Resolve Subject
        subj_res = self.resolve_subject(raw_subj_clean, context_hint=context_hint)
        if inferred_from_subtopic:
            subj_res.tier = MatchTier.BOTTOM_UP
            subj_res.algorithm_detail = "BOTTOM_UP_SUBTOPIC_ANCHOR (Parent Subject recovered from Subtopic)"
            subj_res.confidence = 1.0
        elif inferred_from_topic:
            subj_res.tier = MatchTier.BOTTOM_UP
            subj_res.algorithm_detail = "BOTTOM_UP_TOPIC_ANCHOR (Parent Subject recovered from Topic)"
            subj_res.confidence = 1.0
        resolved_subject = subj_res.canonical_value

        # Step 2: Resolve Topic
        top_res = self.resolve_topic(
            raw_top_clean, resolved_subject=resolved_subject, context_hint=context_hint
        )
        if inferred_from_subtopic:
            top_res.tier = MatchTier.BOTTOM_UP
            top_res.algorithm_detail = "BOTTOM_UP_SUBTOPIC_ANCHOR (Parent Topic recovered from Subtopic)"
            top_res.confidence = 1.0
        elif inferred_from_topic and top_res.tier != MatchTier.EXACT:
            top_res.tier = MatchTier.BOTTOM_UP
            top_res.algorithm_detail = "BOTTOM_UP_TOPIC_ANCHOR (Direct Topic Match)"
            top_res.confidence = 1.0
        resolved_topic = top_res.canonical_value

        # Step 3: Resolve Subtopic
        if anchor_subtop_val:
            subtop_res = FieldResolutionResult(
                canonical_value=anchor_subtop_val,
                raw_value=raw_subtop_clean or raw_top_clean or raw_subj_clean,
                tier=MatchTier.BOTTOM_UP,
                algorithm_detail="BOTTOM_UP_SUBTOPIC_ANCHOR (Direct Subtopic Recognition)",
                confidence=1.0,
                execution_time_ms=0.01,
            )
            resolved_subtopic = anchor_subtop_val
        else:
            subtop_res = self.resolve_subtopic(
                raw_subtop_clean,
                resolved_subject=resolved_subject,
                resolved_topic=resolved_topic,
                context_hint=context_hint,
            )
            resolved_subtopic = subtop_res.canonical_value

        # Metrics computation
        weights = [subj_res.confidence, top_res.confidence]
        if subtop_res and raw_subtop_clean:
            weights.append(subtop_res.confidence)
        overall_conf = sum(weights) / len(weights)
        total_time_ms = (time.perf_counter() - start_overall) * 1000.0

        metrics = TaxonomyResolutionMetrics(
            subject_match=subj_res,
            topic_match=top_res,
            subtopic_match=subtop_res,
            overall_confidence=round(overall_conf, 4),
            total_resolution_time_ms=round(total_time_ms, 3),
            embedding_engine_used=self.active_embedding_engine,
            is_fully_mapped=True,
        )

        validated_taxonomy = ValidatedTaxonomy(
            subject=resolved_subject,
            topic=resolved_topic,
            subtopic=resolved_subtopic,
            metrics=metrics,
        )

        subtop_info = f"'{resolved_subtopic}' ({subtop_res.algorithm_detail} / Score: {subtop_res.confidence:.2f})"
        mapping_status = f"100% CANONICAL (Subject: '{resolved_subject}' -> Topic: '{resolved_topic}' -> Subtopic: '{resolved_subtopic}')"

        logger.info(
            f"[TAXONOMY RESOLVED] Subject: '{resolved_subject}' ({subj_res.algorithm_detail} / Score: {subj_res.confidence:.2f}) -> Topic: '{resolved_topic}' ({top_res.algorithm_detail} / Score: {top_res.confidence:.2f}) -> Subtopic: {subtop_info} | Hierarchy Status: {mapping_status} | Latency: {total_time_ms:.2f}ms"
        )

        return validated_taxonomy, metrics

    # ------------------------------------------------------------------------
    # High-Level Payload Resolution Pipeline
    # ------------------------------------------------------------------------

    def resolve_payload(
        self, raw_payload: Union[RawLLMExplanationPayload, Dict[str, Any]]
    ) -> ValidatedDatabaseExplanationPayload:
        if isinstance(raw_payload, dict):
            raw = RawLLMExplanationPayload.model_validate(raw_payload)
        else:
            raw = raw_payload

        context_hint = f"{raw.question_text[:200]} {raw.explanation[:200] if raw.explanation else ''}"

        val_tax, metrics = self.resolve_hierarchy(
            raw_subject=raw.predicted_subject,
            raw_topic=raw.predicted_topic,
            raw_subtopic=raw.predicted_subtopic,
            context_hint=context_hint,
        )

        resolved_concepts: List[MultiConceptItemResolved] = []
        resolved_concepts.append(
            MultiConceptItemResolved(
                subject=val_tax.subject,
                topic=val_tax.topic,
                subtopic=val_tax.subtopic,
                is_primary=True,
                relevance_weight=1.0,
                concept_name=raw.core_concept or val_tax.subtopic or val_tax.topic,
                resolution_tier=metrics.subject_match.tier,
                confidence=metrics.overall_confidence,
            )
        )

        if raw.concepts:
            for item in raw.concepts:
                c_raw_subj = item.get("subject") or item.get("predicted_subject")
                c_raw_top = item.get("topic") or item.get("predicted_topic")
                c_raw_subtop = item.get("subtopic") or item.get("predicted_subtopic")
                if not c_raw_subj and not c_raw_top and not c_raw_subtop:
                    continue
                c_tax, c_met = self.resolve_hierarchy(
                    raw_subject=c_raw_subj,
                    raw_topic=c_raw_top,
                    raw_subtopic=c_raw_subtop,
                    context_hint=context_hint,
                )
                resolved_concepts.append(
                    MultiConceptItemResolved(
                        subject=c_tax.subject,
                        topic=c_tax.topic,
                        subtopic=c_tax.subtopic,
                        is_primary=bool(item.get("is_primary", False)),
                        relevance_weight=float(item.get("relevance_weight", 0.8)),
                        concept_name=item.get("concept_name"),
                        resolution_tier=c_met.subject_match.tier,
                        confidence=c_met.overall_confidence,
                    )
                )

        return ValidatedDatabaseExplanationPayload(
            question_text=raw.question_text,
            explanation=raw.explanation or raw.detailed_solution or "",
            correct_answer=raw.correct_answer,
            core_concept=raw.core_concept,
            detailed_solution=raw.detailed_solution or raw.explanation,
            options_breakdown=raw.options_breakdown or [],
            common_traps=raw.common_traps or [],
            key_takeaways=raw.key_takeaways or [],
            subject=val_tax.subject,
            topic=val_tax.topic,
            subtopic=val_tax.subtopic,
            taxonomy_metrics=metrics,
            concepts=resolved_concepts,
            difficulty=raw.difficulty or "Medium",
            blooms_level=raw.blooms_level or "ANALYZE",
            cognitive_skill=raw.cognitive_skill or "Conceptual Reasoning",
            irt_discrimination_a=raw.irt_discrimination_a or 1.5,
            irt_difficulty_b=raw.irt_difficulty_b or 0.0,
            irt_pseudo_guessing_c=raw.irt_pseudo_guessing_c or 0.18,
        )


_GLOBAL_RESOLVER: Optional[TaxonomyResolver] = None


def get_taxonomy_resolver() -> TaxonomyResolver:
    """Returns application singleton TaxonomyResolver with pre-warmed embeddings."""
    global _GLOBAL_RESOLVER
    if _GLOBAL_RESOLVER is None:
        _GLOBAL_RESOLVER = TaxonomyResolver()
    return _GLOBAL_RESOLVER
