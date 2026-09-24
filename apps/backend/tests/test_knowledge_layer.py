import unittest

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Exam,
    LanguageCode,
    Question,
    QuestionExplanation,
    QuestionOption,
    QuestionStatus,
    QuestionTranslation,
    Subject,
    Subtopic,
    Topic,
)
from app.db.models.hierarchy import SyllabusVersion
from app.db.models.knowledge import (
    KnowledgeAlias,
    KnowledgeEntity,
    KnowledgeRelationship,
    QuestionEntity,
    QuestionRelationship,
)
from app.knowledge.enrichment_service import KnowledgeEnrichmentService
from app.knowledge.normalize import canonical_provision_name, normalize_key, provision_parent
from app.knowledge.resolver import KnowledgeResolver, seed_masters
from app.knowledge.similarity import SimilarityService
from app.pipeline.knowledge_tags import extract_knowledge_tags, knowledge_tags_from_record
from app.pipeline.regex_question_parser import parse_question_block


class TestNormalizeAndTags(unittest.TestCase):
    def test_spelling_variants_share_a_key(self):
        self.assertEqual(
            {normalize_key(s) for s in ("Article 15", "Art. 15", "Art 15", "Article fifteen", "article  15")},
            {"article 15"},
        )
        self.assertEqual(
            {normalize_key(s) for s in ("GoI Act 1935", "Government of India Act, 1935", "GOI Act 1935")},
            {"government of india act 1935"},
        )
        self.assertEqual(canonical_provision_name("Art.15 (4)"), "Article 15(4)")
        self.assertEqual(provision_parent("Article 15(4)(a)"), "Article 15(4)")
        self.assertIsNone(provision_parent("Article 15"))

    def test_authored_tags_are_parsed_and_removed(self):
        text = (
            "Q9. [Subject: Polity] [Microtheme: Fundamental Rights] [Nano Theme: Right to Equality] [Difficulty: Moderate]\n"
            "[Concepts: Right to Equality; Reservation]\n"
            "[Entities: Article 15, Article 15(4), Government of India Act, 1935]\n"
            "[Relationships: Article 15 -> Right to Equality;\n"
            " Article 15(4) -(provides_for)-> Special Provisions for SEBC/SC/ST; Suba → Sarkar; not a relation]\n"
            "Which of the following is correct?"
        )
        cleaned, tags = extract_knowledge_tags(text)
        self.assertNotIn("Concepts", cleaned)
        self.assertNotIn("Relationships", cleaned)
        self.assertIn("Which of the following is correct?", cleaned)
        self.assertEqual(tags["concepts"], ["Right to Equality", "Reservation"])
        self.assertEqual(tags["entities"], ["Article 15", "Article 15(4)", "Government of India Act, 1935"])
        self.assertEqual(
            tags["relationships"],
            [
                {"source": "Article 15", "relation": "", "target": "Right to Equality"},
                {"source": "Article 15(4)", "relation": "provides_for", "target": "Special Provisions for SEBC/SC/ST"},
                {"source": "Suba", "relation": "", "target": "Sarkar"},
            ],
        )
        self.assertEqual(tags["issues"], ["UNPARSED_RELATIONSHIP: not a relation"])

    def test_ocr_line_wraps_inside_tags(self):
        """Seen on a real OCR run: long tag lines wrap mid-item and mid-header."""
        text = (
            "Q6. [Subject: Polity] [Microtheme: Fundamental Rights] [Nano Theme: Right to Equality] [Difficulty:\n"
            "Moderate]\n"
            "[Relationships: Cripps Mission -(resulted_in)-> Quit India\n"
            "Movement; Suba -(headed_by)->\nSubedar]\n"
            "Which clause?\n(A) a\n(B) b\n(C) c\n(D) d\nAnswer: (C) c\nSolution:\n• x"
        )
        rec = parse_question_block(
            {"question_number": 6, "header_line": text.split("\n")[0], "page_numbers": [1], "clean_text": text}
        )
        self.assertEqual(rec.difficulty_raw, "Moderate")
        self.assertEqual(rec.stem, "Which clause?")
        self.assertEqual(
            rec.relationships_raw,
            [
                {"source": "Cripps Mission", "relation": "resulted_in", "target": "Quit India Movement"},
                {"source": "Suba", "relation": "headed_by", "target": "Subedar"},
            ],
        )
        self.assertEqual(rec.knowledge_issues, [])

    def test_parser_keeps_existing_fields_and_adds_knowledge(self):
        block_text = (
            "Q2. [Subject: Modern History] [Microtheme: Constitutional Development] "
            "[Nano Theme: GoI Act 1935 — women's voting rights] [Difficulty: Moderate]\n"
            "[Entities: Government of India Act 1935]\n"
            "Consider the following statements.\n"
            "(A) 1 only\n(B) 2 only\n(C) Both 1 and 2\n(D) Neither 1 nor 2\n"
            "Answer: (B) 2 only\n"
            "Solution:\n"
            "• The GoI Act 1935 provided reserved seats for women.\n"
            "■ Related Articles / Acts / Cases:\n"
            "– Charter Act, 1833 & 1853 (earlier East India Company reforms)\n"
            "– Indian Councils Acts, 1861 / 1892 / 1909\n"
        )
        block = {"question_number": 2, "header_line": block_text.split("\n")[0], "page_numbers": [1], "clean_text": block_text}
        rec = parse_question_block(block)
        self.assertEqual(rec.topic_raw, "Constitutional Development")
        self.assertEqual(rec.stem, "Consider the following statements.")
        self.assertEqual(rec.answer_label, "B")
        self.assertEqual(rec.entities_raw, ["Government of India Act 1935"])
        self.assertEqual(
            rec.related_refs,
            ["Charter Act, 1833 & 1853 (earlier East India Company reforms)", "Indian Councils Acts, 1861 / 1892 / 1909"],
        )
        # The related list stays visible in the solution text; knowledge tags never enter the extraction issues
        self.assertIn("Charter Act, 1833 & 1853", rec.solution_text)
        self.assertEqual(rec.extraction_issues, [])
        self.assertEqual(knowledge_tags_from_record(rec)["entities"], ["Government of India Act 1935"])


class KnowledgeDbTestCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        async with self.session_factory() as s:
            self.exam = Exam(name="UPSC CSE Prelims 2021", code="upsc-2021", source_year=2021, is_active=True)
            s.add(self.exam)
            await s.flush()
            version = SyllabusVersion(exam_id=self.exam.id, version_code="V1")
            s.add(version)
            await s.flush()
            polity = Subject(version_id=version.id, name="Polity")
            s.add(polity)
            await s.flush()
            self.topics = {}
            for name in ("Fundamental Rights", "Misc"):
                self.topics[name] = Topic(subject_id=polity.id, name=name)
                s.add(self.topics[name])
            await s.flush()
            self.nanos = {}
            for nano, topic in (
                ("Right to Equality", "Fundamental Rights"),
                ("Equality in Public Employment", "Fundamental Rights"),
                ("Equality before Law", "Fundamental Rights"),
                ("Other", "Misc"),
            ):
                self.nanos[nano] = Subtopic(topic_id=self.topics[topic].id, name=nano)
                s.add(self.nanos[nano])
            await s.commit()
        self.number = 0

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def add_question(self, nano: str, tags: dict | None = None, solution: str = "", stem: str = "Q",
                           status=QuestionStatus.PUBLISHED) -> int:
        self.number += 1
        async with self.session_factory() as s:
            q = Question(
                exam_id=self.exam.id, question_number_in_paper=self.number, status=status,
                subtopic_id=self.nanos[nano].id, knowledge_tags_raw=tags,
            )
            s.add(q)
            await s.flush()
            s.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text=stem))
            if solution:
                s.add(QuestionExplanation(question_id=q.id, language=LanguageCode.ENGLISH, detailed_solution=solution))
            await s.commit()
            return q.id

    async def enrich(self, *qids):
        service = KnowledgeEnrichmentService(self.session_factory)
        return [await service.enrich_question(q) for q in qids]

    async def similar(self, qid, **kw):
        async with self.session_factory() as s:
            return await SimilarityService(s).find_similar(qid, **kw)


