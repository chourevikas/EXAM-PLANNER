import unittest
from io import BytesIO
from fastapi import UploadFile
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine
from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    OptionTranslation,
    LanguageCode,
    QuestionStatus,
    HumanReviewTask,
    PipelineRun,
    AnswerKeyBatch,
    Test as ExamTestModel,
    TestQuestion as ExamTestQuestionModel,
    UserTestAttempt,
    User,
    UserRole,
)
from httpx import AsyncClient, ASGITransport
from app.fastapi_server import app
from app.db.session import get_async_session
from app.services.exam_service import ExamService
from app.repositories.exam_repository import ExamRepository


class TestExamDeletionAndOverwrite(unittest.IsolatedAsyncioTestCase):

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

    async def test_get_all_matching_canonical_exams(self):
        async with self.session_factory() as session:
            repo = ExamRepository(session)

            # Create two exams representing slight variations
            e1 = Exam(
                code="test-upsc-prelims-gs1-2099-set_a",
                name="UPSC (2099) - Set A",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2099,
                paper_set_code="SET_A",
            )
            session.add(e1)
            await session.commit()
            await session.refresh(e1)

            # 1. Match by exact code
            matches = await repo.get_all_matching_canonical_exams(code="test-upsc-prelims-gs1-2099-set_a")
            self.assertEqual(len(matches), 1)
            self.assertEqual(matches[0].id, e1.id)

            # 2. Match by composite key
            matches_comp = await repo.get_all_matching_canonical_exams(
                year=2099,
                stage="prelims",
                subject_code="gs1",
                paper_set_code="set_a",
            )
            self.assertEqual(len(matches_comp), 1)
            self.assertEqual(matches_comp[0].id, e1.id)

            # 3. Match by alias (upse <-> upsc)
            e_alias = Exam(
                code="upse-prelims-gs1-2098-set_a",
                name="UPSE (2098) - Set A",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2098,
                paper_set_code="SET_A",
            )
            session.add(e_alias)
            await session.commit()
            await session.refresh(e_alias)

            matches_alias = await repo.get_all_matching_canonical_exams(code="upsc-prelims-gs1-2098-set_a")
            self.assertTrue(len(matches_alias) >= 1)
            self.assertTrue(any(m.id == e_alias.id for m in matches_alias))

    async def test_cascading_delete_exam(self):
        async with self.session_factory() as session:
            service = ExamService(session)

            # 1. Create an Exam
            exam = Exam(
                code="test-delete-cascade-2099-set_a",
                name="Test Cascade Exam (2099)",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2099,
                paper_set_code="SET_A",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            # 2. Create Question, Option, Translation, ReviewTask, PipelineRun, AnswerKeyBatch
            q = Question(
                exam_id=exam_id,
                question_number_in_paper=1,
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(q)
            await session.commit()
            await session.refresh(q)

            opt = QuestionOption(
                question_id=q.id,
                option_label="A",
                display_order=1,
                is_correct=True,
            )
            session.add(opt)
            await session.commit()
            await session.refresh(opt)

            opt_trans = OptionTranslation(
                option_id=opt.id,
                language=LanguageCode.HINDI,
                option_text="विकल्प ए",
            )
            session.add(opt_trans)

            review_task = HumanReviewTask(
                exam_id=exam_id,
                question_id=q.id,
                review_status="PENDING_REVIEW",
            )
            session.add(review_task)

            pipe_run = PipelineRun(
                exam_id=exam_id,
                pipeline_type="QUESTION_EXTRACTION",
                status="COMPLETED",
            )
            session.add(pipe_run)

            ak_batch = AnswerKeyBatch(
                exam_id=exam_id,
                pdf_path="test_ak.pdf",
                target_set_code="SET_A",
            )
            session.add(ak_batch)

            # 2b. Create linked Test, TestQuestion, and UserTestAttempt
            user = User(
                email="testuser@example.com",
                full_name="Test User",
                role=UserRole.STUDENT,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

            test_obj = ExamTestModel(
                id=exam_id,
                title="Test Exam",
                test_type="PYQ",
            )
            session.add(test_obj)

            test_q = ExamTestQuestionModel(
                test_id=exam_id,
                question_id=q.id,
                question_order=1,
            )
            session.add(test_q)

            test_attempt = UserTestAttempt(
                user_id=user.id,
                test_id=exam_id,
            )
            session.add(test_attempt)
            await session.commit()

            # 3. Call delete_exam
            success = await service.delete_exam(exam_id)
            self.assertTrue(success)

            # 4. Verify all child and parent records are deleted
            deleted_exam = (await session.exec(select(Exam).where(Exam.id == exam_id))).first()
            self.assertIsNone(deleted_exam)

            deleted_q = (await session.exec(select(Question).where(Question.exam_id == exam_id))).all()
            self.assertEqual(len(deleted_q), 0)

            deleted_opt = (await session.exec(select(QuestionOption).where(QuestionOption.id == opt.id))).first()
            self.assertIsNone(deleted_opt)

            deleted_trans = (await session.exec(select(OptionTranslation).where(OptionTranslation.option_id == opt.id))).first()
            self.assertIsNone(deleted_trans)

            deleted_review = (await session.exec(select(HumanReviewTask).where(HumanReviewTask.exam_id == exam_id))).all()
            self.assertEqual(len(deleted_review), 0)

            deleted_pipe = (await session.exec(select(PipelineRun).where(PipelineRun.exam_id == exam_id))).all()
            self.assertEqual(len(deleted_pipe), 0)

            deleted_ak = (await session.exec(select(AnswerKeyBatch).where(AnswerKeyBatch.exam_id == exam_id))).all()
            self.assertEqual(len(deleted_ak), 0)

            deleted_test = (await session.exec(select(ExamTestModel).where(ExamTestModel.id == exam_id))).first()
            self.assertIsNone(deleted_test)

            deleted_test_q = (await session.exec(select(ExamTestQuestionModel).where(ExamTestQuestionModel.test_id == exam_id))).all()
            self.assertEqual(len(deleted_test_q), 0)

            deleted_test_attempt = (await session.exec(select(UserTestAttempt).where(UserTestAttempt.test_id == exam_id))).all()
            self.assertEqual(len(deleted_test_attempt), 0)

    async def test_handle_pdf_upload_overwrite_deletes_duplicate(self):
        async with self.session_factory() as session:
            service = ExamService(session)

            # Anchor exam to advance autoincrement ID
            anchor_exam = Exam(
                code="anchor-exam",
                name="Anchor Exam",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2000,
                paper_set_code="SET_A",
            )
            session.add(anchor_exam)
            await session.commit()

            # Create an existing exam that will conflict
            existing_exam = Exam(
                code="upsc-prelims-gs1-2095-set_a",
                name="UPSC (2095) - Set A",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2095,
                paper_set_code="SET_A",
            )
            session.add(existing_exam)
            await session.commit()
            await session.refresh(existing_exam)
            old_id = existing_exam.id

            # Anchor exam after existing to ensure SQLite rowid advances past old_id
            anchor_exam_2 = Exam(
                code="anchor-exam-2",
                name="Anchor Exam 2",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2001,
                paper_set_code="SET_A",
            )
            session.add(anchor_exam_2)
            await session.commit()

            # Add a question to old exam
            old_q = Question(
                exam_id=old_id,
                question_number_in_paper=1,
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(old_q)
            await session.commit()
            await session.refresh(old_q)

            # Mock a PDF upload with OVERWRITE
            dummy_pdf = BytesIO(b"%PDF-1.4 minimal test pdf")
            upload_file = UploadFile(filename="upsc_2095_gs1_set_a.pdf", file=dummy_pdf)

            result = await service.handle_pdf_upload(
                file=upload_file,
                year=2095,
                set_code="SET_A",
                stage="PRELIMS",
                subject_code="GS1",
                conflict_resolution="OVERWRITE",
                run_mode="background",
            )

            new_id = int(result["exam_id"])
            self.assertNotEqual(new_id, old_id)

            # Verify old question was deleted from DB
            old_q_check = (await session.exec(select(Question).where(Question.id == old_q.id))).first()
            self.assertIsNone(old_q_check)

            # Verify exactly 1 exam exists for 2095 SET_A
            all_2095 = (await session.exec(select(Exam).where(Exam.source_year == 2095, Exam.paper_set_code == "SET_A"))).all()
            self.assertEqual(len(all_2095), 1)
            self.assertEqual(all_2095[0].id, new_id)

    async def test_delete_exam_endpoint(self):
        """Tests DELETE /api/v1/exams/{exam_id} endpoint directly."""
        async with self.session_factory() as session:
            exam = Exam(
                code="test-delete-endpoint-exam",
                name="Endpoint Delete Test Exam",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2030,
                paper_set_code="SET_A",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            # 1. Successful deletion
            res = await ac.delete(f"/api/v1/exams/{exam_id}")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue(data["success"])
            self.assertEqual(data["exam_id"], str(exam_id))

            # 2. Deleting non-existent exam returns 404
            res_404 = await ac.delete(f"/api/v1/exams/{exam_id}")
            self.assertEqual(res_404.status_code, 404)

    def test_all_exam_child_relationships_are_cascade_safe(self):
        """
        Automated architectural guardrail:
        Scans SQLModel.metadata.tables across all registered models.
        Asserts that every foreign key referencing 'exams', 'questions', 'question_options',
        or 'exam_attempts' defines ondelete in ('CASCADE', 'SET NULL').
        This ensures future models added to the codebase automatically adhere to cascading deletion
        without needing manual checks or edits.
        """
        tables = SQLModel.metadata.tables
        unsafe_fks = []
        for table_name, table in tables.items():
            for fk in table.foreign_keys:
                target_table = fk.target_fullname.split(".")[0]
                if target_table in ("exams", "questions", "question_options", "exam_attempts"):
                    if fk.ondelete not in ("CASCADE", "SET NULL"):
                        unsafe_fks.append(
                            f"{table_name}.{fk.parent.name} -> {fk.target_fullname} (ondelete={fk.ondelete})"
                        )

        self.assertEqual(
            unsafe_fks,
            [],
            f"Found foreign keys referencing exam hierarchy without CASCADE/SET NULL: {unsafe_fks}. "
            f"Please add ondelete='CASCADE' or ondelete='SET NULL' to these fields.",
        )


