import unittest
import uuid
from sqlmodel import select, SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    ExamAttempt,
    ExamQuestionResponse,
    User,
    UserSkillProfile,
    ExamQuestionReport,
    ExamAttemptReport,
    UserSkillProgressionReport,
    QuestionExplanation,
)
from app.db.models.enums import (
    QuestionStatus,
    AttemptMode,
    AttemptStatus,
    UserRole,
    UserStatus,
    QuestionSourceType,
)
from app.schemas.exam_attempt import (
    StartExamRequest,
    SaveResponseRequest,
    SubmitExamRequest,
)
from app.services.exam_session_service import ExamSessionService
from app.services.analytics_service import AnalyticsService
from app.engine.post_submission_pipeline import run_post_submission_pipeline, load_exam_solutions_data
from app.storage.local import LocalStorageProvider


class TestThreeReportsAndBulk(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_bulk_questions_and_three_reports_lifecycle(self):
        async with self.session_factory() as db_session:
            # 1. Create a student user and an exam
            user = User(
                id=uuid.uuid4(),
                email="reports_user@example.com",
                full_name="Report Tester",
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
            )
            db_session.add(user)

            exam = Exam(
                name="Diagnostics Master Exam",
                code="DIAG-MASTER-2024",
                exam_type=QuestionSourceType.PYQ,
                total_marks=200,
                total_questions=2,
                total_duration_minutes=120,
                is_active=True,
            )
            db_session.add(exam)
            await db_session.commit()
            await db_session.refresh(exam)

            # 2. Add 2 questions with options and explanations
            q1 = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                section_code="POLITY",
                marks=2.0,
                negative_marks=0.66,
                status=QuestionStatus.PUBLISHED,
            )
            q2 = Question(
                exam_id=exam.id,
                question_number_in_paper=2,
                section_code="HISTORY",
                marks=2.0,
                negative_marks=0.66,
                status=QuestionStatus.PUBLISHED,
            )
            db_session.add_all([q1, q2])
            await db_session.commit()
            await db_session.refresh(q1)
            await db_session.refresh(q2)

            opt1 = QuestionOption(
                question_id=q1.id,
                option_label="A",
                text_content="Option A",
                display_order=1,
                is_correct=True,
            )
            opt2 = QuestionOption(
                question_id=q2.id,
                option_label="B",
                text_content="Option B",
                display_order=1,
                is_correct=True,
            )
            db_session.add_all([opt1, opt2])

            expl1 = QuestionExplanation(
                question_id=q1.id,
                core_concept="Constitutional Sovereignty",
                detailed_solution="Detailed reasoning step 1 and 2.",
                common_traps_json=["Trap A: Confusing sovereignty with autonomy"],
                key_takeaways_json=["Key takeaway 1"],
            )
            db_session.add(expl1)
            await db_session.commit()
            await db_session.refresh(opt1)
            await db_session.refresh(opt2)

            # 3. Start Exam via ExamSessionService
            service = ExamSessionService(db_session)
            start_res = await service.start_exam(
                req=StartExamRequest(exam_id=exam.id, mode=AttemptMode.EXAM),
                user_id=user.id,
            )
            attempt_id = uuid.UUID(str(start_res.attempt_id))

            # 4. Test Bulk Questions Retrieval
            bulk_data = await service.get_all_questions_bulk(
                attempt_id=attempt_id, user_id=user.id
            )
            self.assertIn("questions", bulk_data)

            # 5. Answer Q1 correctly and Q2 unattempted
            await service.save_response(
                attempt_id=attempt_id,
                user_id=user.id,
                req=SaveResponseRequest(
                    question_id=q1.id,
                    selected_option_id=opt1.id,
                    is_marked_for_review=False,
                    time_spent_seconds=45.0,
                ),
            )

            # 6. Test Solutions Resolver
            storage = LocalStorageProvider()
            sols = await load_exam_solutions_data(exam, db_session, storage)
            self.assertIn("questions", sols)

            # 7. Submit exam and run post-submission pipeline
            submit_res = await service.submit_exam(
                attempt_id=attempt_id,
                user_id=user.id,
                req=SubmitExamRequest(submission_reason="USER_CLICKED_SUBMIT"),
            )
            self.assertEqual(submit_res.status, AttemptStatus.SUBMITTED)

            await run_post_submission_pipeline(attempt_id, session=db_session)

            # 8. Verify all 3 Reports generated in DB
            q_reps = (await db_session.exec(
                select(ExamQuestionReport).where(ExamQuestionReport.attempt_id == attempt_id)
            )).all()
            self.assertGreaterEqual(len(q_reps), 1)

            att_rep = (await db_session.exec(
                select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt_id)
            )).first()
            self.assertIsNotNone(att_rep)
            assert att_rep is not None
            self.assertIn("score_summary", att_rep.matrices_summary_json)
            self.assertIn("irt_3pl", att_rep.matrices_summary_json)

            prog_rep = (await db_session.exec(
                select(UserSkillProgressionReport).where(UserSkillProgressionReport.attempt_id == attempt_id)
            )).first()
            self.assertIsNotNone(prog_rep)
            assert prog_rep is not None
            self.assertIn("icrs_delta", prog_rep.deltas_json)

            # 9. Verify AnalyticsService Endpoints
            analytics = AnalyticsService(db_session)
            r1 = await analytics.get_attempt_question_report(attempt_id)
            self.assertIn("questions", r1)
            self.assertEqual(r1["attempt_id"], str(attempt_id))

            r2 = await analytics.get_attempt_exam_report(attempt_id)
            self.assertIn("matrices_summary", r2)
            self.assertIn("taxonomy_breakdown", r2)

            r3 = await analytics.get_attempt_user_progression_report(attempt_id)
            self.assertIn("deltas", r3)

            profile_rep = await analytics.get_user_skill_profile(user.id)
            self.assertIn("profile", profile_rep)
            self.assertEqual(profile_rep["profile"]["total_tests_given"], 1)
