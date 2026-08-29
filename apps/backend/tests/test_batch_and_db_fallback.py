import unittest
import uuid
from sqlmodel import select, SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import Exam, Question, QuestionOption, ExamQuestionResponse, User
from app.db.models.enums import QuestionStatus, AttemptMode, UserRole, UserStatus, QuestionSourceType
from app.services.exam_session_service import ExamSessionService
from app.schemas.exam_attempt import BatchSaveItem, BatchSaveResponseRequest, StartExamRequest


class TestBatchAndDbFallback(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_batch_saving_and_status(self):
        async with self.session_factory() as db_session:
            # 1. Create a test user, exam, and questions
            user = User(
                email="batch_test_user@example.com",
                full_name="Batch Test User",
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
            )
            db_session.add(user)
            await db_session.commit()
            await db_session.refresh(user)

            exam = Exam(
                name="Batch Test Exam",
                code="BATCH-TEST-2024",
                exam_type=QuestionSourceType.PYQ,
                total_marks=200,
                total_questions=2,
                total_duration_minutes=120,
                is_active=True,
            )
            db_session.add(exam)
            await db_session.commit()
            await db_session.refresh(exam)

            q1 = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                section_code="GENERAL",
                marks=2.0,
                negative_marks=0.66,
                status=QuestionStatus.PUBLISHED,
            )
            q2 = Question(
                exam_id=exam.id,
                question_number_in_paper=2,
                section_code="GENERAL",
                marks=2.0,
                negative_marks=0.66,
                status=QuestionStatus.PUBLISHED,
            )
            db_session.add_all([q1, q2])
            await db_session.commit()
            await db_session.refresh(q1)
            await db_session.refresh(q2)

            opt1_a = QuestionOption(question_id=q1.id, option_label="A", is_correct=True, display_order=1)
            opt1_b = QuestionOption(question_id=q1.id, option_label="B", is_correct=False, display_order=2)
            opt2_a = QuestionOption(question_id=q2.id, option_label="A", is_correct=False, display_order=1)
            opt2_b = QuestionOption(question_id=q2.id, option_label="B", is_correct=True, display_order=2)
            db_session.add_all([opt1_a, opt1_b, opt2_a, opt2_b])
            await db_session.commit()
            await db_session.refresh(opt1_a)
            await db_session.refresh(opt2_b)

            # 2. Start exam
            service = ExamSessionService(db_session)
            start_res = await service.start_exam(
                user_id=user.id,
                req=StartExamRequest(exam_id=exam.id, mode=AttemptMode.EXAM),
            )
            attempt_id = int(start_res.attempt_id)

            # 3. Save a batch of responses
            batch_req = BatchSaveResponseRequest(
                batch_id="batch-unit-test-1",
                responses=[
                    BatchSaveItem(
                        question_id=q1.id,
                        selected_option_id=opt1_a.id,
                        is_marked_for_review=False,
                        time_spent_seconds=45.5,
                        option_switch_count=1,
                    ),
                    BatchSaveItem(
                        question_id=q2.id,
                        selected_option_id=opt2_b.id,
                        is_marked_for_review=True,
                        time_spent_seconds=30.0,
                        option_switch_count=0,
                    ),
                ],
            )

            ack = await service.save_responses_batch(
                attempt_id=attempt_id,
                user_id=user.id,
                req=batch_req,
            )

            assert ack.batch_id == "batch-unit-test-1"
            assert ack.status == "PROCESSED"
            assert ack.received_count == 2
            assert ack.response_summary is not None
            assert ack.response_summary.answered_count == 2
            assert ack.response_summary.marked_for_review_count == 1

            # 4. Check batch status
            batch_status = service.get_batch_status("batch-unit-test-1")
            assert batch_status.batch_id == "batch-unit-test-1"
            assert batch_status.status == "PROCESSED"
            assert batch_status.processed_count == 2

            # 5. Verify responses persisted in database
            resp_q1 = (await db_session.exec(
                select(ExamQuestionResponse).where(
                    ExamQuestionResponse.attempt_id == attempt_id,
                    ExamQuestionResponse.question_id == q1.id,
                )
            )).first()
            assert resp_q1 is not None
            assert resp_q1.selected_option_id == opt1_a.id
            assert resp_q1.time_taken_seconds >= 45.5
            assert not resp_q1.is_marked_for_review

            resp_q2 = (await db_session.exec(
                select(ExamQuestionResponse).where(
                    ExamQuestionResponse.attempt_id == attempt_id,
                    ExamQuestionResponse.question_id == q2.id,
                )
            )).first()
            assert resp_q2 is not None
            assert resp_q2.selected_option_id == opt2_b.id
            assert resp_q2.is_marked_for_review

    async def test_db_fallback_endpoints(self):
        from app.routers.exams import get_question_from_db_fallback, get_solution_from_db_fallback
        from app.db.models import QuestionTranslation, OptionTranslation, QuestionExplanation
        from app.db.models.enums import LanguageCode

        async with self.session_factory() as db_session:
            exam = Exam(
                name="Fallback Test Exam",
                code="FALLBACK-TEST-2024",
                exam_type=QuestionSourceType.PYQ,
                total_marks=100,
                total_questions=1,
                total_duration_minutes=60,
                is_active=True,
            )
            db_session.add(exam)
            await db_session.commit()
            await db_session.refresh(exam)

            q = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                section_code="POLITY",
                marks=2.0,
                negative_marks=0.66,
                expected_time_seconds=60,
                status=QuestionStatus.PUBLISHED,
            )
            db_session.add(q)
            await db_session.commit()
            await db_session.refresh(q)

            opt_a = QuestionOption(question_id=q.id, option_label="A", is_correct=True, display_order=1, distractor_closeness_score=1.0)
            opt_b = QuestionOption(question_id=q.id, option_label="B", is_correct=False, display_order=2, distractor_closeness_score=0.8)
            db_session.add_all([opt_a, opt_b])
            await db_session.commit()
            await db_session.refresh(opt_a)
            await db_session.refresh(opt_b)

            q_trans = QuestionTranslation(
                question_id=q.id,
                language=LanguageCode.ENGLISH,
                question_text="What is Article 21?",
            )
            opt_trans_a = OptionTranslation(
                option_id=opt_a.id,
                language=LanguageCode.ENGLISH,
                option_text="Right to Life and Personal Liberty",
            )
            opt_trans_b = OptionTranslation(
                option_id=opt_b.id,
                language=LanguageCode.ENGLISH,
                option_text="Right to Equality",
            )
            expl = QuestionExplanation(
                question_id=q.id,
                language=LanguageCode.ENGLISH,
                core_concept="Fundamental Right under Part III of the Constitution.",
                detailed_solution="Article 21 guarantees protection of life and personal liberty to all persons.",
                key_takeaways_json=["Applies to citizens and non-citizens alike."],
                common_traps_json=[],
            )
            db_session.add_all([q_trans, opt_trans_a, opt_trans_b, expl])
            await db_session.commit()

            # Test Question DB fallback endpoint
            q_fallback = await get_question_from_db_fallback(
                exam_id=exam.id,
                question_number=1,
                session=db_session,
            )
            assert q_fallback["source"] == "DATABASE_FALLBACK"
            assert q_fallback["data"]["question_number"] == 1
            assert q_fallback["data"]["text"] == "What is Article 21?"
            assert len(q_fallback["data"]["options"]) == 2

            # Test Solution DB fallback endpoint
            sol_fallback = await get_solution_from_db_fallback(
                exam_id=exam.id,
                question_number=1,
                session=db_session,
            )
            assert sol_fallback["source"] == "DATABASE_FALLBACK"
            assert sol_fallback["data"]["correct_option_label"] == "A"
            assert "Article 21 guarantees" in sol_fallback["data"]["explanation"]["text"]
            assert str(opt_b.id) in sol_fallback["data"]["distractor_scores"]
