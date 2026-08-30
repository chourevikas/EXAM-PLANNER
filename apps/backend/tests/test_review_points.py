import unittest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel, select

from app.db.models.user import User, UserRole
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionTranslation, QuestionOption
from app.db.models.review import HumanReviewTask
from app.db.models.enums import QuestionStatus
from app.db.models.teacher import TeacherProfile, ReviewPointsLog
from app.hitl.review_service import HumanReviewService
from app.config.settings import settings


class TestReviewPoints(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _make_question(self, session, exam_id=1):
        q = Question(
            exam_id=exam_id,
            section_code="GS",
            question_number_in_paper=1,
            status=QuestionStatus.PENDING_HUMAN_REVIEW,
        )
        session.add(q)
        await session.commit()
        await session.refresh(q)
        task = HumanReviewTask(question_id=q.id, exam_id=exam_id, review_status="PENDING_REVIEW")
        session.add(task)
        await session.commit()
        return q, task

    async def test_teacher_approve_awards_points(self):
        async with self.session_factory() as session:
            exam = Exam(code="PTS-1", name="Points Exam")
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            teacher = User(full_name="T", email="t_pts1@example.com", role=UserRole.TEACHER)
            session.add(teacher)
            await session.commit()
            await session.refresh(teacher)

            q, task = await self._make_question(session, exam.id)

            service = HumanReviewService(session)
            await service.update_and_approve_question(
                question_id=q.id, admin_id=teacher.id, reviewer_notes="ok"
            )

            profile = await session.get(TeacherProfile, teacher.id)
            self.assertIsNotNone(profile)
            self.assertEqual(profile.total_review_points, settings.REVIEW_POINTS_PER_ACTION)
            self.assertEqual(profile.reviews_completed_count, 1)

            logs = (await session.exec(
                select(ReviewPointsLog).where(ReviewPointsLog.user_id == teacher.id)
            )).all()
            self.assertEqual(len(logs), 1)
            self.assertEqual(logs[0].action, "APPROVE")

    async def test_teacher_reject_awards_points(self):
        async with self.session_factory() as session:
            exam = Exam(code="PTS-2", name="Points Exam 2")
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            teacher = User(full_name="T2", email="t_pts2@example.com", role=UserRole.TEACHER)
            session.add(teacher)
            await session.commit()
            await session.refresh(teacher)

            q, task = await self._make_question(session, exam.id)

            service = HumanReviewService(session)
            await service.reject_question(
                question_id=q.id, rejection_reason="incomplete", admin_id=teacher.id
            )

            profile = await session.get(TeacherProfile, teacher.id)
            self.assertIsNotNone(profile)
            self.assertEqual(profile.total_review_points, settings.REVIEW_POINTS_PER_ACTION)

            logs = (await session.exec(
                select(ReviewPointsLog).where(ReviewPointsLog.user_id == teacher.id)
            )).all()
            self.assertEqual(logs[0].action, "REJECT")

    async def test_admin_reviewer_does_not_earn_points(self):
        async with self.session_factory() as session:
            exam = Exam(code="PTS-3", name="Points Exam 3")
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            admin = User(full_name="A", email="a_pts3@example.com", role=UserRole.ADMIN)
            session.add(admin)
            await session.commit()
            await session.refresh(admin)

            q, task = await self._make_question(session, exam.id)

            service = HumanReviewService(session)
            await service.update_and_approve_question(
                question_id=q.id, admin_id=admin.id, reviewer_notes="ok"
            )

            profile = await session.get(TeacherProfile, admin.id)
            self.assertIsNone(profile)

            logs = (await session.exec(
                select(ReviewPointsLog).where(ReviewPointsLog.user_id == admin.id)
            )).all()
            self.assertEqual(len(logs), 0)

    async def test_queue_excludes_orphaned_task_for_already_finalized_question(self):
        async with self.session_factory() as session:
            exam = Exam(code="PTS-5", name="Points Exam 5")
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            # Simulate the legacy admin path publishing the question directly
            # (via /admin/questions/{id} PATCH) without touching the review task.
            q, task = await self._make_question(session, exam.id)
            q.status = QuestionStatus.PUBLISHED
            session.add(q)
            await session.commit()

            service = HumanReviewService(session)
            pending = await service.get_pending_review_tasks(exam_id=exam.id)
            self.assertEqual(len(pending), 0)

    async def test_no_reviewer_id_is_a_safe_no_op(self):
        async with self.session_factory() as session:
            exam = Exam(code="PTS-4", name="Points Exam 4")
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            q, task = await self._make_question(session, exam.id)

            service = HumanReviewService(session)
            published = await service.update_and_approve_question(question_id=q.id)
            self.assertEqual(published.status, QuestionStatus.PUBLISHED)


if __name__ == "__main__":
    unittest.main()
