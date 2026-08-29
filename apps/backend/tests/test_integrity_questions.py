import uuid
import unittest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.fastapi_server import app
from app.db.session import get_async_session
from app.db.models import (
    Exam,
    Subject,
    Topic,
    Subtopic,
    Question,
    QuestionTranslation,
    QuestionOption,
    QuestionExplanation,
    QuestionMetadata,
    LanguageCode,
    QuestionStatus,
    ExamStatus,
)
from app.services.syllabus_service import SyllabusService



class TestQuestionIntegrityEndpoints(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

        async def override_get_session():
            async with self.session_factory() as session:
                yield session

        app.dependency_overrides[get_async_session] = override_get_session

    async def asyncTearDown(self):
        app.dependency_overrides.clear()
        await self.engine.dispose()

    async def test_exam_question_integrity_endpoint(self):
        """Tests GET /api/v1/exams/{exam_id}/integrity-questions with various integrity scenarios and pagination."""
        async with self.session_factory() as session:
            # Create exam with total_questions = 4
            exam = Exam(
                code=f"test-integrity-{uuid.uuid4().hex[:6]}",
                name="Test Integrity Exam",
                source_year=2024,
                stage="prelims",
                subject_code="gs1",
                paper_set_code="SET_A",
                total_questions=4,
                extracted_questions_count=3,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            syl_service = SyllabusService(session)
            syl = await syl_service.sync_or_create_exam_syllabus(exam.id)

            # Get a canonical subtopic
            subtopics = (await session.exec(select(Subject, Topic, Subtopic).join(Topic, Topic.subject_id == Subject.id).join(Subtopic, Subtopic.topic_id == Topic.id).where(Subject.version_id == syl.id))).first()
            valid_subtopic_id = subtopics[2].id if subtopics else None

            # Question 1: Completely VALID
            q1 = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                subtopic_id=valid_subtopic_id,
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
                is_complete=True,
                requires_human_review=True,
                integrity_status="VALID",
                integrity_reasons_json=[],
            )
            session.add(q1)
            await session.flush()
            session.add(QuestionTranslation(question_id=q1.id, language=LanguageCode.ENGLISH, question_text="What is history?"))
            session.add(QuestionOption(question_id=q1.id, option_label="A", display_order=1, is_correct=True))
            session.add(QuestionOption(question_id=q1.id, option_label="B", display_order=2, is_correct=False))
            session.add(QuestionExplanation(question_id=q1.id, language="ENGLISH", core_concept="Hist", detailed_solution="Detailed explanation for Q1"))

            # Question 2: CORRUPTED (missing statement text)
            q2 = Question(
                exam_id=exam.id,
                question_number_in_paper=2,
                subtopic_id=valid_subtopic_id,
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
                is_complete=False,
                requires_human_review=True,
                integrity_status="CORRUPTED",
                integrity_reasons_json=["Question statement text is missing or blank in database."],
            )
            session.add(q2)
            await session.flush()
            session.add(QuestionTranslation(question_id=q2.id, language=LanguageCode.ENGLISH, question_text=""))
            session.add(QuestionOption(question_id=q2.id, option_label="A", display_order=1, is_correct=True))
            session.add(QuestionOption(question_id=q2.id, option_label="B", display_order=2, is_correct=False))

            # Question 3: PARTIALLY_CORRUPTED (missing correct option / answer key)
            q3 = Question(
                exam_id=exam.id,
                question_number_in_paper=3,
                subtopic_id=valid_subtopic_id,
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
                is_complete=True,
                requires_human_review=True,
                integrity_status="PARTIALLY_CORRUPTED",
                integrity_reasons_json=["No correct answer option configured"],
            )
            session.add(q3)
            await session.flush()
            session.add(QuestionTranslation(question_id=q3.id, language=LanguageCode.ENGLISH, question_text="Question 3 text"))
            session.add(QuestionOption(question_id=q3.id, option_label="A", display_order=1, is_correct=False))
            session.add(QuestionOption(question_id=q3.id, option_label="B", display_order=2, is_correct=False))

            # Question 4: MISSING from DB (total_questions = 4, but only 1, 2, 3 in DB)
            await session.commit()

        # Test Endpoint via AsyncClient with overridden dependency
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            # 1. Fetch all items (page 1, limit 10)
            res = await ac.get(f"/api/v1/exams/{exam_id}/integrity-questions")
            self.assertEqual(res.status_code, 200)
            data = res.json()

            self.assertEqual(data["total_expected_questions"], 4)
            self.assertEqual(data["total_extracted_questions"], 3)
            self.assertEqual(data["corrupted_count"], 1)
            self.assertEqual(data["partially_corrupted_count"], 1)
            self.assertEqual(data["missing_count"], 1)
            self.assertEqual(data["valid_count"], 1)
            self.assertIn(4, data["missing_question_numbers"])
            self.assertEqual(len(data["items"]), 4)

            # 2. Filter by issue_type=CORRUPTED
            res_corr = await ac.get(f"/api/v1/exams/{exam_id}/integrity-questions?issue_type=CORRUPTED")
            self.assertEqual(res_corr.status_code, 200)
            data_corr = res_corr.json()
            self.assertEqual(data_corr["total_items"], 1)
            self.assertEqual(data_corr["items"][0]["question_number_in_paper"], 2)
            self.assertEqual(data_corr["items"][0]["issue_category"], "CORRUPTED")

            # 3. Filter by issue_type=PARTIALLY_CORRUPTED
            res_part = await ac.get(f"/api/v1/exams/{exam_id}/integrity-questions?issue_type=PARTIALLY_CORRUPTED")
            self.assertEqual(res_part.status_code, 200)
            data_part = res_part.json()
            self.assertEqual(data_part["total_items"], 1)
            self.assertEqual(data_part["items"][0]["question_number_in_paper"], 3)

            # 4. Filter by issue_type=MISSING_IN_PAPER
            res_miss = await ac.get(f"/api/v1/exams/{exam_id}/integrity-questions?issue_type=MISSING_IN_PAPER")
            self.assertEqual(res_miss.status_code, 200)
            data_miss = res_miss.json()
            self.assertEqual(data_miss["total_items"], 1)
            self.assertEqual(data_miss["items"][0]["question_number_in_paper"], 4)
            self.assertEqual(data_miss["items"][0]["issue_category"], "MISSING_IN_PAPER")

            # 5. Test pagination (page=1, limit=2)
            res_paged = await ac.get(f"/api/v1/exams/{exam_id}/integrity-questions?page=1&limit=2")
            self.assertEqual(res_paged.status_code, 200)
            data_paged = res_paged.json()
            self.assertEqual(data_paged["page"], 1)
            self.assertEqual(data_paged["limit"], 2)
            self.assertEqual(data_paged["pages"], 2)
            self.assertEqual(len(data_paged["items"]), 2)

    async def test_evaluate_and_persist_question_integrity(self):
        """Tests evaluate_and_persist_question_integrity automatically populates columns."""
        async with self.session_factory() as session:
            exam = Exam(
                code=f"test-eval-{uuid.uuid4().hex[:6]}",
                name="Test Eval Exam",
                source_year=2023,
                stage="prelims",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            # Create unverified question with missing explanation
            q = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(q)
            await session.commit()
            await session.refresh(q)

            session.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text="Sample text"))
            session.add(QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True))
            session.add(QuestionOption(question_id=q.id, option_label="B", display_order=2, is_correct=False))
            await session.commit()

            service = SyllabusService(session)
            cat, issues = await service.evaluate_and_persist_question_integrity(q)

            self.assertEqual(cat, "PARTIALLY_CORRUPTED")
            self.assertEqual(q.integrity_status, "PARTIALLY_CORRUPTED")
            self.assertTrue(any("Detailed solution explanation is missing" in iss for iss in q.integrity_reasons_json))
            self.assertTrue(q.requires_human_review)

    async def test_get_exams_by_year_endpoint(self):
        """Tests GET /api/v1/exams/by-year and GET /api/v1/exams/years."""
        async with self.session_factory() as session:
            exam_2024 = Exam(
                code="upsc-prelims-2024-gs1",
                name="UPSC Prelims 2024 GS1",
                source_year=2024,
                stage="prelims",
                paper_set_code="SET_A",
                total_questions=100,
                extracted_questions_count=100,
                status=ExamStatus.PUBLISHED,
                is_active=True,
            )
            exam_2023 = Exam(
                code="upsc-prelims-2023-gs1",
                name="UPSC Prelims 2023 GS1",
                source_year=2023,
                stage="prelims",
                paper_set_code="SET_A",
                total_questions=100,
                extracted_questions_count=98,
                status=ExamStatus.PENDING_HUMAN_REVIEW,
                is_active=False,
            )
            exam_2019 = Exam(
                code="upsc-prelims-2019-gs1",
                name="UPSC Prelims 2019 GS1",
                source_year=2019,
                stage="prelims",
                paper_set_code="SET_A",
                total_questions=100,
                extracted_questions_count=100,
                status=ExamStatus.PUBLISHED,
                is_active=True,
            )

            session.add(exam_2024)
            session.add(exam_2023)
            session.add(exam_2019)
            await session.commit()

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            res = await ac.get("/api/v1/exams/by-year")
            self.assertEqual(res.status_code, 200)
            data = res.json()

            self.assertEqual(data["total_exams"], 3)
            self.assertEqual(data["years"], [2024, 2023, 2019])
            self.assertIn("2024", data["exams_by_year"])
            self.assertIn("2023", data["exams_by_year"])
            self.assertIn("2019", data["exams_by_year"])

            exam_2024_item = data["exams_by_year"]["2024"][0]
            self.assertEqual(exam_2024_item["code"], "upsc-prelims-2024-gs1")
            self.assertEqual(exam_2024_item["source_year"], 2024)
            self.assertTrue(exam_2024_item["is_published"])

            # Alias test
            res_alias = await ac.get("/api/v1/exams/years")
            self.assertEqual(res_alias.status_code, 200)
            self.assertEqual(res_alias.json()["years"], [2024, 2023, 2019])
