import unittest

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import Exam, ExamType
from app.schemas.exam_type import ExamTypeUpdate
from app.services.exam_type_service import ExamTypeService


class TestExamTypeRenameSyncsPaperNames(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

        async with self.session_factory() as s:
            et = ExamType(type="uppcsprelims", name="Uppcs Prelims")
            other = ExamType(type="upsc", name="UPSC")
            s.add_all([et, other])
            await s.flush()
            self.et_id, self.other_id = et.id, other.id
            s.add_all([
                Exam(code="uppcsprelims-prelims-gs1-2025-set_a", name="UPPCSPRELIMS (2025) - Set A", exam_type_id=et.id, source_year=2025),
                Exam(code="uppcsprelims-prelims-gs1-2024-set_a", name="UPPCSPRELIMS Prelims (2024) - Set A", exam_type_id=et.id, source_year=2024),
                # Older upload never linked by FK, but uploaded under the old code.
                Exam(code="uppcsprelims-prelims-gs1-2023-set_a", name="UPPCSPRELIMS (2023) - Set A", exam_type_id=None, source_year=2023),
                # Hand-written name on a linked paper stays untouched.
                Exam(code="custom-uppcs-2021", name="Uttar Pradesh PCS 2021", exam_type_id=et.id, source_year=2021),
                # Another type's paper stays untouched.
                Exam(code="upsc-prelims-gs1-2020-set_a", name="UPSC (2020) - Set A", exam_type_id=other.id, source_year=2020),
            ])
            await s.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _names(self):
        async with self.session_factory() as s:
            rows = (await s.exec(select(Exam).order_by(Exam.source_year.desc()))).all()
            return [r.name for r in rows]

    async def test_code_change_renames_existing_papers(self):
        async with self.session_factory() as s:
            await ExamTypeService(s).update_exam_type(self.et_id, ExamTypeUpdate(type="UPPCSPRE"))

        self.assertEqual(
            await self._names(),
            [
                "UPPCSPRE (2025) - Set A",
                "UPPCSPRE Prelims (2024) - Set A",
                "UPPCSPRE (2023) - Set A",
                "Uttar Pradesh PCS 2021",
                "UPSC (2020) - Set A",
            ],
        )

    async def test_paper_of_another_exam_linked_to_the_type_is_left_alone(self):
        # An UPPCS paper linked to the upsc type at upload: renaming or re-saving upsc must not rename it.
        async with self.session_factory() as s:
            s.add(Exam(code="uppcs-prelims-gs1-2019-set_a", name="UPPCS", exam_type_id=self.other_id, source_year=2019))
            await s.commit()
        async with self.session_factory() as s:
            await ExamTypeService(s).update_exam_type(self.other_id, ExamTypeUpdate(type="upsccse"))
        async with self.session_factory() as s:
            await ExamTypeService(s).update_exam_type(self.other_id, ExamTypeUpdate(name="UPSC CSE"))

        names = await self._names()
        self.assertEqual(names[-2:], ["UPSCCSE (2020) - Set A", "UPPCS"])

    async def test_unlinked_paper_follows_every_rename(self):
        # Exam.code keeps the upload-time code, so the second rename has to find the paper by name.
        for code in ("UPPCSPRE", "UPPCS_P"):
            async with self.session_factory() as s:
                await ExamTypeService(s).update_exam_type(self.et_id, ExamTypeUpdate(type=code))

        names = await self._names()
        self.assertEqual(names[:4], [
            "UPPCS_P (2025) - Set A",
            "UPPCS_P Prelims (2024) - Set A",
            "UPPCS_P (2023) - Set A",
            "Uttar Pradesh PCS 2021",
        ])

if __name__ == "__main__":
    unittest.main()
