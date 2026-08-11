import uuid
import unittest
from sqlmodel import SQLModel, create_engine, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.models import Exam, Question, QuestionStatus, SubscriptionTier
from app.schemas.question import (
    QuestionCreatePayload,
    QuestionUpdatePayload,
    QuestionOptionPayload,
    QuestionHierarchyLinkPayload,
)
from app.services.question_service import QuestionService


class TestAdminQuestionManagement(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_admin_create_missing_question_sets_published_and_updates_metrics(self):
        async with self.session_factory() as session:
            exam_id = uuid.uuid4()
            exam = Exam(
                id=exam_id,
                code="upsc-prelims-gs1-2024",
                name="UPSC Prelims GS1 2024",
                stage="prelims",
                total_questions=5,
                extracted_questions_count=1,
                missing_questions_count=4,
                missing_question_numbers_json=[2, 3, 4, 5],
            )
            session.add(exam)

            q1 = Question(
                id=uuid.uuid4(),
                exam_id=exam_id,
                question_number_in_paper=1,
                question_type="SINGLE_CHOICE",
                status=QuestionStatus.PUBLISHED,
            )
            session.add(q1)
            await session.commit()

            service = QuestionService(session)

            payload = QuestionCreatePayload(
                exam_id=exam_id,
                question_number_in_paper=2,
                question_text="What is the capital of India?",
                options=[
                    QuestionOptionPayload(option_label="A", option_text="Mumbai", is_correct=False),
                    QuestionOptionPayload(option_label="B", option_text="New Delhi", is_correct=True),
                ],
                core_concept="Geography & Governance",
                detailed_solution="New Delhi is the national capital of India.",
            )

            response = await service.create_question(payload)

            self.assertEqual(response.question_number_in_paper, 2)
            self.assertEqual(response.status, QuestionStatus.PUBLISHED.value if hasattr(QuestionStatus.PUBLISHED, "value") else str(QuestionStatus.PUBLISHED))
            self.assertEqual(response.question_text, "What is the capital of India?")
            self.assertEqual(len(response.options), 2)

            # Verify exam metrics updated
            updated_exam = await session.get(Exam, exam_id)
            self.assertEqual(updated_exam.extracted_questions_count, 2)
            self.assertEqual(updated_exam.missing_questions_count, 3)
            self.assertEqual(updated_exam.missing_question_numbers_json, [3, 4, 5])

    async def test_admin_update_question_sets_published(self):
        async with self.session_factory() as session:
            exam_id = uuid.uuid4()
            exam = Exam(
                id=exam_id,
                code="upsc-prelims-gs1-2024",
                name="UPSC Prelims GS1 2024",
                stage="prelims",
                total_questions=5,
            )
            session.add(exam)

            q_id = uuid.uuid4()
            q1 = Question(
                id=q_id,
                exam_id=exam_id,
                question_number_in_paper=3,
                question_type="SINGLE_CHOICE",
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(q1)
            await session.commit()

            service = QuestionService(session)

            update_payload = QuestionUpdatePayload(
                question_text="Updated question text for Q3",
                core_concept="Updated concept",
            )

            response = await service.update_question_detail(q_id, update_payload)

            self.assertEqual(response.status, QuestionStatus.PUBLISHED.value if hasattr(QuestionStatus.PUBLISHED, "value") else str(QuestionStatus.PUBLISHED))
            self.assertEqual(response.question_text, "Updated question text for Q3")

    async def test_multiple_subjects_topics_subtopics_hierarchy_mapping(self):
        from app.db.models import Subject, Topic, Subtopic, SyllabusVersion

        async with self.session_factory() as session:
            exam_id = uuid.uuid4()
            exam = Exam(id=exam_id, code="upsc-2024", name="UPSC 2024", stage="prelims")
            session.add(exam)

            syl = SyllabusVersion(id=uuid.uuid4(), exam_id=exam_id, version_code="v1.0")
            session.add(syl)

            # Create Subject 1 -> Topic 1 -> Subtopic 1 (e.g. Polity)
            subj1 = Subject(id=uuid.uuid4(), syllabus_version_id=syl.id, name="Polity", code="POL")
            top1 = Topic(id=uuid.uuid4(), subject_id=subj1.id, name="Preamble", code="PRE")
            subtop1 = Subtopic(id=uuid.uuid4(), topic_id=top1.id, name="Sovereignty", code="SOV")

            # Create Subject 2 -> Topic 2 -> Subtopic 2 (e.g. History)
            subj2 = Subject(id=uuid.uuid4(), syllabus_version_id=syl.id, name="History", code="HIST")
            top2 = Topic(id=uuid.uuid4(), subject_id=subj2.id, name="Modern India", code="MOD")
            subtop2 = Subtopic(id=uuid.uuid4(), topic_id=top2.id, name="Freedom Movement", code="FREE")

            session.add_all([subj1, top1, subtop1, subj2, top2, subtop2])
            await session.commit()

            service = QuestionService(session)

            # Create a multi-disciplinary question mapping to BOTH Polity & History subtopics
            payload = QuestionCreatePayload(
                exam_id=exam_id,
                question_number_in_paper=4,
                question_text="Multi-disciplinary constitutional history question",
                hierarchy_links=[
                    QuestionHierarchyLinkPayload(
                        subtopic_id=subtop1.id,
                        topic_id=top1.id,
                        subject_id=subj1.id,
                        is_primary=True,
                        relevance_weight=1.0,
                    ),
                    QuestionHierarchyLinkPayload(
                        subtopic_id=subtop2.id,
                        topic_id=top2.id,
                        subject_id=subj2.id,
                        is_primary=False,
                        relevance_weight=0.8,
                    ),
                ],
            )

            res = await service.create_question(payload)

            # Verify response contains 2 hierarchy links across both subjects/topics
            self.assertEqual(len(res.hierarchy), 2)
            subj_names = {h.subject_name for h in res.hierarchy}
            self.assertIn("Polity", subj_names)
            self.assertIn("History", subj_names)


if __name__ == "__main__":
    unittest.main()
