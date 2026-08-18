"""Taxonomy Resolution and Validation Pipeline.

Deterministic, zero-API-cost top-down cascaded taxonomy resolver that maps raw LLM
predictions (subject, topic, subtopic) to canonical syllabus literals.

Architecture:
- Level 1: Subject resolved against root keys of Master Taxonomy.
- Level 2: Topic resolved strictly within the resolved Subject.
- Level 3: Subtopic resolved strictly within the resolved Topic.

Cascade Tiers per Level:
- Tier 1: Exact Match (normalized case-insensitive strip & alias comparison, 0ms).
- Tier 2: Fuzzy Match (RapidFuzz token_sort_ratio with threshold >= 80, <1ms).
- Tier 3: Semantic Fallback (Local sentence-transformers cosine similarity with pre-cached embeddings, <3ms).
- Fallback: Deterministic canonical fallback preserving 100% hierarchy integrity.
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
except ImportError:
    HAS_RAPIDFUZZ = False

# Optional SentenceTransformers integration with fallback
try:
    from sentence_transformers import SentenceTransformer  # type: ignore
    import numpy as np  # type: ignore

    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    try:
        import numpy as np  # type: ignore
    except ImportError:
        np = None  # type: ignore


class MatchTier(str, Enum):
    EXACT = "exact"
    FUZZY = "fuzzy"
    SEMANTIC = "semantic"
    BOTTOM_UP = "bottom_up"
    FALLBACK = "fallback"


class FieldResolutionResult(BaseModel):
    """Result of resolving a single taxonomy field (Subject, Topic, or Subtopic)."""

    canonical_value: str = Field(description="Strict canonical value from syllabus taxonomy")
    raw_value: Optional[str] = Field(default=None, description="Original raw prediction string from LLM")
    tier: MatchTier = Field(description="Matching tier utilized (exact, fuzzy, semantic, fallback)")
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score of match (1.0 for exact, 0.8-0.99 for fuzzy, 0.5-0.95 for semantic)",
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
    """Strictly validated taxonomy container guaranteeing 100% hierarchy preservation."""

    subject: str = Field(description="Canonical subject literal")
    topic: str = Field(description="Canonical topic literal valid under subject")
    subtopic: Optional[str] = Field(
        default=None, description="Canonical subtopic literal valid under topic"
    )
    metrics: Optional[TaxonomyResolutionMetrics] = None

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="after")
    def validate_hierarchy_integrity(self) -> "ValidatedTaxonomy":
        """Strictly validates that subject, topic, and subtopic exist in master hierarchy."""
        if self.subject not in SYLLABUS_HIERARCHY:
            raise ValueError(
                f"Subject '{self.subject}' is not a valid SubjectLiteral in SYLLABUS_HIERARCHY."
            )
        valid_topics = SYLLABUS_HIERARCHY[self.subject]
        if self.topic not in valid_topics:
            raise ValueError(
                f"Topic '{self.topic}' is not a valid TopicLiteral under Subject '{self.subject}'."
            )
        if self.subtopic is not None:
            valid_subtopics = valid_topics[self.topic]
            if self.subtopic not in valid_subtopics:
                raise ValueError(
                    f"Subtopic '{self.subtopic}' is not a valid SubtopicLiteral under Subject '{self.subject}' -> Topic '{self.topic}'."
                )
        return self


class RawLLMExplanationPayload(BaseModel):
    """Raw input payload from LLM before taxonomy normalization."""

    question_text: str = Field(description="The question prompt")
    explanation: Optional[str] = Field(default="", description="Detailed answer explanation or solution")
    correct_answer: Optional[str] = Field(default=None, description="Correct option label or value")
    predicted_subject: Optional[str] = Field(
        default=None,
        alias="raw_subject",
        description="Raw subject prediction from LLM e.g. 'history', 'ancient histry'",
    )
    predicted_topic: Optional[str] = Field(
        default=None,
        alias="raw_topic",
        description="Raw topic prediction from LLM e.g. 'Ancient History', 'Vedic Era'",
    )
    predicted_subtopic: Optional[str] = Field(
        default=None,
        alias="raw_subtopic",
        description="Raw subtopic prediction from LLM e.g. 'Rig Vedic Period'",
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
    """Strictly validated database-ready payload adhering to canonical syllabus literals."""

    question_text: str
    explanation: str
    correct_answer: Optional[str] = None
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    options_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
    common_traps: List[str] = Field(default_factory=list)
    key_takeaways: List[str] = Field(default_factory=list)

    # Validated Canonical Taxonomy Fields
    subject: str = Field(description="Strictly valid Subject literal")
    topic: str = Field(description="Strictly valid Topic literal under Subject")
    subtopic: Optional[str] = Field(
        default=None, description="Strictly valid Subtopic literal under Topic"
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

    @model_validator(mode="after")
    def validate_hierarchy_integrity(self) -> "ValidatedDatabaseExplanationPayload":
        """Guarantees persistent payload strictly conforms to SYLLABUS_HIERARCHY."""
        if self.subject not in SYLLABUS_HIERARCHY:
            raise ValueError(f"Invalid Subject '{self.subject}' in database payload.")
        if self.topic not in SYLLABUS_HIERARCHY[self.subject]:
            raise ValueError(
                f"Invalid Topic '{self.topic}' for Subject '{self.subject}' in database payload."
            )
        if self.subtopic is not None and self.subtopic not in SYLLABUS_HIERARCHY[self.subject][self.topic]:
            raise ValueError(
                f"Invalid Subtopic '{self.subtopic}' for Topic '{self.topic}' in database payload."
            )
        return self


# ============================================================================
# Hierarchy Audit & Validation Tool
# ============================================================================

def validate_master_syllabus_hierarchy() -> Dict[str, Any]:
    """Validates the entire SYLLABUS_HIERARCHY against SubjectLiteral, TopicLiteral, and SubtopicLiteral.

    Returns summary of validated items and confirms 0 structural discrepancies.
    """
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
            f"✅ [TAXONOMY HIERARCHY VALIDATED] 100% Consistent: {len(hierarchy_subjs)} Subjects, {len(hierarchy_topics)} Topics, {len(hierarchy_subtopics)} Subtopics."
        )
    else:
        logger.error(f"❌ [TAXONOMY HIERARCHY DISCREPANCY] Validation report: {report}")

    return report


# ============================================================================
# Core Fallback Vectorizer & String Utilities (Zero Dependency)
# ============================================================================

def normalize_text(text: Optional[str]) -> str:
    """Normalizes string for comparison by lowercasing, expanding ampersands, and stripping punctuation."""
    if not text or not isinstance(text, str):
        return ""
    # Lowercase & expand common conjunctions and symbols
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

    # Levenshtein distance ratio on sorted tokens
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
                dp[i - 1][j] + 1,      # deletion
                dp[i][j - 1] + 1,      # insertion
                dp[i - 1][j - 1] + cost, # substitution
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
        # L2 normalize
        norm_sq = math.sqrt(sum(v * v for v in counts.values()))
        if norm_sq > 0:
            for k in counts:
                counts[k] /= norm_sq
        return dict(counts)

    @staticmethod
    def cosine_similarity(v1: Dict[str, float], v2: Dict[str, float]) -> float:
        if not v1 or not v2:
            return 0.0
        # Dot product of unit vectors
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
    ],
    "Indian Culture": [
        "culture",
        "art and culture",
        "art & culture",
        "arts and culture",
        "indian art and culture",
        "heritage",
        "indian heritage",
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
    ],
    "Economy": [
        "economics",
        "indian economy",
        "macroeconomics",
        "microeconomics",
        "indian economic development",
        "economic",
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
    ],
    "Geography": [
        "world geography",
        "indian geography",
        "physical geography",
        "geo",
    ],
    "History": [
        "ancient history",
        "medieval history",
        "modern history",
        "indian history",
        "hist",
        "world history",
    ],
    "General Science": [
        "gen science",
        "general sci",
        "basic science",
        "physics",
        "chemistry",
        "biology",
        "physical sciences",
    ],
}


# ============================================================================
# Main TaxonomyResolver Class
# ============================================================================

class TaxonomyResolver:
    """Robust, zero-API-cost Taxonomy Resolution Engine.

    Features:
    - Pre-computes lookup tables and candidate embeddings in memory.
    - Fast 3-tier cascade: Exact (0ms) -> Fuzzy (RapidFuzz >= 80) -> Semantic (Embeddings Cosine).
    - Top-Down cascaded pruning strictly enforcing hierarchy: Subject -> Topic -> Subtopic.
    - Sub-5ms execution time for full hierarchy resolution.
    - 100% hierarchy preservation guarantee.
    """

    def __init__(
        self,
        taxonomy: Optional[Dict[str, Dict[str, List[str]]]] = None,
        fuzzy_threshold: float = 80.0,
        semantic_threshold: float = 0.50,
        embedding_model_name: str = "all-MiniLM-L6-v2",
        enable_semantic: bool = True,
    ):
        """Initializes the taxonomy resolver with pre-computed candidate tables and embeddings."""
        start_t = time.perf_counter()
        self.taxonomy: Dict[str, Dict[str, List[str]]] = taxonomy or SYLLABUS_HIERARCHY
        self.fuzzy_threshold = fuzzy_threshold
        self.semantic_threshold = semantic_threshold
        self.embedding_model_name = embedding_model_name
        self.enable_semantic = enable_semantic

        # Canonical collections
        self.subjects: List[str] = list(self.taxonomy.keys())
        self.default_subject: str = (
            "General Science" if "General Science" in self.taxonomy else self.subjects[0]
        )

        # Lookup caches for Level 1, 2, 3
        self._exact_subject_map: Dict[str, str] = {}
        self._exact_topic_map: Dict[str, Dict[str, str]] = defaultdict(dict)
        self._exact_subtopic_map: Dict[Tuple[str, str], Dict[str, str]] = defaultdict(dict)

        # Global reverse mappings for bottom-up inference
        self._global_subtopic_map: Dict[str, Tuple[str, str, str]] = {}
        self._global_topic_map: Dict[str, Tuple[str, str]] = {}

        # Semantic embedding cache
        self._model: Any = None
        self._lightweight_vectorizer = LightweightCharNgramVectorizer(n=3)
        self._subject_embeddings: Optional[Any] = None
        self._topic_embeddings: Dict[str, Any] = {}
        self._subtopic_embeddings: Dict[Tuple[str, str], Any] = {}
        self._fallback_vectors: Dict[str, Any] = {}

        self._build_lookup_tables()
        if self.enable_semantic:
            self._warmup_embeddings()

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0
        total_topics = sum(len(topics) for topics in self.taxonomy.values())
        total_subtopics = sum(
            len(subtopics) for topics in self.taxonomy.values() for subtopics in topics.values()
        )
        logger.info(
            f"🚀 [TAXONOMY ENGINE INITIALIZED] Loaded {len(self.subjects)} Subjects, {total_topics} Topics, {total_subtopics} Subtopics in {elapsed_ms:.2f}ms (Semantic Model: {self.embedding_model_name if HAS_SENTENCE_TRANSFORMERS else 'N-Gram Vectorizer'})."
        )

    def _build_lookup_tables(self) -> None:
        """Builds normalized exact lookup dictionaries, aliases, and global hierarchy indices."""
        # 1. Subject indices & Aliases
        for subj, topics in self.taxonomy.items():
            norm_subj = normalize_text(subj)
            self._exact_subject_map[norm_subj] = subj
            self._exact_subject_map[subj.lower().strip()] = subj

            # Register curated subject aliases
            if subj in SUBJECT_ALIASES:
                for alias in SUBJECT_ALIASES[subj]:
                    self._exact_subject_map[normalize_text(alias)] = subj
                    self._exact_subject_map[alias.lower().strip()] = subj

            # 2. Topic indices per Subject & Global
            for topic, subtopics in topics.items():
                norm_top = normalize_text(topic)
                self._exact_topic_map[subj][norm_top] = topic
                self._exact_topic_map[subj][topic.lower().strip()] = topic

                # Clean topic without parentheses e.g. "Directive Principles of State Policy (DPSP)"
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

                # Singular/plural topic alias
                if topic.endswith("s") and len(topic) > 3:
                    self._exact_topic_map[subj][normalize_text(topic[:-1])] = topic

                # Global topic index
                if norm_top not in self._global_topic_map:
                    self._global_topic_map[norm_top] = (topic, subj)
                if topic.lower().strip() not in self._global_topic_map:
                    self._global_topic_map[topic.lower().strip()] = (topic, subj)

                # 3. Subtopic indices per (Subject, Topic) & Global
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
                # 1. Subjects matrix
                self._subject_embeddings = self._model.encode(
                    self.subjects, normalize_embeddings=True, show_progress_bar=False
                )

                # 2. Topics matrix per Subject
                for subj, topics_dict in self.taxonomy.items():
                    topic_list = list(topics_dict.keys())
                    if topic_list:
                        self._topic_embeddings[subj] = self._model.encode(
                            topic_list, normalize_embeddings=True, show_progress_bar=False
                        )

                # 3. Subtopics matrix per (Subject, Topic)
                for subj, topics_dict in self.taxonomy.items():
                    for topic, subtop_list in topics_dict.items():
                        if subtop_list:
                            self._subtopic_embeddings[(subj, topic)] = self._model.encode(
                                subtop_list, normalize_embeddings=True, show_progress_bar=False
                            )
                return
            except Exception as e:
                logger.warning(
                    f"⚠️ [TAXONOMY EMBEDDINGS] SentenceTransformer initialization failed ({e}), using lightweight n-gram fallback."
                )
                self._model = None

        # Zero-dependency Fallback: Pre-compute n-gram vectors
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
    ) -> Optional[Tuple[str, float]]:
        """Tier 1: Exact Match (0ms)."""
        if not query:
            return None
        # Try raw strip
        raw_key = query.strip().lower()
        if raw_key in exact_map:
            return exact_map[raw_key], 1.0

        # Try normalized
        norm_key = normalize_text(query)
        if norm_key in exact_map:
            return exact_map[norm_key], 1.0

        return None

    def _match_fuzzy(
        self, query: str, candidates: List[str]
    ) -> Optional[Tuple[str, float]]:
        """Tier 2: RapidFuzz token_sort_ratio (<= 1ms)."""
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
                return match_val, float(score) / 100.0
        else:
            best_val = None
            best_score = 0.0
            for cand in candidates:
                score = pure_python_token_sort_ratio(query, cand)
                if score > best_score:
                    best_score = score
                    best_val = cand
            if best_val and best_score >= self.fuzzy_threshold:
                return best_val, best_score / 100.0

        return None

    def _match_semantic(
        self,
        query: str,
        candidates: List[str],
        precomputed_embeddings: Optional[Any] = None,
        embedding_key_prefix: Optional[str] = None,
    ) -> Optional[Tuple[str, float]]:
        """Tier 3: Local Sentence-Transformers Cosine Similarity (<3ms)."""
        if not query or not candidates:
            return None

        # A. If SentenceTransformers model and embeddings are available
        if self._model is not None and precomputed_embeddings is not None and np is not None:
            try:
                query_emb = self._model.encode(
                    [query], normalize_embeddings=True, show_progress_bar=False
                )[0]
                sims = np.dot(precomputed_embeddings, query_emb)
                best_idx = int(np.argmax(sims))
                best_score = float(sims[best_idx])
                if best_score >= self.semantic_threshold:
                    return candidates[best_idx], best_score
            except Exception:
                pass

        # B. Pure-Python Character N-gram TF-IDF / Cosine Similarity Fallback
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
            sim = self._lightweight_vectorizer.cosine_similarity(query_vec, cand_vec)
            if sim > best_sim:
                best_sim = sim
                best_cand = cand

        if best_cand and best_sim >= self.semantic_threshold:
            return best_cand, best_sim

        return None

    # ------------------------------------------------------------------------
    # Cascaded Top-Down Pruning Resolvers
    # ------------------------------------------------------------------------

    def resolve_subject(
        self, raw_subject: Optional[str], context_hint: Optional[str] = None
    ) -> FieldResolutionResult:
        """Level 1: Resolve Subject against root keys of Master Taxonomy."""
        start_t = time.perf_counter()
        raw_val = (raw_subject or "").strip()

        if raw_val:
            # 1. Tier 1: Exact Match
            exact = self._match_exact(raw_val, self._exact_subject_map)
            if exact:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                logger.debug(
                    f"🔍 [LEVEL 1 EXACT] Subject '{raw_val}' -> '{exact[0]}' in {elapsed:.3f}ms"
                )
                return FieldResolutionResult(
                    canonical_value=exact[0],
                    raw_value=raw_val,
                    tier=MatchTier.EXACT,
                    confidence=exact[1],
                    execution_time_ms=elapsed,
                )

            # 2. Tier 2: Fuzzy Match
            fuzzy = self._match_fuzzy(raw_val, self.subjects)
            if fuzzy:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                logger.debug(
                    f"🔍 [LEVEL 1 FUZZY] Subject '{raw_val}' -> '{fuzzy[0]}' (Score: {fuzzy[1]:.2f}) in {elapsed:.3f}ms"
                )
                return FieldResolutionResult(
                    canonical_value=fuzzy[0],
                    raw_value=raw_val,
                    tier=MatchTier.FUZZY,
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
                logger.debug(
                    f"🔍 [LEVEL 1 SEMANTIC] Subject '{raw_val}' -> '{semantic[0]}' (Score: {semantic[1]:.2f}) in {elapsed:.3f}ms"
                )
                return FieldResolutionResult(
                    canonical_value=semantic[0],
                    raw_value=raw_val,
                    tier=MatchTier.SEMANTIC,
                    confidence=semantic[1],
                    execution_time_ms=elapsed,
                )

        # Fallback to default canonical subject
        elapsed = (time.perf_counter() - start_t) * 1000.0
        logger.warning(
            f"⚠️ [LEVEL 1 FALLBACK] Subject '{raw_val}' unresolvable, defaulted to '{self.default_subject}' in {elapsed:.3f}ms"
        )
        return FieldResolutionResult(
            canonical_value=self.default_subject,
            raw_value=raw_val or None,
            tier=MatchTier.FALLBACK,
            confidence=0.50,
            execution_time_ms=elapsed,
        )

    def resolve_topic(
        self,
        raw_topic: Optional[str],
        resolved_subject: str,
        context_hint: Optional[str] = None,
    ) -> FieldResolutionResult:
        """Level 2: Resolve Topic strictly within candidates under resolved_subject."""
        start_t = time.perf_counter()
        raw_val = (raw_topic or "").strip()

        topics_dict = self.taxonomy.get(resolved_subject, {})
        valid_topics = list(topics_dict.keys())
        default_topic = valid_topics[0] if valid_topics else "General Concepts"

        if raw_val and valid_topics:
            # 1. Tier 1: Exact Match
            exact_map = self._exact_topic_map.get(resolved_subject, {})
            exact = self._match_exact(raw_val, exact_map)
            if exact:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                logger.debug(
                    f"🔍 [LEVEL 2 EXACT] Topic '{raw_val}' -> '{exact[0]}' under '{resolved_subject}' in {elapsed:.3f}ms"
                )
                return FieldResolutionResult(
                    canonical_value=exact[0],
                    raw_value=raw_val,
                    tier=MatchTier.EXACT,
                    confidence=exact[1],
                    execution_time_ms=elapsed,
                )

            # 2. Tier 2: Fuzzy Match
            fuzzy = self._match_fuzzy(raw_val, valid_topics)
            if fuzzy:
                elapsed = (time.perf_counter() - start_t) * 1000.0
                logger.debug(
                    f"🔍 [LEVEL 2 FUZZY] Topic '{raw_val}' -> '{fuzzy[0]}' (Score: {fuzzy[1]:.2f}) under '{resolved_subject}' in {elapsed:.3f}ms"
                )
                return FieldResolutionResult(
                    canonical_value=fuzzy[0],
                    raw_value=raw_val,
                    tier=MatchTier.FUZZY,
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
                logger.debug(
                    f"🔍 [LEVEL 2 SEMANTIC] Topic '{raw_val}' -> '{semantic[0]}' (Score: {semantic[1]:.2f}) under '{resolved_subject}' in {elapsed:.3f}ms"
                )
                return FieldResolutionResult(
                    canonical_value=semantic[0],
                    raw_value=raw_val,
                    tier=MatchTier.SEMANTIC,
                    confidence=semantic[1],
                    execution_time_ms=elapsed,
                )

        # Fallback to first topic under resolved subject
        elapsed = (time.perf_counter() - start_t) * 1000.0
        logger.warning(
            f"⚠️ [LEVEL 2 FALLBACK] Topic '{raw_val}' unresolvable under '{resolved_subject}', defaulted to '{default_topic}' in {elapsed:.3f}ms"
        )
        return FieldResolutionResult(
            canonical_value=default_topic,
            raw_value=raw_val or None,
            tier=MatchTier.FALLBACK,
            confidence=0.50,
            execution_time_ms=elapsed,
        )

    def resolve_subtopic(
        self,
        raw_subtopic: Optional[str],
        resolved_subject: str,
        resolved_topic: str,
        context_hint: Optional[str] = None,
    ) -> Optional[FieldResolutionResult]:
        """Level 3: Resolve Subtopic strictly within valid subtopics for (subject, topic)."""
        start_t = time.perf_counter()
        raw_val = (raw_subtopic or "").strip()

        valid_subtopics = self.taxonomy.get(resolved_subject, {}).get(resolved_topic, [])
        if not raw_val or not valid_subtopics:
            return None

        # 1. Tier 1: Exact Match
        exact_map = self._exact_subtopic_map.get((resolved_subject, resolved_topic), {})
        exact = self._match_exact(raw_val, exact_map)
        if exact:
            elapsed = (time.perf_counter() - start_t) * 1000.0
            logger.debug(
                f"🔍 [LEVEL 3 EXACT] Subtopic '{raw_val}' -> '{exact[0]}' under '{resolved_subject} -> {resolved_topic}' in {elapsed:.3f}ms"
            )
            return FieldResolutionResult(
                canonical_value=exact[0],
                raw_value=raw_val,
                tier=MatchTier.EXACT,
                confidence=exact[1],
                execution_time_ms=elapsed,
            )

        # 2. Tier 2: Fuzzy Match
        fuzzy = self._match_fuzzy(raw_val, valid_subtopics)
        if fuzzy:
            elapsed = (time.perf_counter() - start_t) * 1000.0
            logger.debug(
                f"🔍 [LEVEL 3 FUZZY] Subtopic '{raw_val}' -> '{fuzzy[0]}' (Score: {fuzzy[1]:.2f}) under '{resolved_subject} -> {resolved_topic}' in {elapsed:.3f}ms"
            )
            return FieldResolutionResult(
                canonical_value=fuzzy[0],
                raw_value=raw_val,
                tier=MatchTier.FUZZY,
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
            logger.debug(
                f"🔍 [LEVEL 3 SEMANTIC] Subtopic '{raw_val}' -> '{semantic[0]}' (Score: {semantic[1]:.2f}) under '{resolved_subject} -> {resolved_topic}' in {elapsed:.3f}ms"
            )
            return FieldResolutionResult(
                canonical_value=semantic[0],
                raw_value=raw_val,
                tier=MatchTier.SEMANTIC,
                confidence=semantic[1],
                execution_time_ms=elapsed,
            )

        return None

    # ------------------------------------------------------------------------
    # Full Cascaded Hierarchy Resolution & Bottom-Up Synergy
    # ------------------------------------------------------------------------

    def resolve_hierarchy(
        self,
        raw_subject: Optional[str],
        raw_topic: Optional[str],
        raw_subtopic: Optional[str] = None,
        context_hint: Optional[str] = None,
    ) -> Tuple[ValidatedTaxonomy, TaxonomyResolutionMetrics]:
        """Resolves complete Subject -> Topic -> Subtopic hierarchy with guaranteed consistency."""
        start_overall = time.perf_counter()
        raw_subtop_clean = (raw_subtopic or "").strip()
        raw_top_clean = (raw_topic or "").strip()
        raw_subj_clean = (raw_subject or "").strip()

        # Step 0: Check if raw_subject matches a valid subject/alias
        subj_match_direct = None
        if raw_subj_clean:
            subj_match_direct = self._match_exact(raw_subj_clean, self._exact_subject_map)
            if not subj_match_direct:
                subj_match_direct = self._match_fuzzy(raw_subj_clean, self.subjects)

        # If subject was not provided OR could not be matched at all, check bottom-up anchor
        inferred_bottom_up = False
        if not subj_match_direct:
            if raw_subtop_clean:
                norm_subtop = normalize_text(raw_subtop_clean)
                if norm_subtop in self._global_subtopic_map:
                    _c_subtop, c_top, c_subj = self._global_subtopic_map[norm_subtop]
                    logger.info(
                        f"🧭 [TAXONOMY ANCHOR] Inferred Subject='{c_subj}', Topic='{c_top}' from Subtopic='{raw_subtop_clean}'"
                    )
                    raw_subj_clean = c_subj
                    raw_top_clean = c_top
                    inferred_bottom_up = True
            elif raw_top_clean:
                norm_top = normalize_text(raw_top_clean)
                if norm_top in self._global_topic_map:
                    _c_top, c_subj = self._global_topic_map[norm_top]
                    logger.info(
                        f"🧭 [TAXONOMY ANCHOR] Inferred Subject='{c_subj}' from Topic='{raw_top_clean}'"
                    )
                    raw_subj_clean = c_subj
                    inferred_bottom_up = True

        # Step 1: Top-Down Pruning: Level 1 (Subject)
        subj_res = self.resolve_subject(raw_subj_clean, context_hint=context_hint)
        if inferred_bottom_up:
            subj_res.tier = MatchTier.BOTTOM_UP
            subj_res.confidence = 1.0
        resolved_subject = subj_res.canonical_value

        # Step 2: Level 2 (Topic strictly within resolved_subject)
        top_res = self.resolve_topic(
            raw_top_clean, resolved_subject=resolved_subject, context_hint=context_hint
        )
        if inferred_bottom_up and top_res.tier != MatchTier.EXACT:
            top_res.tier = MatchTier.BOTTOM_UP
            top_res.confidence = 1.0
        resolved_topic = top_res.canonical_value

        # Step 3: Level 3 (Subtopic strictly within resolved_topic)
        subtop_res = self.resolve_subtopic(
            raw_subtop_clean,
            resolved_subject=resolved_subject,
            resolved_topic=resolved_topic,
            context_hint=context_hint,
        )
        resolved_subtopic = subtop_res.canonical_value if subtop_res else None

        # Compute aggregate confidence metric
        weights = [subj_res.confidence, top_res.confidence]
        if subtop_res:
            weights.append(subtop_res.confidence)
        overall_conf = sum(weights) / len(weights)
        total_time_ms = (time.perf_counter() - start_overall) * 1000.0

        metrics = TaxonomyResolutionMetrics(
            subject_match=subj_res,
            topic_match=top_res,
            subtopic_match=subtop_res,
            overall_confidence=round(overall_conf, 4),
            total_resolution_time_ms=round(total_time_ms, 3),
        )

        validated_taxonomy = ValidatedTaxonomy(
            subject=resolved_subject,
            topic=resolved_topic,
            subtopic=resolved_subtopic,
            metrics=metrics,
        )

        logger.info(
            f"🌿 [TAXONOMY RESOLVED] {resolved_subject} [{subj_res.tier.value}] -> {resolved_topic} [{top_res.tier.value}] -> {resolved_subtopic or 'None'} [{subtop_res.tier.value if subtop_res else 'N/A'}] | Overall Conf: {overall_conf:.2f} | Latency: {total_time_ms:.2f}ms"
        )

        return validated_taxonomy, metrics

    # ------------------------------------------------------------------------
    # High-Level Payload Resolution Pipeline
    # ------------------------------------------------------------------------

    def resolve_payload(
        self, raw_payload: Union[RawLLMExplanationPayload, Dict[str, Any]]
    ) -> ValidatedDatabaseExplanationPayload:
        """Converts raw LLM payload into strictly validated Database Explanation payload."""
        if isinstance(raw_payload, dict):
            raw = RawLLMExplanationPayload.model_validate(raw_payload)
        else:
            raw = raw_payload

        # Context hint built from question & explanation text
        context_hint = f"{raw.question_text[:200]} {raw.explanation[:200] if raw.explanation else ''}"

        # Resolve primary taxonomy
        val_tax, metrics = self.resolve_hierarchy(
            raw_subject=raw.predicted_subject,
            raw_topic=raw.predicted_topic,
            raw_subtopic=raw.predicted_subtopic,
            context_hint=context_hint,
        )

        # Resolve additional multi-concept items if present
        resolved_concepts: List[MultiConceptItemResolved] = []
        # Add primary concept
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


# ============================================================================
# Global Singleton Accessor
# ============================================================================

_GLOBAL_RESOLVER: Optional[TaxonomyResolver] = None


def get_taxonomy_resolver() -> TaxonomyResolver:
    """Returns application singleton TaxonomyResolver with pre-warmed embeddings."""
    global _GLOBAL_RESOLVER
    if _GLOBAL_RESOLVER is None:
        _GLOBAL_RESOLVER = TaxonomyResolver()
    return _GLOBAL_RESOLVER
