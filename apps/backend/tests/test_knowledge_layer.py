import json
import unittest

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    DifficultyLevel,
    Exam,
    LanguageCode,
    Question,
    QuestionExplanation,
    QuestionHierarchyLink,
    QuestionOption,
    QuestionStatus,
    QuestionTranslation,
    Subject,
    Subtopic,
    Topic,
)
from app.db.models.hierarchy import SyllabusVersion
from app.db.models.passage import Passage
from app.db.models.knowledge import (
    KnowledgeAlias,
    KnowledgeConcept,
    KnowledgeEntity,
    KnowledgeRelationship,
    QuestionConcept,
    QuestionEntity,
    QuestionRelationship,
)
from app.knowledge.ai_extractor import (
    PROMPT_FINGERPRINT,
    PROMPT_VERSION,
    SYLLABUS_LEVELS,
    AIEntity,
    AIKnowledgeBatch,
    AIQuestionKnowledge,
    AIRelationship,
    AISyllabus,
    KnowledgeAIExtractor,
    clean_ai_knowledge,
    clean_ai_syllabus,
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
            self.topic_of = {}
            self.version_id = version.id
            for nano, topic in (
                ("Right to Equality", "Fundamental Rights"),
                ("Equality in Public Employment", "Fundamental Rights"),
                ("Equality before Law", "Fundamental Rights"),
                ("Other", "Misc"),
            ):
                self.nanos[nano] = Subtopic(topic_id=self.topics[topic].id, name=nano)
                self.topic_of[nano] = topic
                s.add(self.nanos[nano])
            await s.commit()
        self.number = 0

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def add_question(self, nano: str, tags: dict | None = None, solution: str = "", stem: str = "Q",
                           status=QuestionStatus.PUBLISHED, subtopic_id: int | None = None,
                           syllabus_raw: tuple | None = None) -> int:
        """`syllabus_raw` = the PDF's (Subject, Microtheme, Nano Theme) tags; defaults to fully tagged."""
        self.number += 1
        sub = self.nanos.get(nano)
        raw = syllabus_raw if syllabus_raw is not None else ("Polity", self.topic_of.get(nano), nano)
        async with self.session_factory() as s:
            q = Question(
                exam_id=self.exam.id, question_number_in_paper=self.number, status=status,
                subtopic_id=subtopic_id or sub.id, knowledge_tags_raw=tags,
                subject_raw=raw[0], topic_raw=raw[1], subtopic_raw=raw[2],
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


class FakeChatModel:
    """Stands in for the Gemini chat model: answers from `responder(question_payload)` per question."""

    def __init__(self, responder, fail=False):
        self.responder = responder
        self.fail = fail
        self.calls = []

    def with_structured_output(self, schema):
        assert schema is AIKnowledgeBatch
        return self

    async def ainvoke(self, messages):
        payload = json.loads(messages[1]["content"].split("\n\n", 1)[1])
        self.calls.append(payload)
        if self.fail:
            raise RuntimeError("403 PERMISSION_DENIED")
        return AIKnowledgeBatch(questions=[
            AIQuestionKnowledge(question_id=q["question_id"], **self.responder(q)) for q in payload["questions"]
        ])


def article_15_tags(q):
    if "Article 15" not in q["question"] and "discrimination" not in q["question"]:
        return {}
    return {
        "concepts": ["Reservation", "Right to Equality", "reservation"],
        "entities": [AIEntity(name="Art. 15(4)", type="CONSTITUTION_ARTICLE"),
                     AIEntity(name="Kalelkar Commission", type="COMMITTEE")],
        "relationships": [
            AIRelationship(source="Art. 15(4)", relation="provides_for", target="Reservation"),
            AIRelationship(source="Invented Thing", relation="related_to", target="Reservation"),
        ],
    }


class AITestCase(KnowledgeDbTestCase):
    def service(self, model, batch_size=8):
        return KnowledgeEnrichmentService(
            self.session_factory, ai_extractor=KnowledgeAIExtractor(lambda: model, batch_size=batch_size, model_name="fake")
        )

    async def links(self, qid):
        async with self.session_factory() as s:
            ents = {
                e.canonical_name: (link.source, round(link.relevance, 2))
                for link, e in (await s.exec(
                    select(QuestionEntity, KnowledgeEntity).join(KnowledgeEntity, KnowledgeEntity.id == QuestionEntity.entity_id)
                    .where(QuestionEntity.question_id == qid)
                )).all()
            }
            concepts = {
                c.canonical_name: (link.source, round(link.weight, 2))
                for link, c in (await s.exec(
                    select(QuestionConcept, KnowledgeConcept).join(KnowledgeConcept, KnowledgeConcept.id == QuestionConcept.concept_id)
                    .where(QuestionConcept.question_id == qid)
                )).all()
            }
        return ents, concepts


class TestAIExtraction(AITestCase):
    def test_prompt_changes_require_a_version_bump(self):
        # Edited SYSTEM_PROMPT or the output schema? Bump PROMPT_VERSION (stored AI tags are then
        # re-extracted on the next run) and update this pair.
        self.assertEqual((PROMPT_VERSION, PROMPT_FINGERPRINT), ("kl-ai-v4", "2d6bb6d7bf0d"))
    def test_model_output_is_cleaned(self):
        tags = clean_ai_knowledge(AIQuestionKnowledge(question_id=1, **article_15_tags({"question": "Article 15"})))
        self.assertEqual(tags["concepts"], ["Reservation", "Right to Equality"])
        self.assertEqual(tags["entities"], ["Art. 15(4)", "Kalelkar Commission"])
        self.assertEqual(tags["entity_types"]["Kalelkar Commission"], "COMMITTEE")
        # relationships may only connect names listed for the same question
        self.assertEqual(tags["relationships"], [{"source": "Art. 15(4)", "relation": "provides_for", "target": "Reservation"}])

    async def test_untagged_question_gets_ai_links(self):
        async with self.session_factory() as s:
            await seed_masters(s, [{"name": "Article 15(4)", "type": "CONSTITUTION_ARTICLE", "parent": "Article 15"}], [])
            await s.commit()
        qid = await self.add_question("Right to Equality", None, stem="Which clause of Article 15 enables special provisions?")
        model = FakeChatModel(article_15_tags)
        result, = await self.service(model).enrich_exam(self.exam.id)

        self.assertEqual(result.ai, "extracted")
        # The model is shown the existing canonical names and the question's syllabus position
        self.assertIn("Article 15(4)", model.calls[0]["existing_vocabulary"]["entities"])
        self.assertEqual(model.calls[0]["questions"][0]["syllabus"], "Polity > Fundamental Rights > Right to Equality")
        ents, concepts = await self.links(qid)
        self.assertEqual(ents["Article 15(4)"], ("AI", 0.85))  # "Art. 15(4)" resolved to the canonical node
        self.assertEqual(ents["Article 15"], ("RULE", 0.6))  # named in the stem; beats the implied parent (0.85 x 0.7)
        self.assertEqual(ents["Kalelkar Commission"], ("AI", 0.85))
        self.assertEqual(concepts, {"Reservation": ("AI", 0.85), "Right to Equality": ("AI", 0.85)})
        async with self.session_factory() as s:
            stored = (await s.get(Question, qid)).knowledge_tags_ai
            new_entity = (await s.exec(select(KnowledgeEntity).where(KnowledgeEntity.canonical_name == "Kalelkar Commission"))).one()
            self.assertEqual(len((await s.exec(select(QuestionRelationship))).all()), 1)
        self.assertEqual(
            (stored["model"], stored["prompt_version"], stored["prompt_fingerprint"]), ("fake", PROMPT_VERSION, PROMPT_FINGERPRINT)
        )
        self.assertEqual((new_entity.entity_type, new_entity.status), ("COMMITTEE", "PENDING_REVIEW"))

    async def test_stored_ai_tags_are_reused_until_text_changes(self):
        qid = await self.add_question("Right to Equality", None, stem="Article 15 prohibits discrimination")
        model = FakeChatModel(article_15_tags)
        service = self.service(model)
        await service.enrich_exam(self.exam.id)
        again, = await service.enrich_exam(self.exam.id)
        self.assertEqual((again.ai, len(model.calls)), ("cached", 1))
        self.assertEqual((await self.links(qid))[0]["Article 15(4)"], ("AI", 0.85))

        refreshed, = await service.enrich_exam(self.exam.id, refresh_ai=True)
        self.assertEqual((refreshed.ai, len(model.calls)), ("extracted", 2))

        async with self.session_factory() as s:
            row = (await s.exec(select(QuestionTranslation).where(QuestionTranslation.question_id == qid))).one()
            row.question_text = "Article 15 and Article 16 compared"
            s.add(row)
            await s.commit()
        edited, = await service.enrich_exam(self.exam.id)
        self.assertEqual((edited.ai, len(model.calls)), ("extracted", 3))

    async def test_questions_are_batched_and_failures_fall_back_to_rules(self):
        ids = [await self.add_question("Right to Equality", None, stem=f"Article 15 question {i}") for i in range(3)]
        model = FakeChatModel(article_15_tags)
        await self.service(model, batch_size=2).enrich_exam(self.exam.id)
        self.assertEqual([len(c["questions"]) for c in model.calls], [2, 1])

        failing = FakeChatModel(article_15_tags, fail=True)
        results = await self.service(failing).enrich_exam(self.exam.id, refresh_ai=True)
        self.assertEqual({r.ai for r in results}, {"failed"})
        self.assertIn("AI_EXTRACTION_FAILED", results[0].issues)
        # Earlier AI tags are kept and rule-based links still apply
        ents, _ = await self.links(ids[0])
        self.assertEqual(ents["Article 15(4)"], ("AI", 0.85))
        self.assertEqual(ents["Article 15"], ("RULE", 0.6))

    async def test_authored_tags_outrank_ai_tags(self):
        qid = await self.add_question(
            "Right to Equality", {"entities": ["Article 15(4)"]}, stem="Which clause of Article 15 enables reservation?"
        )
        await self.service(FakeChatModel(article_15_tags)).enrich_exam(self.exam.id)
        ents, concepts = await self.links(qid)
        self.assertEqual(ents["Article 15(4)"], ("AUTHORED", 1.0))
        self.assertEqual(concepts["Reservation"], ("AI", 0.85))

    async def test_ai_tagged_questions_find_each_other(self):
        current = await self.add_question("Right to Equality", None, stem="Article 15(4) was added by")
        match = await self.add_question("Other", None, stem="Special provisions under Article 15 for backward classes")
        await self.service(FakeChatModel(article_15_tags)).enrich_exam(self.exam.id)
        top = (await self.similar(current))[0]
        self.assertEqual((top["question_id"], top["tier"]), (match, "exact"))
        self.assertIn("Specific provision: Article 15(4)", top["match_reasons"])


class TestAISyllabus(AITestCase):
    """Questions the PDF left without Subject > Microtheme > Nano Theme get them from the same AI call."""

    async def placeholder(self, subject: str | None = None) -> int:
        """The rows BatchQuestionRegistrar creates for an untagged question (exam name / subject fallbacks)."""
        s_name = subject or self.exam.name
        async with self.session_factory() as s:
            subj = (await s.exec(select(Subject).where(Subject.version_id == self.version_id, Subject.name == s_name))).first()
            if not subj:
                subj = Subject(version_id=self.version_id, name=s_name)
                s.add(subj)
                await s.flush()
            topic = Topic(subject_id=subj.id, name=s_name)
            s.add(topic)
            await s.flush()
            sub = Subtopic(topic_id=topic.id, name=s_name)
            s.add(sub)
            await s.commit()
            return sub.id

    @staticmethod
    def syllabus_responder(syllabus):
        def respond(q):
            tags = article_15_tags(q)
            if "syllabus_missing" in q:
                tags["syllabus"] = AISyllabus(**syllabus)
            return tags
        return respond

    async def placement(self, qid):
        async with self.session_factory() as s:
            q = await s.get(Question, qid)
            names = (await s.exec(
                select(Subject.name, Topic.name, Subtopic.name)
                .join(Topic, Topic.id == Subtopic.topic_id).join(Subject, Subject.id == Topic.subject_id)
                .where(Subtopic.id == q.subtopic_id)
            )).one()
            links = (await s.exec(select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id == qid))).all()
            return tuple(names), [(l.subtopic_id, l.is_primary) for l in links], q.subtopic_id

    def test_syllabus_answer_is_cleaned(self):
        known, missing = {"subject": "Polity"}, ["microtheme", "nano_theme"]
        answer = AISyllabus(subject="History", microtheme=" Fundamental Rights ", nano_theme="")
        # authored Subject wins; an empty Nano Theme falls back to the Microtheme
        self.assertEqual(clean_ai_syllabus(answer, known, missing),
                         {"subject": "Polity", "microtheme": "Fundamental Rights", "nano_theme": "Fundamental Rights"})
        self.assertIsNone(clean_ai_syllabus(AISyllabus(subject="", microtheme="X", nano_theme="Y"), {}, list(SYLLABUS_LEVELS)))
        self.assertIsNone(clean_ai_syllabus(answer, known, []))  # nothing was missing

    async def test_untagged_question_is_placed_in_existing_syllabus(self):
        await self.add_question("Right to Equality", None, stem="Tagged neighbour")
        untagged_sub = await self.placeholder()
        qid = await self.add_question(
            "Right to Equality", None, stem="Which Article prohibits discrimination?",
            subtopic_id=untagged_sub, syllabus_raw=(None, None, None),
        )
        async with self.session_factory() as s:
            s.add(QuestionHierarchyLink(question_id=qid, subtopic_id=untagged_sub, is_primary=True))
            await s.commit()
        model = FakeChatModel(self.syllabus_responder(
            {"subject": "polity", "microtheme": "Fundamental Rights", "nano_theme": "Right to Equality"}))
        results = await self.service(model).enrich_exam(self.exam.id)

        sent = {q["question_id"]: q for q in model.calls[0]["questions"]}
        self.assertEqual((sent[qid]["syllabus_known"], sent[qid]["syllabus_missing"]), ({}, list(SYLLABUS_LEVELS)))
        self.assertNotIn("syllabus_missing", sent[qid - 1])
        # Existing syllabus lines are offered; the placeholder rows are not
        self.assertIn("Polity > Fundamental Rights > Right to Equality", model.calls[0]["existing_syllabus"])
        self.assertFalse(any(self.exam.name in line for line in model.calls[0]["existing_syllabus"]))

        names, links, sub_id = await self.placement(qid)
        self.assertEqual(names, ("Polity", "Fundamental Rights", "Right to Equality"))  # reused rows, case-insensitive
        self.assertEqual((sub_id, links), (self.nanos["Right to Equality"].id, [(self.nanos["Right to Equality"].id, True)]))
        self.assertEqual(results[-1].syllabus, "polity > Fundamental Rights > Right to Equality")

        # The emptied placeholder chain is removed (Subject named after the exam included)
        async with self.session_factory() as s:
            self.assertIsNone(await s.get(Subtopic, untagged_sub))
            self.assertEqual((await s.exec(select(Subject).where(Subject.name == self.exam.name))).all(), [])

        # Stable after assignment: the next run reuses stored tags instead of asking again
        again = await self.service(model).enrich_exam(self.exam.id)
        self.assertEqual(({r.ai for r in again}, len(model.calls)), ({"cached"}, 1))
        # ...and the untagged question now finds its Nano Theme neighbour
        self.assertIn(qid - 1, [r["question_id"] for r in await self.similar(qid)])

    async def test_authored_levels_are_kept_and_new_themes_created(self):
        qid = await self.add_question(
            "Right to Equality", None, stem="Article 15 question", subtopic_id=await self.placeholder("Polity"),
            syllabus_raw=("Polity", None, None),
        )
        model = FakeChatModel(self.syllabus_responder(
            {"subject": "History", "microtheme": "Fundamental Rights", "nano_theme": "Protective Discrimination"}))
        await self.service(model).enrich_exam(self.exam.id)
        self.assertEqual(model.calls[0]["questions"][0]["syllabus_known"], {"subject": "Polity"})
        names, _, sub_id = await self.placement(qid)
        self.assertEqual(names, ("Polity", "Fundamental Rights", "Protective Discrimination"))
        self.assertNotIn(sub_id, [n.id for n in self.nanos.values()])  # new Nano Theme under the existing Microtheme

    async def test_new_rows_reuse_spelling_from_other_papers(self):
        async with self.session_factory() as s:
            other = Exam(name="UPPCS 2022", code="uppcs-2022", source_year=2022, is_active=True)
            s.add(other)
            await s.flush()
            version = SyllabusVersion(exam_id=other.id, version_code="V1")
            s.add(version)
            await s.flush()
            subj = Subject(version_id=version.id, name=other.name)
            s.add(subj)
            await s.flush()
            topic = Topic(subject_id=subj.id, name=other.name)
            s.add(topic)
            await s.flush()
            sub = Subtopic(topic_id=topic.id, name=other.name)
            s.add(sub)
            q = Question(exam_id=other.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED)
            s.add(q)
            await s.flush()
            q.subtopic_id = sub.id
            s.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text="Article 15 question"))
            await s.commit()
            qid = q.id
        model = FakeChatModel(self.syllabus_responder(
            {"subject": "POLITY", "microtheme": "fundamental rights", "nano_theme": "right to equality"}))
        await self.service(model).enrich_exam(other.id)
        names, _, sub_id = await self.placement(qid)
        self.assertEqual(names, ("Polity", "Fundamental Rights", "Right to Equality"))
        self.assertNotEqual(sub_id, self.nanos["Right to Equality"].id)  # its own exam's syllabus version

    async def test_question_bank_hints_reach_the_model(self):
        qid = await self.add_question(
            "Right to Equality", {"section": "Unemployment and Employment", "source": "MPSC Mains 2017"},
            stem="Article 15 question", subtopic_id=await self.placeholder(), syllabus_raw=(None, None, None),
        )
        model = FakeChatModel(self.syllabus_responder(
            {"subject": "Economy", "microtheme": "Unemployment and Employment", "nano_theme": "Employment Schemes"}))
        await self.service(model).enrich_exam(self.exam.id)
        sent = model.calls[0]["questions"][0]
        self.assertEqual((sent["pdf_section"], sent["source"]), ("Unemployment and Employment", "MPSC Mains 2017"))
        self.assertEqual((await self.placement(qid))[0], ("Economy", "Unemployment and Employment", "Employment Schemes"))

    async def test_placeholder_in_use_is_kept(self):
        shared = await self.placeholder()
        moved = await self.add_question("Right to Equality", None, stem="Article 15 question",
                                        subtopic_id=shared, syllabus_raw=(None, None, None))
        async with self.session_factory() as s:
            s.add(Passage(subtopic_id=shared))
            await s.commit()
        model = FakeChatModel(self.syllabus_responder(
            {"subject": "Polity", "microtheme": "Fundamental Rights", "nano_theme": "Right to Equality"}))
        await self.service(model).enrich_exam(self.exam.id)
        self.assertEqual((await self.placement(moved))[0], ("Polity", "Fundamental Rights", "Right to Equality"))
        async with self.session_factory() as s:
            self.assertIsNotNone(await s.get(Subtopic, shared))  # a passage still points at it

    async def test_missing_difficulty_is_rated_and_tags_win(self):
        untagged = await self.add_question("Right to Equality", None, stem="Article 15 obscure clause")
        tagged = await self.add_question("Right to Equality", None, stem="Article 15 basic")
        reviewed = await self.add_question("Right to Equality", None, stem="Article 15 reviewed")
        async with self.session_factory() as s:
            q = await s.get(Question, tagged)
            q.difficulty_raw, q.difficulty = "Easy", DifficultyLevel.EASY  # PDF said [Difficulty: Easy]
            r = await s.get(Question, reviewed)
            r.difficulty = DifficultyLevel.EASY  # a reviewer's choice on an untagged question
            await s.commit()

        def respond(q):
            return {**article_15_tags(q), **({"difficulty": "HARD"} if q.get("difficulty_missing") else {})}

        model = FakeChatModel(respond)
        results = {r.question_id: r for r in await self.service(model).enrich_exam(self.exam.id)}
        sent = {q["question_id"]: q for q in model.calls[0]["questions"]}
        self.assertTrue(sent[untagged]["difficulty_missing"])
        self.assertNotIn("difficulty_missing", sent[tagged])
        async with self.session_factory() as s:
            levels = {qid: (await s.get(Question, qid)).difficulty for qid in (untagged, tagged, reviewed)}
            stored = (await s.get(Question, tagged)).knowledge_tags_ai
        self.assertEqual(levels, {untagged: DifficultyLevel.HARD, tagged: DifficultyLevel.EASY, reviewed: DifficultyLevel.EASY})
        self.assertEqual((results[untagged].difficulty, results[reviewed].difficulty), ("HARD", None))
        self.assertNotIn("difficulty", stored)  # an answer for a tagged question is not even stored

    async def test_reviewer_placement_is_not_overwritten(self):
        # Untagged in the PDF, but a reviewer already moved it to a real Nano Theme
        qid = await self.add_question("Other", None, stem="Article 15 question", syllabus_raw=(None, None, None))
        model = FakeChatModel(self.syllabus_responder(
            {"subject": "Polity", "microtheme": "Fundamental Rights", "nano_theme": "Right to Equality"}))
        result, = await self.service(model).enrich_exam(self.exam.id)
        self.assertIsNone(result.syllabus)
        self.assertEqual((await self.placement(qid))[0], ("Polity", "Misc", "Other"))


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

    async def test_question_list_filters_by_difficulty(self):
        ids = [await self.add_question("Right to Equality", None, stem=f"Q{i}") for i in range(3)]
        async with self.session_factory() as s:
            for qid, level in zip(ids, (DifficultyLevel.EASY, DifficultyLevel.HARD, DifficultyLevel.HARD)):
                (await s.get(Question, qid)).difficulty = level
            await s.commit()

        async def listed(difficulty):
            res = await self.client.get("/api/v1/questions", params={"difficulty": difficulty, "limit": 100})
            return res.status_code, sorted(int(i["question_id"]) for i in res.json().get("items", []))

        self.assertEqual(await listed("HARD"), (200, ids[1:]))
        self.assertEqual(await listed("easy"), (200, ids[:1]))
        self.assertEqual(await listed("All Levels"), (200, ids))
        self.assertEqual((await listed("impossible"))[0], 400)

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
