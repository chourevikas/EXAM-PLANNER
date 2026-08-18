"""Unit tests for Taxonomy Resolution and Validation Pipeline.

Tests:
1. Tier 1: Exact matches & normalizations (case-insensitive, ampersands, whitespace).
2. Tier 2: Fuzzy matching for typos & permutations (token_sort_ratio >= 80).
3. Tier 3: Semantic fallback with candidate pre-caching.
4. Bottom-up hierarchy recovery from granular subtopics and topics.
5. Strict top-down cascaded pruning preserving 100% taxonomy hierarchy.
6. Master syllabus hierarchy completeness (Literals <-> SYLLABUS_HIERARCHY).
7. Pydantic v2 schemas and payload resolution with strict hierarchy validators.
8. Performance benchmark confirming sub-5ms resolution latency.
"""

import time
import pytest
from app.pipeline.taxonomy_resolver import (
    TaxonomyResolver,
    MatchTier,
    RawLLMExplanationPayload,
    ValidatedTaxonomy,
    ValidatedDatabaseExplanationPayload,
    validate_master_syllabus_hierarchy,
    get_taxonomy_resolver,
)
from app.schemas.syllabus_literals import SYLLABUS_HIERARCHY
from app.pipeline.explanation_schema import QuestionExplanationSchema, MultiConceptItemSchema


@pytest.fixture(scope="module")
def resolver():
    """Provides warm singleton resolver instance."""
    return get_taxonomy_resolver()


class TestTaxonomyResolverTiers:
    """Tests resolution tiers: Exact, Fuzzy, Semantic, and Fallback."""

    def test_tier_1_exact_match_subject(self, resolver: TaxonomyResolver):
        # Case variation & whitespace
        res = resolver.resolve_subject("  history  ")
        assert res.canonical_value == "History"
        assert res.tier == MatchTier.EXACT
        assert res.confidence == 1.0

        # Ampersand normalization
        res_env = resolver.resolve_subject("Ecology and Environment")
        assert res_env.canonical_value == "Ecology & Environment"
        assert res_env.tier == MatchTier.EXACT
        assert res_env.confidence == 1.0

    def test_tier_1_exact_match_topic_and_subtopic(self, resolver: TaxonomyResolver):
        top_res = resolver.resolve_topic("money and banking", resolved_subject="Economy")
        assert top_res.canonical_value == "Money and Banking"
        assert top_res.tier == MatchTier.EXACT
        assert top_res.confidence == 1.0

        subtop_res = resolver.resolve_subtopic(
            "indus valley civilization",
            resolved_subject="History",
            resolved_topic="Ancient History",
        )
        assert subtop_res is not None
        assert subtop_res.canonical_value == "Indus Valley Civilization"
        assert subtop_res.tier == MatchTier.EXACT

    def test_tier_2_fuzzy_match_typos(self, resolver: TaxonomyResolver):
        # Misspelled subject
        res = resolver.resolve_subject("Geogrophy")
        assert res.canonical_value == "Geography"
        assert res.tier == MatchTier.FUZZY
        assert res.confidence >= 0.80

        # Misspelled topic
        top_res = resolver.resolve_topic("Ancent Histroy", resolved_subject="History")
        assert top_res.canonical_value == "Ancient History"
        assert top_res.tier == MatchTier.FUZZY
        assert top_res.confidence >= 0.80

        # Misspelled subtopic
        subtop_res = resolver.resolve_subtopic(
            "Budhism",
            resolved_subject="History",
            resolved_topic="Ancient History",
        )
        assert subtop_res is not None
        assert subtop_res.canonical_value == "Buddhism"
        assert subtop_res.tier == MatchTier.FUZZY
        assert subtop_res.confidence >= 0.80

    def test_tier_2_token_permutation(self, resolver: TaxonomyResolver):
        # Permuted tokens
        top_res = resolver.resolve_topic("Banking and Money", resolved_subject="Economy")
        assert top_res.canonical_value == "Money and Banking"
        assert top_res.tier in [MatchTier.EXACT, MatchTier.FUZZY]
        assert top_res.confidence >= 0.80

    def test_tier_3_semantic_fallback(self, resolver: TaxonomyResolver):
        # Paraphrased subtopic
        subtop_res = resolver.resolve_subtopic(
            "Central banking monetary policy and banking institutions",
            resolved_subject="Economy",
            resolved_topic="Money and Banking",
        )
        if subtop_res:
            assert subtop_res.canonical_value in SYLLABUS_HIERARCHY["Economy"]["Money and Banking"]
            assert subtop_res.confidence >= 0.50

    def test_bottom_up_anchor_subtopic(self, resolver: TaxonomyResolver):
        # Granular subtopic provided with missing or flawed subject/topic
        tax, metrics = resolver.resolve_hierarchy(
            raw_subject="Random Topic",
            raw_topic="Unknown",
            raw_subtopic="Indus Valley Civilization",
        )
        assert tax.subject == "History"
        assert tax.topic == "Ancient History"
        assert tax.subtopic == "Indus Valley Civilization"
        assert metrics.overall_confidence == 1.0

    def test_bottom_up_anchor_topic(self, resolver: TaxonomyResolver):
        # Unique topic provided with unstated or generic subject
        tax, metrics = resolver.resolve_hierarchy(
            raw_subject="polity",
            raw_topic="Fundamental Rights",
            raw_subtopic=None,
        )
        assert tax.subject == "Indian Polity & Governance"
        assert tax.topic == "Fundamental Rights"
        assert metrics.overall_confidence == 1.0