class TestResolverAndEnrichment(KnowledgeDbTestCase):
    async def test_aliases_resolve_to_one_node_and_provisions_get_parents(self):
        async with self.session_factory() as s:
            await seed_masters(
                s,
                [{"name": "Government of India Act 1935", "type": "ACT", "aliases": ["GoI Act 1935"]},
                 {"name": "Article 15(4)", "type": "CONSTITUTION_ARTICLE", "parent": "Article 15"}],
                [{"name": "Reservation", "aliases": ["Reservations"]}],
            )
            resolver = KnowledgeResolver(s)
            a = await resolver.resolve("GOI Act, 1935")
            b = await resolver.resolve("Government of India Act 1935")
            self.assertEqual(a, b)
            child = await resolver.resolve("Art. 15 (4)")
            parent = await resolver.resolve("Article 15")
            self.assertEqual(child.parent_id, parent.id)
            # "Reservation" is a concept: asking for it as an entity must not create a second node
            self.assertEqual((await resolver.resolve("Reservations", "ENTITY")).kind, "CONCEPT")
            await s.commit()
            self.assertEqual(len((await s.exec(select(KnowledgeEntity))).all()), 3)
            keys = (await s.exec(select(KnowledgeAlias.normalized_alias))).all()
            self.assertEqual(len(keys), len(set(keys)))

    async def test_enrichment_is_idempotent_and_validates(self):
        tags = {
            "concepts": ["Right to Equality"],
            "entities": ["Article 15(4)"],
            "relationships": [
                {"source": "Article 15(4)", "relation": "provides_for", "target": "Special Provisions for SEBC/SC/ST"},
                {"source": "Article 15", "relation": "playwright", "target": "Right to Equality"},
                {"source": "", "relation": "", "target": "X"},
            ],
        }
        qid = await self.add_question(
            "Right to Equality", tags,
            solution="Article 21 also applies.\n\nRelated Articles / Acts / Cases:\n\nGovernment of India Act, 1935",
            stem="Which statement about Article 15(4) is correct?",
        )
        first, = await self.enrich(qid)
        second, = await self.enrich(qid)
        self.assertEqual((first.concepts, first.entities, first.relationships), (second.concepts, second.entities, second.relationships))
        self.assertTrue(any("UNKNOWN_RELATION 'playwright'" in i for i in first.issues))
        self.assertTrue(any(i.startswith("EMPTY_RELATIONSHIP_END") for i in first.issues))
        async with self.session_factory() as s:
            ents = {
                e.canonical_name: (link.source, round(link.relevance, 2))
                for link, e in (await s.exec(
                    select(QuestionEntity, KnowledgeEntity).join(KnowledgeEntity, KnowledgeEntity.id == QuestionEntity.entity_id)
                    .where(QuestionEntity.question_id == qid)
                )).all()
            }
            edges = (await s.exec(select(KnowledgeRelationship))).all()
            self.assertEqual(len((await s.exec(select(QuestionRelationship))).all()), 2)
        self.assertEqual(ents["Article 15(4)"], ("AUTHORED", 1.0))
        self.assertEqual(ents["Article 15"], ("AUTHORED", 0.7))  # implied parent provision
        self.assertEqual(ents["Article 21"][0], "RULE")  # found in the solution text
        self.assertEqual(ents["Government of India Act 1935"][0], "RULE")  # from the related list
        self.assertEqual({e.relation_type for e in edges}, {"provides_for", "related_to"})

    async def test_question_without_any_knowledge_input_is_fine(self):
        qid = await self.add_question("Other", None)
        result, = await self.enrich(qid)
        self.assertEqual((result.concepts, result.entities, result.relationships, result.issues), (0, 0, 0, []))


class TestSimilarity(KnowledgeDbTestCase):
    async def test_article_15_scenario_ranks_exact_matches_first(self):
        """Spec §16: A (15 + 15(4) + Reservation) > B (15 + Discrimination) > C (16(4) + Reservation)
        > D (14 + Right to Equality) > E (same Nano Theme only)."""
        current = await self.add_question("Right to Equality", {
            "entities": ["Article 15", "Article 15(4)"],
            "concepts": ["Right to Equality", "Reservation", "Prohibition of Discrimination"],
        })
        a = await self.add_question("Right to Equality", {"entities": ["Article 15", "Article 15(4)"], "concepts": ["Reservation"]})
        b = await self.add_question("Right to Equality", {"entities": ["Article 15"], "concepts": ["Prohibition of Discrimination"]})
        c = await self.add_question("Equality in Public Employment", {"entities": ["Article 16(4)"], "concepts": ["Reservation"]})
        d = await self.add_question("Equality before Law", {"entities": ["Article 14"], "concepts": ["Right to Equality"]})
        e = await self.add_question("Right to Equality", None)
        # "Right to Equality" is a broad concept used across many questions
        fillers = [await self.add_question("Other", {"concepts": ["Right to Equality"]}) for _ in range(3)]
        unpublished = await self.add_question(
            "Right to Equality", {"entities": ["Article 15"]}, status=QuestionStatus.PENDING_HUMAN_REVIEW
        )
        await self.enrich(current, a, b, c, d, e, *fillers, unpublished)

        results = await self.similar(current, limit=20)
        order = [r["question_id"] for r in results]
        self.assertNotIn(current, order)
        self.assertNotIn(unpublished, order)
        self.assertEqual(len(order), len(set(order)))
        self.assertLess(order.index(a), order.index(b))
        self.assertLess(order.index(b), order.index(c))
        self.assertLess(order.index(c), order.index(d))
        self.assertLess(order.index(d), order.index(e))

        by_id = {r["question_id"]: r for r in results}
        self.assertEqual(by_id[a]["tier"], "exact")
        self.assertIn("Exact entity: Article 15", by_id[a]["match_reasons"])
        self.assertIn("Specific provision: Article 15(4)", by_id[a]["match_reasons"])
        self.assertIn("Concept: Reservation", by_id[c]["match_reasons"])
        self.assertEqual(by_id[e]["tier"], "nano_theme")
        self.assertEqual(by_id[e]["match_reasons"], ["Same Nano Theme", "Same Microtheme"])
        self.assertEqual(by_id[a]["subtopic_name"], "Right to Equality")

        top2 = await self.similar(current, limit=2, min_score=0)
        self.assertEqual([r["question_id"] for r in top2], [a, b])
        self.assertTrue(all(r["score"] >= 60 for r in await self.similar(current, min_score=60)))

    async def test_relationship_neighbours_and_taxonomy_fallback(self):
        current = await self.add_question("Other", {
            "entities": ["Suba"],
            "relationships": [{"source": "Suba", "relation": "divided_into", "target": "Sarkar"}],
        })
        linked = await self.add_question("Right to Equality", {"entities": ["Sarkar"]})
        plain = await self.add_question("Other", None)
        await self.enrich(current, linked, plain)

        results = {r["question_id"]: r for r in await self.similar(current)}
        self.assertEqual(results[linked]["tier"], "related")
        self.assertEqual(results[linked]["match_reasons"], ["Relationship: Suba → Sarkar"])
        self.assertNotIn("Relationship", " ".join((await self.similar(current, include_related=False))[0]["match_reasons"]))

        # A question with no knowledge data still gets taxonomy-based suggestions
        fallback = await self.similar(plain)
        self.assertEqual([r["question_id"] for r in fallback], [current])
        self.assertEqual(fallback[0]["tier"], "nano_theme")



