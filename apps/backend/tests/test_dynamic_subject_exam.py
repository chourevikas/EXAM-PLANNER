import unittest

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import Exam, ExamAttempt, ExamQuestionResponse, Question, QuestionHierarchyLink, Subject, Subtopic, Topic, User
from app.db.models.enums import AttemptStatus, QuestionSourceType, QuestionStatus, UserRole, UserStatus
from app.db.models.hierarchy import SyllabusVersion
from app.schemas.exam_attempt import StartExamRequest
from app.services.exam_session_service import ExamSessionService, canonical_exam_name, dynamic_exam_name


class TestDynamicSubjectExam(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

        async with self.session_factory() as s:
            self.user = User(email="dyn@example.com", full_name="Dyn", role=UserRole.STUDENT, status=UserStatus.ACTIVE)
            upsc_2023 = Exam(name="UPSC CSE Prelims 2023", code="upsc-2023", source_year=2023, is_active=True, exam_type=QuestionSourceType.PYQ)
            bpsc_2022 = Exam(name="BPSC Prelims 2022", code="bpsc-2022", source_year=2022, is_active=True, exam_type=QuestionSourceType.PYQ)
            s.add_all([self.user, upsc_2023, bpsc_2022])
            await s.flush()
            version = SyllabusVersion(exam_id=upsc_2023.id, version_code="V1")
            s.add(version)
            await s.flush()
            polity = Subject(version_id=version.id, name="Polity")
            history = Subject(version_id=version.id, name="History")
            s.add_all([polity, history])
            await s.flush()
            constitution = Topic(subject_id=polity.id, name="Constitution")
            parliament = Topic(subject_id=polity.id, name="Parliament")
            ancient = Topic(subject_id=history.id, name="Ancient")
            s.add_all([constitution, parliament, ancient])
            await s.flush()
            st_const = Subtopic(topic_id=constitution.id, name="Preamble")
            st_parl = Subtopic(topic_id=parliament.id, name="Lok Sabha")
            st_anc = Subtopic(topic_id=ancient.id, name="Harappa")
            s.add_all([st_const, st_parl, st_anc])
            await s.flush()

            self.polity_ids, self.constitution_ids, self.history_ids = set(), set(), set()
            n = 0
            # 3 constitution + 2 parliament (UPSC 2023), 1 parliament (BPSC 2022), 4 history
            plan = [(upsc_2023, st_const, constitution, polity)] * 3 + [(upsc_2023, st_parl, parliament, polity)] * 2 \
                + [(bpsc_2022, st_parl, parliament, polity)] + [(upsc_2023, st_anc, ancient, history)] * 4
            for exam, st, tp, sj in plan:
                n += 1
                q = Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED)
                s.add(q)
                await s.flush()
                s.add(QuestionHierarchyLink(question_id=q.id, subtopic_id=st.id, topic_id=tp.id, subject_id=sj.id))
                (self.polity_ids if sj is polity else self.history_ids).add(q.id)
                if tp is constitution:
                    self.constitution_ids.add(q.id)
            # A polity question tagged only through its own subtopic_id, and a second link row on another one
            q = Question(exam_id=upsc_2023.id, question_number_in_paper=99, status=QuestionStatus.PUBLISHED, subtopic_id=st_parl.id)
            s.add(q)
            await s.flush()
            self.polity_ids.add(q.id)
            s.add(QuestionHierarchyLink(question_id=min(self.constitution_ids), subtopic_id=st_parl.id, topic_id=parliament.id, subject_id=polity.id))
            await s.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _start(self, **kwargs):
        async with self.session_factory() as s:
            return await ExamSessionService(s).start_exam(user_id=self.user.id, req=StartExamRequest(**kwargs))

    async def _question_ids(self, attempt_id):
        async with self.session_factory() as s:
            rows = await s.exec(select(ExamQuestionResponse.question_id).where(ExamQuestionResponse.attempt_id == int(attempt_id)).order_by(ExamQuestionResponse.id))
            return list(rows.all())

    async def test_subject_filter_limit_and_resume_by_exam_code(self):
        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=5, dynamic_subject="Polity")
        ids = await self._question_ids(res.attempt_id)
        self.assertTrue(res.exam_id.startswith("DYN_"))
        self.assertEqual(res.total_questions, 5)
        self.assertEqual(len(ids), 5)
        self.assertEqual(len(set(ids)), 5, "a question linked twice must not be picked twice")
        self.assertTrue(set(ids) <= self.polity_ids)

        # The exam engine page then opens /exam/<exam_id> and calls start again: it must resume, not start another exam
        resumed = await self._start(exam_id=res.exam_id)
        self.assertEqual(resumed.attempt_id, res.attempt_id)
        self.assertEqual(resumed.total_questions, 5)

    async def test_limit_larger_than_pool_uses_actual_count(self):
        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=30, dynamic_subject="Polity")
        self.assertEqual(res.total_questions, len(self.polity_ids))
        async with self.session_factory() as s:
            exam = (await s.exec(select(Exam).where(Exam.code == res.exam_id))).one()
            attempt = await s.get(ExamAttempt, int(res.attempt_id))
        self.assertEqual(exam.total_questions, len(self.polity_ids))
        self.assertEqual(attempt.report_metadata_json["dynamic_subject"], "Polity")
        self.assertEqual(attempt.report_metadata_json["dynamic_topic"], "all")

    async def test_topic_exam_and_year_filters(self):
        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=30, dynamic_subject="Polity", dynamic_topic="Constitution")
        self.assertEqual(set(await self._question_ids(res.attempt_id)), self.constitution_ids)

        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=30, dynamic_subject="Polity", dynamic_exams="BPSC")
        self.assertEqual(res.total_questions, 1)

        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=30, dynamic_subject="Polity", dynamic_years="2022")
        self.assertEqual(res.total_questions, 1)

    async def test_count_matches_the_pool_a_test_draws_from(self):
        async def count(**kwargs):
            async with self.session_factory() as s:
                return await ExamSessionService(s).count_dynamic_questions(StartExamRequest(exam_id="dynamic", **kwargs))

        # A question linked twice is counted once, as it can only be picked once
        self.assertEqual(await count(dynamic_subject="Polity"), len(self.polity_ids))
        self.assertEqual(await count(dynamic_subject="Polity", dynamic_topic="Constitution"), len(self.constitution_ids))
        self.assertEqual(await count(dynamic_subject="Polity", dynamic_exams="BPSC"), 1)
        self.assertEqual(await count(dynamic_subject="Polity", dynamic_years="2022"), 1)
        self.assertEqual(await count(dynamic_exams="SSC"), 0)
        self.assertEqual(await count(), len(self.polity_ids) + len(self.history_ids))

        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=await count(dynamic_subject="Polity"), dynamic_subject="Polity")
        self.assertEqual(set(await self._question_ids(res.attempt_id)), self.polity_ids)

    async def test_no_match_raises_and_creates_nothing(self):
        with self.assertRaises(HTTPException) as ctx:
            await self._start(exam_id="dynamic", force_new=True, dynamic_subject="Economy")
        self.assertEqual(ctx.exception.status_code, 404)
        async with self.session_factory() as s:
            self.assertEqual((await s.exec(select(Exam).where(Exam.code.like("DYN_%")))).all(), [])

    async def test_retake_by_numeric_exam_id_replays_same_questions(self):
        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=4, dynamic_subject="History")
        first_ids = await self._question_ids(res.attempt_id)
        async with self.session_factory() as s:
            exam = (await s.exec(select(Exam).where(Exam.code == res.exam_id))).one()

        retake = await self._start(exam_id=exam.id, force_new=True)
        self.assertNotEqual(retake.attempt_id, res.attempt_id)
        self.assertEqual(await self._question_ids(retake.attempt_id), first_ids)
        async with self.session_factory() as s:
            old = await s.get(ExamAttempt, int(res.attempt_id))
            new = await s.get(ExamAttempt, int(retake.attempt_id))
        self.assertEqual(old.status, AttemptStatus.ABANDONED)
        self.assertEqual(new.report_metadata_json["dynamic_subject"], "History")

    async def test_questions_numbered_by_position_and_bulk_loads_attempt_set(self):
        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=30, dynamic_subject="Polity")
        ids = await self._question_ids(res.attempt_id)
        async with self.session_factory() as s:
            service = ExamSessionService(s)
            second = await service.get_question(res.attempt_id, self.user.id, 2)
            bulk = await service.get_all_questions_bulk(res.attempt_id, self.user.id, offset=2, limit=3)
        self.assertEqual(second.question.question_number, 2)
        self.assertEqual(second.question.question_id, str(ids[1]))
        self.assertEqual([int(q["question_id"]) for q in bulk["questions"]], ids[2:5])
        self.assertEqual([q["question_number"] for q in bulk["questions"]], [3, 4, 5])

    async def test_exam_named_by_subject_and_exam_with_real_marks(self):
        res = await self._start(exam_id="dynamic", force_new=True, dynamic_limit=30, dynamic_subject="Polity", dynamic_exams="BPSC")
        async with self.session_factory() as s:
            exam = (await s.exec(select(Exam).where(Exam.code == res.exam_id))).one()
            items = (await ExamSessionService(s).list_user_attempts(self.user.id))["items"]
        self.assertEqual(exam.name, "Polity · BPSC")
        self.assertEqual(exam.total_marks, 2.0)
        listed = next(i for i in items if i["attempt_id"] == res.attempt_id)
        self.assertEqual((listed["exam_name"], listed["exam_code"]), ("Polity · BPSC", res.exam_id))
        self.assertEqual(listed["max_duration_seconds"], 60)

    async def test_subject_wise_listing_is_filtered_paged_and_newest_first(self):
        # A normal full-paper attempt must not appear in the subject-wise list
        async with self.session_factory() as s:
            upsc = (await s.exec(select(Exam).where(Exam.code == "upsc-2023"))).one()
        await self._start(exam_id=upsc.id)
        started = []
        for subject in ("Polity", "History", "Polity"):
            started.append((await self._start(exam_id="dynamic", force_new=True, dynamic_limit=1, dynamic_subject=subject)).attempt_id)

        async with self.session_factory() as s:
            service = ExamSessionService(s)
            page1 = await service.list_user_attempts(self.user.id, skip=0, limit=2, subject_wise=True)
            page2 = await service.list_user_attempts(self.user.id, skip=2, limit=2, subject_wise=True)
        self.assertEqual(page1["total"], 3)
        self.assertEqual([i["attempt_id"] for i in page1["items"] + page2["items"]], started[::-1])
        self.assertTrue(all(i["exam_code"].startswith("DYN_") for i in page1["items"] + page2["items"]))

    def test_dynamic_exam_name(self):
        req = lambda **kw: StartExamRequest(exam_id="dynamic", **kw)
        self.assertEqual(dynamic_exam_name(req()), "All Subjects · All Exams")
        self.assertEqual(dynamic_exam_name(req(dynamic_subject="History", dynamic_exams="UPSC CSE,BPSC")), "History · UPSC CSE, BPSC")
        self.assertEqual(
            dynamic_exam_name(req(dynamic_subject="Polity", dynamic_topic="Parliament", dynamic_years="2022,2021")),
            "Polity – Parliament · All Exams (2021, 2022)",
        )
        self.assertEqual(
            dynamic_exam_name(req(dynamic_subject="Polity", dynamic_topic="Parliament", dynamic_subtopic="Lok Sabha")),
            "Polity – Lok Sabha · All Exams",
        )

    def test_canonical_exam_name_matches_frontend(self):
        self.assertEqual(canonical_exam_name("UPSC CSE Prelims 2023"), "UPSC CSE")
        self.assertEqual(canonical_exam_name("BPSC Prelims 2022"), "BPSC")
        self.assertEqual(canonical_exam_name("upsc_cse-prelims-gs1-2023-A"), "UPSC CSE")
        self.assertEqual(canonical_exam_name("CDS Prelims 2021"), "CDS")
