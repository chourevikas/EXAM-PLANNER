import unittest

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import Exam, ExamType
from app.schemas.exam_type import ExamTypeUpdate
from app.services.exam_type_service import ExamTypeService


class TestExamTypeCodeLocked(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

        async with self.session_factory() as s:
            et = ExamType(type="upsc", name="UPSC")
            s.add(et)
            await s.flush()
            self.et_id = et.id
            s.add(Exam(code="upsc-prelims-gs1-2020-set_a", name="UPSC (2020) - Set A", exam_type_id=et.id, source_year=2020))
            await s.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _exam_type(self):
        async with self.session_factory() as s:
            return await s.get(ExamType, self.et_id)

    async def test_changing_code_is_rejected(self):
        async with self.session_factory() as s:
            with self.assertRaises(HTTPException) as ctx:
                await ExamTypeService(s).update_exam_type(self.et_id, ExamTypeUpdate(type="upsccse", name="UPSC CSE"))
        self.assertEqual(ctx.exception.status_code, 400)

        et = await self._exam_type()
        self.assertEqual((et.type, et.name), ("upsc", "UPSC"))

    async def test_name_can_be_edited_with_current_code_echoed(self):
        # The edit form submits its full state, including the unchanged code.
        async with self.session_factory() as s:
            resp = await ExamTypeService(s).update_exam_type(
                self.et_id, ExamTypeUpdate(type=" UPSC ", name="UPSC Civil Services Examination")
            )
        self.assertEqual((resp.type, resp.name), ("upsc", "UPSC Civil Services Examination"))

        async with self.session_factory() as s:
            names = (await s.exec(select(Exam.name))).all()
        self.assertEqual(names, ["UPSC (2020) - Set A"])

    async def test_name_only_update(self):
        async with self.session_factory() as s:
            resp = await ExamTypeService(s).update_exam_type(self.et_id, ExamTypeUpdate(name="UPSC CSE"))
        self.assertEqual((resp.type, resp.name), ("upsc", "UPSC CSE"))


if __name__ == "__main__":
    unittest.main()
