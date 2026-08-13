import uuid
from typing import Optional, List, Dict, Any
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import Exam


class ExamRepository:
    """Repository handling all database operations for Exam entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, exam_id: uuid.UUID) -> Optional[Exam]:
        return await self.session.get(Exam, exam_id)

    async def get_by_code(self, code: str) -> Optional[Exam]:
        stmt = select(Exam).where(Exam.code == code)
        res = await self.session.exec(stmt)
        return res.first()

    async def list_all(self, status: Optional[str] = None) -> List[Exam]:
        stmt = select(Exam)
        if status:
            from sqlmodel import cast, String
            target_str = str(status.value) if hasattr(status, "value") else str(status)
            stmt = stmt.where(cast(Exam.status, String) == target_str)
        stmt = stmt.order_by(col(Exam.created_at).desc())
        res = await self.session.exec(stmt)
        return res.all()

    async def find_matching_exams_for_answer_key(
        self, stage: str, subject_code: str, year: int
    ) -> List[Exam]:
        stmt = select(Exam).where(
            Exam.stage == stage,
            Exam.subject_code == subject_code,
            Exam.source_year == year,
        )
        res = await self.session.exec(stmt)
        return res.all()

    async def save(self, exam: Exam) -> Exam:
        self.session.add(exam)
        await self.session.commit()
        await self.session.refresh(exam)
        return exam
