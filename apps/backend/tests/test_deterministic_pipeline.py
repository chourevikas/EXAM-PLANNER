import unittest
from unittest.mock import MagicMock
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Exam,
    HumanReviewTask,
    OptionTranslation,
    Question,
    QuestionExplanation,
    QuestionHierarchyLink,
    QuestionOption,
    QuestionOptionReasoning,
    QuestionTranslation,
    Subject,
    Subtopic,
    Topic,
)
from app.db.models.enums import DifficultyLevel, ExamStatus
from app.pipeline.regex_question_parser import QuestionRecord, parse_question_block
from app.pipeline.batch_processor import BatchQuestionRegistrar
from app.services.pipeline_management_service import PipelineManagementService


class TestDeterministicPipeline(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = async_sessionmaker(
            bind=self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def test_batch_persistence_and_reasoning_link(self):
        """Verify that commit_question_records_in_batches stores full question graph."""
        async with self.session_factory() as session:
            # Create test exam
            exam = Exam(
                code="UPSC_2021_TEST",
                name="UPSC Prelims 2021 Test",
                status=ExamStatus.PENDING_HUMAN_REVIEW,
                total_questions=1,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            # Create mock storage provider
            mock_storage = MagicMock()
            mock_storage.save_image.return_value = "assets/test_img.png"

            # Create QuestionRecord with reverse logic and explanations
            rec = QuestionRecord(
                question_number=1,
                subject_raw="History & Culture",
                topic_raw="Ancient Indian Literature",
                subtopic_raw="Sanskrit Dramatists",
                difficulty_raw="Tough",
                difficulty=DifficultyLevel.HARD,
                stem="With reference to ancient India, Bhavabhuti was a famous:",
                statement_lines=[],
                options={
                    "A": "Jain monk",
                    "B": "playwright",
                    "C": "temple architect",
                    "D": "philosopher",
                },
                answer_label="B",
                answer_text="playwright",
                solution_text="Bhavabhuti was an 8th-century playwright and dramatist.",
                common_mistake="Students confuse Hastimalla with a monk.",
                reverse_logic={
                    "A": {
                        "why_tempting": "Jainism is prominent",
                        "whats_actually_true": "Hastimalla was a poet, not a monk",
                    },
                    "C": {
                        "why_tempting": "Architecture flourished",
                        "whats_actually_true": "Ramappa was an architect, not Bhavabhuti",
                    },
                },
                page_numbers=[1],
                pictures=[],
                tables=[],
                extraction_confidence=1.0,
                extraction_issues=[],
            )

            from contextlib import asynccontextmanager
            @asynccontextmanager
            async def get_test_session():
                async with self.session_factory() as s:
                    yield s

            # Persist via batch processor
            registrar = BatchQuestionRegistrar(session_factory=get_test_session)
            summary = await registrar.commit_question_records_in_batches(
                exam_id=exam_id,
                records=[rec],
                storage=mock_storage,
            )

            assert summary.total_processed_questions == 1
            assert summary.failed_batches == 0

            # Verify Question row
            q_res = await session.exec(select(Question).where(Question.exam_id == exam_id))
            q = q_res.first()
            assert q is not None
            assert q.question_number_in_paper == 1
            assert q.subject_raw == "History & Culture"
            assert q.topic_raw == "Ancient Indian Literature"
            assert q.subtopic_raw == "Sanskrit Dramatists"
            assert q.difficulty_raw == "Tough"
            assert q.difficulty == DifficultyLevel.HARD
            assert q.extraction_confidence == 1.0

            # Verify Options and Correct Answer
            opt_res = await session.exec(select(QuestionOption).where(QuestionOption.question_id == q.id))
            options = {opt.option_label: opt for opt in opt_res.all()}
            assert len(options) == 4
            assert options["B"].is_correct is True
            assert options["A"].is_correct is False

            # Verify Translations
            trans_res = await session.exec(select(QuestionTranslation).where(QuestionTranslation.question_id == q.id))
            q_trans = trans_res.first()
            assert q_trans is not None
            assert "Bhavabhuti was a famous" in q_trans.question_text

            # Verify Dynamic Taxonomy Mapping under SyllabusVersion
            assert q.subtopic_id is not None
            subtopic = await session.get(Subtopic, q.subtopic_id)
            assert subtopic is not None
            assert subtopic.name == "Sanskrit Dramatists"
            topic = await session.get(Topic, subtopic.topic_id)
            assert topic is not None
            assert topic.name == "Ancient Indian Literature"
            subject = await session.get(Subject, topic.subject_id)
            assert subject is not None
            assert subject.name == "History & Culture"

            # Verify Primary Hierarchy Link
            link_res = await session.exec(
                select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id == q.id)
            )
            link = link_res.first()
            assert link is not None
            assert link.subtopic_id == q.subtopic_id
            assert link.is_primary is True

            # Verify Explanation & Common Traps mapping
            exp_res = await session.exec(select(QuestionExplanation).where(QuestionExplanation.question_id == q.id))
            exp = exp_res.first()
            assert exp is not None
            assert exp.core_concept == "Sanskrit Dramatists"
            assert "8th-century playwright" in exp.detailed_solution
            assert "Students confuse Hastimalla" in exp.common_mistake
            assert exp.common_traps_json == [exp.common_mistake]

            # Verify Distractor Analysis on Option Translations
            opt_b_trans = (await session.exec(
                select(OptionTranslation).where(OptionTranslation.option_id == options["B"].id)
            )).first()
            assert opt_b_trans is not None
            # Correct option receives complete solution
            assert opt_b_trans.distractor_analysis == "Bhavabhuti was an 8th-century playwright and dramatist."

            opt_a_trans = (await session.exec(
                select(OptionTranslation).where(OptionTranslation.option_id == options["A"].id)
            )).first()
            assert opt_a_trans is not None
            # Incorrect option receives Reverse Logic format
            assert "Why it seems tempting — Jainism is prominent" in opt_a_trans.distractor_analysis
            assert "What's actually true — Hastimalla was a poet, not a monk" in opt_a_trans.distractor_analysis

            # Verify Reverse Logic Reasoning linked to Options
            opt_a_reasoning = (await session.exec(
                select(QuestionOptionReasoning).where(QuestionOptionReasoning.question_option_id == options["A"].id)
            )).first()
            assert opt_a_reasoning is not None
            assert opt_a_reasoning.why_tempting == "Jainism is prominent"
            assert opt_a_reasoning.whats_actually_true == "Hastimalla was a poet, not a monk"

    async def test_confidence_flag_and_hitl_task_creation(self):
        """Verify that corrupted questions drop confidence and generate HumanReviewTask."""
        async with self.session_factory() as session:
            exam = Exam(code="CORRUPTED_EXAM", name="Corrupted Exam", status=ExamStatus.PENDING_HUMAN_REVIEW, total_questions=1)
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            mock_storage = MagicMock()

            # Corrupted question: only 2 options instead of 4, no answer
            corrupted_block = {
                "question_number": 5,
                "header_line": "Q5. [Subject: Science]",
                "raw_text": "Q5. [Subject: Science]\nIs light a wave or particle?\n(A) Wave\n(B) Particle\n",
                "page_numbers": [1],
            }
            rec = parse_question_block(corrupted_block)
            assert rec.extraction_confidence < 0.8
            assert "NO_ANSWER_LINE" in rec.extraction_issues
            assert any("MISSING_OPTION" in issue for issue in rec.extraction_issues)

            from contextlib import asynccontextmanager
            @asynccontextmanager
            async def get_test_session():
                async with self.session_factory() as s:
                    yield s

            registrar = BatchQuestionRegistrar(session_factory=get_test_session)
            summary = await registrar.commit_question_records_in_batches(
                exam_id=exam.id,
                records=[rec],
                storage=mock_storage,
            )

            assert summary.total_processed_questions == 1
            assert summary.failed_batches == 0

            # Check that HumanReviewTask was created
            task_res = await session.exec(select(HumanReviewTask).where(HumanReviewTask.exam_id == exam.id))
            task = task_res.first()
            assert task is not None
            assert task.review_status == "PENDING_REVIEW"
            assert task.is_flagged_by_validator is True

            # Check Pipeline Status resolution
            pm = PipelineManagementService(session)
            run = await pm.on_pipeline_1_completed(exam.id)
            assert run.pipeline_type == "DOCUMENT_EXTRACTION"
            assert run.status == "WAITING_FOR_HITL"

    async def test_microtheme_and_nano_theme_db_mapping(self):
        """Verify that Microtheme and Nano Theme from PDF are persisted into Subject, Topic, Subtopic in DB."""
        from app.pipeline.regex_question_parser import split_into_question_blocks, parse_question_block
        from contextlib import asynccontextmanager

        pdf_text = """
Q1. [Subject: Ancient History] [Microtheme: Ancient TechXAgriculture] [Nano Theme: Araghatta — ancient irrigation device] [Difficulty: Moderate]
The irrigation device called 'Araghatta' was
(A) a water bag made of leather pulled over a pulley
(B) a large wheel with earthen pots tied to the outer ends of its spokes
(C) a larger earthen pot driven by bullocks
(D) a large water bucket pulled up by rope directly by hand
Answer: (B) a large wheel with earthen pots tied to the outer ends of its spokes
Solution:
• 'Araghatta' was specifically a large water-lifting WHEEL with several earthen pots attached to its rim/spokes.

■ Reverse Logic Box — Why the other options are wrong
Option (A): Why it seems tempting — Leather-bag system sounds plausible. What's actually true — Araghatta is a wheel-with-pots mechanism.
Option (C): Why it seems tempting — Bullock pot sounds plausible. What's actually true — Araghatta is a rotating wheel with pots.
Option (D): Why it seems tempting — Manual rope bucket represents simple irrigation. What's actually true — Mechanized rotating wheel.

Q2. [Subject: Ancient History] [Microtheme: KingdomXPallava] [Nano Theme: Pallava ruler titles — Mahendravarman I] [Difficulty: Tough]
Who among the following rulers in ancient India had assumed the titles 'Mattavilasa', 'Vichitrachitta', 'Gunabhara'?
(A) Mahendravarman I
(B) Simhavishnu
(C) Narasimhavarman I
(D) Simhavarman
Answer: (A) Mahendravarman I
Solution:
• MAHENDRAVARMAN I assumed these titles.
"""
        blocks = split_into_question_blocks(pdf_text)
        assert len(blocks) == 2
        q1_rec = parse_question_block(blocks[0])
        q2_rec = parse_question_block(blocks[1])

        async with self.session_factory() as session:
            exam = Exam(
                code="UPSC_2025_PRELIMS",
                name="UPSC Civil Services Examination (Prelims) 2025",
                status=ExamStatus.PENDING_HUMAN_REVIEW,
                total_questions=2,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            @asynccontextmanager
            async def get_test_session():
                async with self.session_factory() as s:
                    yield s

            registrar = BatchQuestionRegistrar(session_factory=get_test_session)
            summary = await registrar.commit_question_records_in_batches(
                exam_id=exam_id,
                records=[q1_rec, q2_rec],
            )
            assert summary.total_processed_questions == 2
            assert summary.failed_batches == 0

            # 1. Verify Subjects
            s_res = await session.exec(select(Subject).where(Subject.name == "Ancient History"))
            subject = s_res.first()
            assert subject is not None
            assert subject.name == "Ancient History"

            # 2. Verify Topics (created from Microtheme)
            t_res = await session.exec(select(Topic).where(Topic.subject_id == subject.id))
            topics = {t.name: t for t in t_res.all()}
            assert "Ancient TechXAgriculture" in topics
            assert "KingdomXPallava" in topics

            # 3. Verify Subtopics (created from Nano Theme)
            st1_res = await session.exec(
                select(Subtopic).where(Subtopic.topic_id == topics["Ancient TechXAgriculture"].id)
            )
            subtopics_t1 = {st.name: st for st in st1_res.all()}
            assert "Araghatta — ancient irrigation device" in subtopics_t1

            st2_res = await session.exec(
                select(Subtopic).where(Subtopic.topic_id == topics["KingdomXPallava"].id)
            )
            subtopics_t2 = {st.name: st for st in st2_res.all()}
            assert "Pallava ruler titles — Mahendravarman I" in subtopics_t2

            # 4. Verify Questions linkage and raw fields
            q_res = await session.exec(
                select(Question).where(Question.exam_id == exam_id).order_by(Question.question_number_in_paper)
            )
            qs = q_res.all()
            assert len(qs) == 2

            assert qs[0].question_number_in_paper == 1
            assert qs[0].subject_raw == "Ancient History"
            assert qs[0].topic_raw == "Ancient TechXAgriculture"
            assert qs[0].subtopic_raw == "Araghatta — ancient irrigation device"
            assert qs[0].difficulty_raw == "Moderate"
            assert qs[0].difficulty == DifficultyLevel.MEDIUM
            assert qs[0].subtopic_id == subtopics_t1["Araghatta — ancient irrigation device"].id

            assert qs[1].question_number_in_paper == 2
            assert qs[1].subject_raw == "Ancient History"
            assert qs[1].topic_raw == "KingdomXPallava"
            assert qs[1].subtopic_raw == "Pallava ruler titles — Mahendravarman I"
            assert qs[1].difficulty_raw == "Tough"
            assert qs[1].difficulty == DifficultyLevel.HARD
            assert qs[1].subtopic_id == subtopics_t2["Pallava ruler titles — Mahendravarman I"].id

            # 5. Verify QuestionHierarchyLink
            links_res = await session.exec(
                select(QuestionHierarchyLink).where(
                    QuestionHierarchyLink.question_id.in_([qs[0].id, qs[1].id])
                )
            )
            links = links_res.all()
            assert len(links) == 2
            link_map = {l.question_id: l for l in links}
            assert link_map[qs[0].id].subtopic_id == qs[0].subtopic_id
            assert link_map[qs[1].id].subtopic_id == qs[1].subtopic_id

    async def test_missing_topic_and_subtopic_fallback_behavior(self):
        """Verify fallback behavior when Topic or Subtopic is missing."""
        from contextlib import asynccontextmanager

        # Case 1: Both Topic and Subtopic missing -> Subject becomes Topic and Subtopic
        rec_both_missing = QuestionRecord(
            question_number=10,
            subject_raw="Modern History",
            topic_raw=None,
            subtopic_raw=None,
            difficulty_raw="Easy",
            difficulty=DifficultyLevel.EASY,
            stem="When did India gain independence?",
            statement_lines=[],
            options={"A": "1947", "B": "1950", "C": "1942", "D": "1935"},
            answer_label="A",
            solution_text="India gained independence in 1947.",
            page_numbers=[1],
        )

        # Case 2: Topic is missing, Subtopic is present -> Subject becomes Topic, Subtopic is preserved
        rec_topic_missing = QuestionRecord(
            question_number=11,
            subject_raw="Modern History",
            topic_raw=None,
            subtopic_raw="Quit India Movement",
            difficulty_raw="Medium",
            difficulty=DifficultyLevel.MEDIUM,
            stem="The Quit India movement was launched in:",
            statement_lines=[],
            options={"A": "1940", "B": "1942", "C": "1944", "D": "1946"},
            answer_label="B",
            solution_text="Quit India movement was launched in August 1942.",
            page_numbers=[1],
        )

        # Case 3: Subtopic is missing, Topic is present -> Topic becomes Subtopic
        rec_subtopic_missing = QuestionRecord(
            question_number=12,
            subject_raw="Modern History",
            topic_raw="Indian National Congress Sessions",
            subtopic_raw=None,
            difficulty_raw="Medium",
            difficulty=DifficultyLevel.MEDIUM,
            stem="Who presided over the 1929 Lahore session?",
            statement_lines=[],
            options={"A": "Jawaharlal Nehru", "B": "Gandhi", "C": "Subhash Bose", "D": "Patel"},
            answer_label="A",
            solution_text="Jawaharlal Nehru presided over the Lahore session in 1929.",
            page_numbers=[1],
        )

        async with self.session_factory() as session:
            exam = Exam(
                code="FALLBACK_TEST_EXAM",
                name="Fallback Test Exam",
                status=ExamStatus.PENDING_HUMAN_REVIEW,
                total_questions=3,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            @asynccontextmanager
            async def get_test_session():
                async with self.session_factory() as s:
                    yield s

            registrar = BatchQuestionRegistrar(session_factory=get_test_session)
            summary = await registrar.commit_question_records_in_batches(
                exam_id=exam_id,
                records=[rec_both_missing, rec_topic_missing, rec_subtopic_missing],
            )
            assert summary.total_processed_questions == 3
            assert summary.failed_batches == 0

            # Verify Case 1: Both missing
            # Subject: "Modern History" -> Topic: "Modern History" -> Subtopic: "Modern History"
            q10 = (await session.exec(select(Question).where(Question.question_number_in_paper == 10))).first()
            assert q10 is not None
            st10 = await session.get(Subtopic, q10.subtopic_id)
            assert st10.name == "Modern History"
            t10 = await session.get(Topic, st10.topic_id)
            assert t10.name == "Modern History"
            s10 = await session.get(Subject, t10.subject_id)
            assert s10.name == "Modern History"

            # Verify Case 2: Topic missing, Subtopic present
            # Subject: "Modern History" -> Topic: "Modern History" -> Subtopic: "Quit India Movement"
            q11 = (await session.exec(select(Question).where(Question.question_number_in_paper == 11))).first()
            assert q11 is not None
            st11 = await session.get(Subtopic, q11.subtopic_id)
            assert st11.name == "Quit India Movement"
            t11 = await session.get(Topic, st11.topic_id)
            assert t11.name == "Modern History"

            # Verify Case 3: Subtopic missing, Topic present
            # Subject: "Modern History" -> Topic: "Indian National Congress Sessions" -> Subtopic: "Indian National Congress Sessions"
            q12 = (await session.exec(select(Question).where(Question.question_number_in_paper == 12))).first()
            assert q12 is not None
            st12 = await session.get(Subtopic, q12.subtopic_id)
            assert st12.name == "Indian National Congress Sessions"
            t12 = await session.get(Topic, st12.topic_id)
            assert t12.name == "Indian National Congress Sessions"

    async def test_reextraction_replaces_assets_and_clears_question_cache(self):
        """Re-committing a question keeps exactly one asset per picture and drops its cached payloads."""
        from contextlib import asynccontextmanager
        from unittest.mock import AsyncMock, patch
        from app.db.models import QuestionAsset

        async with self.session_factory() as session:
            exam = Exam(code="REEXTRACT_TEST", name="Re-extract Test", status=ExamStatus.PENDING_HUMAN_REVIEW, total_questions=1)
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

        rec = QuestionRecord(
            question_number=13,
            stem="Study the following diagram and answer the question.",
            statement_lines=[],
            options={"A": "Circle", "B": "Square", "C": "Triangle", "D": "Star"},
            answer_label="A",
            answer_text="Circle",
            page_numbers=[2],
            pictures=[{"id": 1, "page_no": 2, "bbox": [10, 10, 60, 40]}],
            tables=[],
            extraction_confidence=1.0,
            extraction_issues=[],
        )

        @asynccontextmanager
        async def get_test_session():
            async with self.session_factory() as s:
                yield s

        registrar = BatchQuestionRegistrar(session_factory=get_test_session)
        invalidate = AsyncMock()
        with patch("app.cache.invalidate_question_cache", invalidate):
            for _ in range(2):
                summary = await registrar.commit_question_records_in_batches(exam_id=exam_id, records=[rec])
                assert summary.failed_batches == 0

        async with self.session_factory() as session:
            q = (await session.exec(select(Question).where(Question.exam_id == exam_id))).one()
            assets = (await session.exec(select(QuestionAsset).where(QuestionAsset.question_id == q.id))).all()
            assert len(assets) == 1
        invalidate.assert_any_await(str(q.id), str(exam_id))
        assert invalidate.await_count == 2