class TestHierarchyPreservation:
    """Tests 100% structural hierarchy preservation guarantee."""

    def test_master_syllabus_hierarchy_completeness(self):
        """Verifies that all Subjects, Topics, and Subtopics in SYLLABUS_HIERARCHY match Literals."""
        report = validate_master_syllabus_hierarchy()
        assert report["is_valid"] is True
        assert report["total_subjects"] == 8
        assert report["total_topics"] == 55
        assert report["total_subtopics"] == 296
        assert len(report["missing_subjects"]) == 0
        assert len(report["missing_topics"]) == 0
        assert len(report["missing_subtopics"]) == 0

    def test_topic_strictly_under_resolved_subject(self, resolver: TaxonomyResolver):
        # User passes subject=Economy but topic="Ancient History" (which belongs to History)
        # Top-down resolution must resolve topic to something valid UNDER Economy
        tax, _ = resolver.resolve_hierarchy(
            raw_subject="Economy",
            raw_topic="Ancient History",
            raw_subtopic=None,
        )
        assert tax.subject == "Economy"
        assert tax.topic in SYLLABUS_HIERARCHY["Economy"]

    def test_subtopic_strictly_under_resolved_topic(self, resolver: TaxonomyResolver):
        tax, _ = resolver.resolve_hierarchy(
            raw_subject="Indian Polity & Governance",
            raw_topic="Fundamental Rights",
            raw_subtopic="NonExistentSubtopic12345",
        )
        assert tax.subject == "Indian Polity & Governance"
        assert tax.topic == "Fundamental Rights"
        # Subtopic should be None or a valid child
        if tax.subtopic is not None:
            assert tax.subtopic in SYLLABUS_HIERARCHY["Indian Polity & Governance"]["Fundamental Rights"]

    def test_empty_and_none_inputs(self, resolver: TaxonomyResolver):
        tax, metrics = resolver.resolve_hierarchy(
            raw_subject=None,
            raw_topic="",
            raw_subtopic=None,
        )
        assert tax.subject in SYLLABUS_HIERARCHY
        assert tax.topic in SYLLABUS_HIERARCHY[tax.subject]
        assert metrics.subject_match.tier == MatchTier.FALLBACK

    def test_validated_taxonomy_pydantic_enforcement(self):
        # Valid hierarchy instantiation succeeds
        val = ValidatedTaxonomy(
            subject="History",
            topic="Ancient History",
            subtopic="Indus Valley Civilization",
        )
        assert val.subject == "History"

        # Invalid Topic under Subject raises ValueError
        with pytest.raises(ValueError, match="not a valid TopicLiteral"):
            ValidatedTaxonomy(
                subject="History",
                topic="Fundamental Rights",  # Belongs to Polity, not History
                subtopic=None,
            )

        # Invalid Subtopic under Topic raises ValueError
        with pytest.raises(ValueError, match="not a valid SubtopicLiteral"):
            ValidatedTaxonomy(
                subject="History",
                topic="Ancient History",
                subtopic="Article 1-4",  # Belongs to Polity, not Ancient History
            )


