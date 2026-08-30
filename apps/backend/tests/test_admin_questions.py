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
            exam = Exam(
                code="upsc-prelims-gs1-2024",
                name="UPSC Prelims GS1 2024",
                stage="prelims",
                total_questions=5,
                extracted_questions_count=1,
                missing_questions_count=4,
                missing_question_numbers_json=[2, 3, 4, 5],
            )
            session.add(exam)
            await session.flush()
            exam_id = exam.id

            q1 = Question(
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
            exam = Exam(
                code="upsc-prelims-gs1-2024",
                name="UPSC Prelims GS1 2024",
                stage="prelims",
                total_questions=5,
            )
            session.add(exam)
            await session.flush()
            exam_id = exam.id

            q1 = Question(
                exam_id=exam_id,
                question_number_in_paper=3,
                question_type="SINGLE_CHOICE",
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(q1)
            await session.commit()
            q_id = q1.id

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
            exam = Exam(code="upsc-2024", name="UPSC 2024", stage="prelims")
            session.add(exam)
            await session.flush()
            exam_id = exam.id

            syl = SyllabusVersion(exam_id=exam_id, version_code="v1.0")
            session.add(syl)
            await session.flush()

            # Create Subject 1 -> Topic 1 -> Subtopic 1 (e.g. Polity)
            subj1 = Subject(version_id=syl.id, name="Polity", code="POL")
            session.add(subj1)
            await session.flush()
            top1 = Topic(subject_id=subj1.id, name="Preamble", code="PRE")
            session.add(top1)
            await session.flush()
            subtop1 = Subtopic(topic_id=top1.id, name="Sovereignty", code="SOV")
            session.add(subtop1)

            # Create Subject 2 -> Topic 2 -> Subtopic 2 (e.g. History)
            subj2 = Subject(version_id=syl.id, name="History", code="HIST")
            session.add(subj2)
            await session.flush()
            top2 = Topic(subject_id=subj2.id, name="Modern India", code="MOD")
            session.add(top2)
            await session.flush()
            subtop2 = Subtopic(topic_id=top2.id, name="Freedom Movement", code="FREE")
            session.add(subtop2)

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

    async def test_realtime_s3_sync_on_create_update_delete(self):
        from app.storage.factory import get_storage_provider
        storage = get_storage_provider()

        async with self.session_factory() as session:
            exam = Exam(
                code="upsc-s3-test-2024",
                name="UPSC S3 Test 2024",
                stage="prelims",
                total_questions=2,
                paper_set_code="SET_A",
            )
            session.add(exam)
            await session.commit()
            exam_id = exam.id

            service = QuestionService(session)

            # 1. Create Question -> Real-time S3 upload
            payload = QuestionCreatePayload(
                exam_id=exam_id,
                question_number_in_paper=1,
                question_text="What is Article 21 of the Indian Constitution?",
                options=[
                    QuestionOptionPayload(option_label="A", option_text="Right to Life", is_correct=True),
                    QuestionOptionPayload(option_label="B", option_text="Right to Equality", is_correct=False),
                ],
                core_concept="Fundamental Rights",
                detailed_solution="Article 21 guarantees protection of life and personal liberty.",
            )

            created_res = await service.create_question(payload)
            q_id = int(created_res.question_id)

            # S3 syncing is disabled per system architecture (DB is single source of truth)
            # q_file = "artifacts/upsc-s3-test-2024/set-a/json/questions/Q001.json"
            # s_file = "artifacts/upsc-s3-test-2024/set-a/json/solutions/Q001.json"
            # self.assertTrue(await storage.exists(q_file))
            # self.assertTrue(await storage.exists(s_file))

            # 2. Update Question -> Direct DB update
            update_payload = QuestionUpdatePayload(
                question_text="Updated: What is Article 21 of the Constitution?",
            )
            updated_res = await service.update_question_detail(question_id=q_id, payload=update_payload)
            self.assertIn("Updated: What is Article 21", updated_res.question_text)

            # 3. Delete Question -> Direct DB deletion
            await service.delete_question(question_id=q_id)
            deleted_q = await session.get(Question, q_id)
            self.assertIsNone(deleted_q)

    async def test_hierarchy_links_upsert_deduplication_and_no_unique_violations(self):
        """Tests that submitting duplicate subtopics or re-updating hierarchy links never triggers unique constraint violations."""
        async with self.session_factory() as session:
            exam = Exam(
                code="upsc-hierarchy-safe-2024",
                name="UPSC Hierarchy Safe 2024",
                stage="prelims",
                total_questions=1,
            )
            session.add(exam)
            await session.commit()
            exam_id = exam.id

            service = QuestionService(session)

            # 1. Create Question with primary and secondary concepts
            create_payload = QuestionCreatePayload(
                exam_id=exam_id,
                question_number_in_paper=1,
                question_text="Which Act introduced dyarchy at the provincial level?",
                options=[
                    QuestionOptionPayload(option_label="A", option_text="Government of India Act 1919", is_correct=True),
                    QuestionOptionPayload(option_label="B", option_text="Government of India Act 1935", is_correct=False),
                ],
                hierarchy_links=[
                    QuestionHierarchyLinkPayload(
                        subject_name="Polity",
                        topic_name="Constitutional Development",
                        subtopic_name="Acts Under British Rule",
                        is_primary=True,
                        relevance_weight=1.0,
                        concept_name="Dyarchy in Provinces",
                    ),
                    QuestionHierarchyLinkPayload(
                        subject_name="History",
                        topic_name="Modern History",
                        subtopic_name="Nationalist Movement",
                        is_primary=False,
                        relevance_weight=0.8,
                        concept_name="Montagu-Chelmsford Reforms",
                    ),
                ],
            )
            res = await service.create_question(create_payload)
            q_id = int(res.question_id)

            # Verify initial 2 hierarchy links
            initial_q = await service.get_question_detail(q_id)
            self.assertEqual(len(initial_q.hierarchy), 2)

            # 2. Update with DUPLICATE subtopics in the hierarchy_links payload
            # (Simulates frontend submitting duplicate concept tags or identical subtopic names)
            update_payload = QuestionUpdatePayload(
                hierarchy_links=[
                    QuestionHierarchyLinkPayload(
                        subject_name="Polity",
                        topic_name="Constitutional Development",
                        subtopic_name="Acts Under British Rule",
                        is_primary=True,
                        relevance_weight=1.0,
                        concept_name="Updated Dyarchy Concept",
                    ),
                    QuestionHierarchyLinkPayload(
                        subject_name="Polity",
                        topic_name="Constitutional Development",
                        subtopic_name="Acts Under British Rule",  # EXACT DUPLICATE SUBTOPIC
                        is_primary=False,
                        relevance_weight=0.9,
                        concept_name="Duplicate Concept Tag",
                    ),
                    QuestionHierarchyLinkPayload(
                        subject_name="History",
                        topic_name="Modern History",
                        subtopic_name="Nationalist Movement",
                        is_primary=False,
                        relevance_weight=0.85,
                        concept_name="Montagu-Chelmsford Reforms Updated",
                    ),
                ]
            )

            # This must NOT raise UniqueViolationError or IntegrityError
            updated_res = await service.update_question_detail(question_id=q_id, payload=update_payload)
            self.assertIsNotNone(updated_res)

            # Check that deduplication merged the duplicate subtopic into 1 link
            self.assertEqual(len(updated_res.hierarchy), 2)

            # 3. Update AGAIN multiple times to guarantee idempotence and zero unique constraint conflicts
            for i in range(3):
                repeat_update = QuestionUpdatePayload(
                    question_text=f"Iteration {i}: Which Act introduced dyarchy at the provincial level?",
                    hierarchy_links=[
                        QuestionHierarchyLinkPayload(
                            subject_name="Polity",
                            topic_name="Constitutional Development",
                            subtopic_name="Acts Under British Rule",
                            is_primary=True,
                            relevance_weight=1.0,
                        ),
                    ],
                )
                repeat_res = await service.update_question_detail(question_id=q_id, payload=repeat_update)
                self.assertEqual(len(repeat_res.hierarchy), 1)


if __name__ == "__main__":
    unittest.main()