class TestKnowledgeApi(KnowledgeDbTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        from httpx import AsyncClient, ASGITransport
        from app.cache import get_cache
        from app.db.session import get_async_session
        from app.fastapi_server import app

        async def override_get_session():
            async with self.session_factory() as session:
                yield session

        self.app = app
        app.dependency_overrides[get_async_session] = override_get_session
        await get_cache().clear()
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        self.app.dependency_overrides.clear()
        await super().asyncTearDown()

    async def test_similar_and_knowledge_endpoints(self):
        current = await self.add_question("Right to Equality", {
            "entities": ["Article 15"], "concepts": ["Reservation"],
            "relationships": [{"source": "Article 15", "relation": "", "target": "Right to Equality"}],
        })
        match = await self.add_question("Right to Equality", {"entities": ["Article 15"]})
        hidden = await self.add_question(
            "Right to Equality", {"entities": ["Article 15"]}, status=QuestionStatus.PENDING_HUMAN_REVIEW
        )
        await self.enrich(current, match, hidden)

        res = await self.client.get(f"/api/v1/questions/{current}/similar?limit=5")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["question_id"], current)
        self.assertEqual([r["question_id"] for r in body["results"]], [match])
        self.assertEqual(body["results"][0]["tier"], "exact")
        self.assertIn("Exact entity: Article 15", body["results"][0]["match_reasons"])

        knowledge = (await self.client.get(f"/api/v1/questions/{current}/knowledge")).json()
        self.assertEqual([e["name"] for e in knowledge["entities"]], ["Article 15"])
        self.assertEqual([c["name"] for c in knowledge["concepts"]], ["Reservation"])
        self.assertEqual(
            knowledge["relationships"], [{"source": "Article 15", "relation": "related_to", "target": "Right to Equality"}]
        )

        # Unpublished questions are invisible to students, like GET /questions/{id}
        self.assertEqual((await self.client.get(f"/api/v1/questions/{hidden}/similar")).status_code, 404)
        self.assertEqual((await self.client.get(f"/api/v1/questions/{hidden}/knowledge")).status_code, 404)
        self.assertEqual((await self.client.get("/api/v1/questions/abc/similar")).status_code, 404)

    async def test_similar_cards_do_not_leak_the_answer_key(self):
        current = await self.add_question("Right to Equality", {"entities": ["Article 15"]})
        match = await self.add_question("Right to Equality", {"entities": ["Article 15"]})
        async with self.session_factory() as s:
            for i, label in enumerate("ABCD"):
                s.add(QuestionOption(question_id=match, option_label=label, display_order=i + 1, is_correct=label == "C"))
            await s.commit()
        await self.enrich(current, match)

        body = (await self.client.get(f"/api/v1/questions/{current}/similar?include_question=true")).json()
        options = body["results"][0]["question"]["options"]
        self.assertEqual([o["option_label"] for o in options], ["A", "B", "C", "D"])
        self.assertTrue(all("is_correct" not in o for o in options))

        # The key is only served by the solution endpoint, which cards call after an answer
        solution = (await self.client.get(f"/api/v1/questions/{match}/solution")).json()
        self.assertEqual(solution["correct_option_label"], "C")


if __name__ == "__main__":
    unittest.main()
