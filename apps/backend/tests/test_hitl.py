import unittest
import uuid
import json
from sqlmodel import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel
from app.db.models import Question, QuestionTranslation, QuestionOption, OptionTranslation, HumanReviewTask, QuestionStatus, LanguageCode
from app.hitl.review_service import HumanReviewService



class TestHITL(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
            
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_hitl_review_workflow(self):
        async with self.session_factory() as session:
            service = HumanReviewService(session)

            exam_id = uuid.uuid4()
            q = Question(
                exam_id=exam_id,
                section_code="GS_1",
                question_number_in_paper=5,
                status=QuestionStatus.PENDING_HUMAN_REVIEW
            )
            session.add(q)
            await session.commit()

            task = HumanReviewTask(
                question_id=q.id,
                exam_id=exam_id,
                review_status="PENDING_REVIEW",
                is_flagged_by_validator=True,
                failure_reasons_json=json.dumps(["Option text empty"])
            )
            session.add(task)

            qt = QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text="Draft question stem")
            opt_a = QuestionOption(question_id=q.id, option_label="A", display_order=1)
            opt_b = QuestionOption(question_id=q.id, option_label="B", display_order=2)
            session.add_all([qt, opt_a, opt_b])
            await session.commit()

            # 1. Fetch pending tasks asynchronously
            pending = await service.get_pending_review_tasks(exam_id=exam_id, only_flagged=True)
            self.assertEqual(len(pending), 1)
            self.assertEqual(pending[0].question_id, q.id)

            # 2. Fetch detail asynchronously
            detail = await service.get_question_review_detail(q.id)
            self.assertEqual(detail["status"], "PENDING_HUMAN_REVIEW")
            self.assertTrue(detail["audit_flagged"])

            # 3. Approve and publish with updated passage context & option text
            published_q = await service.update_and_approve_question(
                question_id=q.id,
                updated_question_text="Verified question stem",
                updated_options=[
                    {"option_label": "A", "option_text": "Corrected Option A", "is_correct": False},
                    {"option_label": "B", "option_text": "Corrected Option B", "is_correct": True}
                ],
                correct_option_label="B",
                reviewer_notes="Fixed option B and verified correctness"
            )

            self.assertEqual(published_q.status, QuestionStatus.PUBLISHED)
            updated_task = await session.get(HumanReviewTask, task.id)
            self.assertEqual(updated_task.review_status, "VERIFIED")
            self.assertTrue(updated_task.reviewer_notes.startswith("Fixed option B"))


if __name__ == "__main__":
    unittest.main()
