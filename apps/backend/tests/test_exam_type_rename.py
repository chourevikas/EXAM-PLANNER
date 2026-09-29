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

    async def test_resave_repairs_papers_renamed_before_the_fix(self):
        # Type code already changed without cascading (the pre-fix state); a plain save resyncs.
        async with self.session_factory() as s:
            et = await s.get(ExamType, self.et_id)
            et.type = "uppcspre"
            s.add(et)
            await s.commit()
        async with self.session_factory() as s:
            await ExamTypeService(s).update_exam_type(self.et_id, ExamTypeUpdate(name="Uppcs Prelims"))

        names = await self._names()
        self.assertEqual(names[0], "UPPCSPRE (2025) - Set A")
        self.assertEqual(names[1], "UPPCSPRE Prelims (2024) - Set A")
        self.assertEqual(names[3], "Uttar Pradesh PCS 2021")


if __name__ == "__main__":
    unittest.main()