class TestPydanticPayloadIntegration:
    """Tests end-to-end Pydantic schemas and pipeline integration."""

    def test_resolve_payload_end_to_end(self, resolver: TaxonomyResolver):
        raw_payload = {
            "question_text": "Which article of the Indian Constitution guarantees Right to Equality?",
            "explanation": "Articles 14 to 18 of the Indian Constitution guarantee the Right to Equality.",
            "correct_answer": "A",
            "predicted_subject": "indian polity and governance",
            "predicted_topic": "fundamntal rights",
            "predicted_subtopic": "Right to Equality",
            "concepts": [
                {
                    "subject": "polity",
                    "topic": "Salient Features of Indian Constitution",
                    "subtopic": "Preamble",
                }
            ],
            "difficulty": "Easy",
        }

        db_payload = resolver.resolve_payload(raw_payload)
        assert isinstance(db_payload, ValidatedDatabaseExplanationPayload)
        assert db_payload.subject == "Indian Polity & Governance"
        assert db_payload.topic == "Fundamental Rights"
        assert db_payload.taxonomy_metrics.total_resolution_time_ms >= 0.0
        assert len(db_payload.concepts) >= 1

    def test_question_explanation_schema_model_validator(self):
        # Verifies that QuestionExplanationSchema validates & auto-corrects raw strings
        schema = QuestionExplanationSchema(
            core_concept="Fundamental Rights in Indian Constitution",
            detailed_solution="Article 21 provides Protection of Life and Personal Liberty.",
            options_breakdown=[
                {
                    "option_key": "A",
                    "is_correct": True,
                    "closeness_score": 1.0,
                    "explanation": "Correct per Art 21.",
                }
            ],
            common_traps=["Confusing Article 20 with 21."],
            key_takeaways=["Art 21 cannot be suspended during Emergency."],
            subject="polity and governance",
            topic="fundamental rights",
            subtopic="Right to Freedom",
            difficulty="Medium",
        )
        assert schema.subject == "Indian Polity & Governance"
        assert schema.topic == "Fundamental Rights"
        assert schema.subtopic == "Right to Freedom"

    def test_multi_concept_item_schema_auto_repair(self):
        item = MultiConceptItemSchema(
            subject="economy",
            topic="money & banking",
            subtopic="Banking Structure in India",
        )
        assert item.subject == "Economy"
        assert item.topic == "Money and Banking"
        assert item.subtopic == "Banking Structure in India"


class TestPerformanceBenchmark:
    """Verifies that runtime resolution operates under 5ms."""

    def test_latency_sub_5ms(self, resolver: TaxonomyResolver):
        test_queries = [
            ("History", "Ancient History", "Indus Valley Civilization"),
            ("economy", "money and banking", "Monetary Policy"),
            ("polity", "fundamental rights", None),
            ("Science & Technology", "Space", "Satellites"),
            ("geography", "Climatology", "Precipitation"),
            ("Indian Culture", "Visual Arts", "Architecture"),
            ("Ecology and Environment", "Biodiversity", "Threats to biodiversity"),
            ("General Science", "Biology", "Endocrine system"),
        ]

        latencies = []
        # Warm run
        for subj, top, subtop in test_queries:
            resolver.resolve_hierarchy(subj, top, subtop)

        # Timed benchmark: 100 iterations
        start = time.perf_counter()
        iterations = 100
        for _ in range(iterations):
            for subj, top, subtop in test_queries:
                t0 = time.perf_counter()
                resolver.resolve_hierarchy(subj, top, subtop)
                latencies.append((time.perf_counter() - t0) * 1000.0)
        total_time = time.perf_counter() - start

        avg_latency = sum(latencies) / len(latencies)
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]

        print(f"\n--- Latency Benchmark (N={len(latencies)}) ---")
        print(f"Total time: {total_time * 1000:.2f}ms")
        print(f"Average latency per resolution: {avg_latency:.3f}ms")
        print(f"P95 latency: {p95_latency:.3f}ms")

        assert avg_latency < 5.0, f"Average latency {avg_latency:.3f}ms exceeds 5ms target"
        assert p95_latency < 10.0, f"P95 latency {p95_latency:.3f}ms exceeds 10ms target"
