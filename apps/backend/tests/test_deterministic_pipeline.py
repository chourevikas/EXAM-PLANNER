import pytest
import unittest
from unittest.mock import MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    QuestionTranslation,
    OptionTranslation,
    QuestionExplanation,
    QuestionOptionReasoning,
    HumanReviewTask,
    PipelineRun,
    Subject,
    Topic,
    Subtopic,
    QuestionHierarchyLink,
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
            assert q.extraction_method == "DOCLING_REGEX"
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

    async def test_deprecated_endpoints_return_410(self):
        """Verify that retired Pipeline 2 & 3 endpoints return HTTP 410 Gone."""
        from httpx import AsyncClient, ASGITransport
        from app.fastapi_server import app

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp1 = await client.post("/api/v1/answer-keys/upload")
            assert resp1.status_code == 410
            assert "deprecated" in resp1.json()["detail"].lower()

            resp2 = await client.post("/api/v1/explanations/generate/1")
            assert resp2.status_code == 410
            assert "deprecated" in resp2.json()["detail"].lower()

            resp3 = await client.post("/api/v1/pipeline/upload-answer-key")
            assert resp3.status_code == 410
            assert "deprecated" in resp3.json()["detail"].lower()

            resp4 = await client.post("/api/v1/pipeline/trigger-explanation/1")
            assert resp4.status_code == 410
            assert "deprecated" in resp4.json()["detail"].lower()
