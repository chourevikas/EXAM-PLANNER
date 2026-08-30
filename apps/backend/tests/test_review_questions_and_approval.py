import uuid
import unittest
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.models import (
    Exam,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    QuestionStatus,
    ExamStatus,
    LanguageCode,
)
from app.schemas.question import QuestionUpdatePayload, QuestionOptionPayload
from app.services.question_service import QuestionService
from app.routers.admin import approve_and_publish_exam
from fastapi import HTTPException


class TestReviewQuestionsAndApproval(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_review_questions_and_solutions_flow(self):
        async with self.session_factory() as session:
            # 1. Create a test exam
            exam = Exam(
                code=f"test-review-exam-{uuid.uuid4().hex[:6]}",
                name="Test Review Exam",
                stage="prelims",
                subject_code="gs1",
                source_year=2024,
                paper_set_code="SET_A",
                status=ExamStatus.PENDING_HUMAN_REVIEW,
                total_questions=2,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            # 2. Add 2 questions in PENDING_HUMAN_REVIEW
            q1 = Question(
                exam_id=exam_id,
                question_number_in_paper=1,
                paper_set_code="SET_A",
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(q1)

            q2 = Question(
                exam_id=exam_id,
                question_number_in_paper=2,
                paper_set_code="SET_A",
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(q2)
            await session.commit()
            await session.refresh(q1)
            await session.refresh(q2)
            q1_id = q1.id
            q2_id = q2.id

            # Add translations and options for Q1
            qt1 = QuestionTranslation(
                question_id=q1_id, language=LanguageCode.ENGLISH, question_text="What is the capital of India?"
            )
            session.add(qt1)

            opt1 = QuestionOption(question_id=q1_id, option_label="A", display_order=1, is_correct=True)
            session.add(opt1)
            await session.flush()

            ot1 = OptionTranslation(
                option_id=opt1.id,
                language=LanguageCode.ENGLISH,
                option_text="New Delhi",
                distractor_analysis="Correct national capital.",
            )
            session.add(ot1)

            # Add 4-parameter explanation for Q1
            expl1 = QuestionExplanation(
                question_id=q1_id,
                language=LanguageCode.ENGLISH,
                core_concept="National capitals of South Asia",
                detailed_solution="New Delhi is the official national capital of India under Article 239AA.",
                common_traps_json=["Confusing Old Delhi with New Delhi as federal territory."],
                key_takeaways_json=["New Delhi is the seat of executive, legislative, and judiciary."],
            )
            session.add(expl1)

            # Add translations and options for Q2
            qt2 = QuestionTranslation(
                question_id=q2_id, language=LanguageCode.ENGLISH, question_text="What is the currency of Japan?"
            )
            session.add(qt2)

            opt2 = QuestionOption(question_id=q2_id, option_label="A", display_order=1, is_correct=True)
            session.add(opt2)
            await session.flush()

            ot2 = OptionTranslation(
                option_id=opt2.id,
                language=LanguageCode.ENGLISH,
                option_text="Yen",
                distractor_analysis="Official currency of Japan.",
            )
            session.add(ot2)
            await session.commit()

            # 3. Test QuestionService.get_exam_questions_for_review
            service = QuestionService(session)
            review_data = await service.get_exam_questions_for_review(exam_id=exam_id)

            self.assertEqual(review_data.total_questions, 2)
            self.assertEqual(review_data.reviewed_count, 0)
            self.assertEqual(review_data.pending_count, 2)
            self.assertFalse(review_data.can_publish)
            self.assertEqual(len(review_data.items), 2)

            # Check Q1 solution parameters & option explanations
            q1_item = next(item for item in review_data.items if item.question_id == str(q1_id))
            self.assertIsNotNone(q1_item.explanation)
            self.assertEqual(q1_item.explanation.core_concept, "National capitals of South Asia")
            self.assertIn("New Delhi is the official national capital", q1_item.explanation.detailed_solution)
            self.assertEqual(len(q1_item.explanation.common_traps), 1)
            self.assertEqual(len(q1_item.explanation.key_takeaways), 1)
            self.assertEqual(q1_item.options[0].distractor_analysis, "Correct national capital.")

            # 4. Test candidate list_questions without solutions (include_solutions=False)
            candidate_data = await service.list_questions_paginated(exam_id=exam_id, include_solutions=False)
            cand_q1 = next(item for item in candidate_data.items if item.question_id == str(q1_id))
            self.assertIsNone(cand_q1.explanation)
            self.assertIsNone(cand_q1.options[0].distractor_analysis)

            # 5. Test Exam publish fails when questions are still pending review
            with self.assertRaises(HTTPException) as ctx:
                await approve_and_publish_exam(exam_id=str(exam_id), session=session, current_user=None)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("not yet approved", ctx.exception.detail)

            # 6. Update Q1 and Q2 to PUBLISHED via update_question_detail with hierarchy and solutions
            await service.update_question_detail(
                question_id=q1_id,
                payload=QuestionUpdatePayload(
                    status=QuestionStatus.PUBLISHED,
                    subject_name="Geography",
                    topic_name="Indian Geography",
                    subtopic_name="Capital Cities",
                    common_traps=["Updated common trap"],
                    key_takeaways=["Updated takeaway point"],
                ),
            )

            await service.update_question_detail(
                question_id=q2_id,
                payload=QuestionUpdatePayload(
                    status=QuestionStatus.PUBLISHED,
                    question_text="Second test question",
                    detailed_solution="Solution for Q2",
                    core_concept="Core concept for Q2",
                    options=[
                        QuestionOptionPayload(
                            option_label="A",
                            option_text="Option A for Q2",
                            is_correct=True,
                        )
                    ],
                ),
            )

            # 7. Check review metrics after publishing all questions
            review_data_after = await service.get_exam_questions_for_review(exam_id=exam_id)
            self.assertEqual(review_data_after.reviewed_count, 2)
            self.assertEqual(review_data_after.pending_count, 0)
            self.assertTrue(review_data_after.can_publish)

            # 8. Approve and Publish exam to S3
            publish_res = await approve_and_publish_exam(exam_id=str(exam_id), session=session, current_user=None)
            self.assertEqual(publish_res["status"], "APPROVED_AND_PUBLISHED")
            self.assertEqual(publish_res["publish_status"], "PUBLISHED")
            self.assertTrue(publish_res["is_active"])
            self.assertIsNotNone(publish_res["questions_json_folder_path"])
            self.assertIsNotNone(publish_res["solutions_json_folder_path"])
            self.assertIsNotNone(publish_res["last_synced_at"])

            # 9. Verify get_exam_questions_for_review reflects published status (Scenario 1: Published & In Sync)
            review_data_published = await service.get_exam_questions_for_review(exam_id=exam_id)
            self.assertTrue(review_data_published.is_published)
            self.assertEqual(review_data_published.publish_status, "PUBLISHED")
            self.assertFalse(review_data_published.is_corrupted)
            self.assertFalse(review_data_published.can_retry)
            self.assertFalse(review_data_published.is_s3_out_of_sync)
            self.assertIsNotNone(review_data_published.last_synced_at)

            # 10. Update a question post-publishing -> verifies out-of-sync detection
            import asyncio
            await asyncio.sleep(0.01)
            await service.update_question_detail(
                question_id=q1_id,
                payload=QuestionUpdatePayload(question_text="Updated Post-Publish: Capital of India?"),
            )
            review_data_after_edit = await service.get_exam_questions_for_review(exam_id=exam_id)
            self.assertTrue(review_data_after_edit.is_s3_out_of_sync)

            # 11. Call S3 Sync endpoint -> verifies background task dispatch and sync status endpoint
            from fastapi import BackgroundTasks
            from app.routers.admin import sync_exam_s3_artifacts, get_exam_sync_status

            bg_tasks = BackgroundTasks()
            sync_res = await sync_exam_s3_artifacts(
                exam_id=str(exam_id),
                background_tasks=bg_tasks,
                session=session,
                current_user=None,
            )
            self.assertEqual(sync_res["status"], "SYNC_STARTED")
            self.assertTrue(sync_res["is_syncing"])

            # Execute the queued background tasks in test
            for task in bg_tasks.tasks:
                await task()

            # Verify sync status endpoint
            status_res = await get_exam_sync_status(exam_id=str(exam_id), session=session, current_user=None)
            self.assertFalse(status_res["is_syncing"])
            self.assertEqual(status_res["sync_status"], "COMPLETED")
            self.assertFalse(status_res["is_s3_out_of_sync"])

            review_data_resynced = await service.get_exam_questions_for_review(exam_id=exam_id)
            self.assertFalse(review_data_resynced.is_s3_out_of_sync)

            # 12. Verify Celery async task wrapper (sync_tasks.async_sync_exam_s3)
            from app.tasks.sync_tasks import async_sync_exam_s3
            celery_run_res = await async_sync_exam_s3(
                exam_id_str=str(exam_id),
                run_id_str=str(sync_res["pipeline_run_id"]),
                task_id="celery_test_task",
                execution_engine="Celery Worker",
                session=session,
            )
            self.assertEqual(celery_run_res["status"], "COMPLETED")

    async def test_corrupted_question_detection(self):
        async with self.session_factory() as session:
            exam = Exam(
                code=f"test-corrupt-exam-{uuid.uuid4().hex[:6]}",
                name="Test Corrupt Exam",
                stage="prelims",
                subject_code="gs1",
                source_year=2024,
                paper_set_code="SET_A",
                status=ExamStatus.PENDING_HUMAN_REVIEW,
                total_questions=1,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            # Add question with NO options (Corrupted)
            q = Question(
                exam_id=exam_id,
                question_number_in_paper=1,
                paper_set_code="SET_A",
                status=QuestionStatus.PUBLISHED,
            )
            session.add(q)
            await session.commit()
            await session.refresh(q)
            q_id = q.id

            # Add translation with empty text
            qt = QuestionTranslation(
                question_id=q_id, language=LanguageCode.ENGLISH, question_text="   "
            )
            session.add(qt)
            await session.commit()

            # 1. Test get_exam_questions_for_review detects corruption (Scenario 3: Corrupted)
            service = QuestionService(session)
            review_data = await service.get_exam_questions_for_review(exam_id=exam_id)
            self.assertTrue(review_data.is_corrupted)
            self.assertEqual(review_data.publish_status, "CORRUPTED")
            self.assertIn("Corrupted", review_data.corruption_reason or "")

            # 2. Test approve_and_publish_exam rejects corrupted record with 422
            with self.assertRaises(HTTPException) as ctx:
                await approve_and_publish_exam(exam_id=str(exam_id), session=session, current_user=None)
            self.assertEqual(ctx.exception.status_code, 422)
            self.assertIn("EXAM_DATA_CORRUPTED", ctx.exception.detail)

