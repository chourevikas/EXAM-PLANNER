from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlmodel import select, col, func
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import ExamType, Exam


class ExamTypeRepository:
    """Repository handling database operations for ExamType entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, exam_type_id: int | str) -> Optional[ExamType]:
        try:
            parsed_id = int(exam_type_id)
        except (ValueError, TypeError):
            return None
        return await self.session.get(ExamType, parsed_id)

    async def get_by_type(self, type_str: str) -> Optional[ExamType]:
        if not type_str:
            return None
        cleaned = type_str.strip().lower()
        stmt = select(ExamType).where(func.lower(ExamType.type) == cleaned)
        res = await self.session.exec(stmt)
        record = res.first()
        if not record:
            # Check name match
            stmt_name = select(ExamType).where(func.lower(ExamType.name).contains(cleaned))
            res_name = await self.session.exec(stmt_name)
            record = res_name.first()
        if not record and cleaned in ("upsc", "upse"):
            # Seamless fallback between upsc and upse aliases
            alternate = "upse" if cleaned == "upsc" else "upsc"
            stmt_alt = select(ExamType).where(func.lower(ExamType.type) == alternate)
            res_alt = await self.session.exec(stmt_alt)
            record = res_alt.first()
        return record

    async def list_all(self, include_inactive: bool = True) -> List[Tuple[ExamType, int]]:
        """Returns list of (ExamType, exams_count) tuples ordered by type."""
        stmt = (
            select(ExamType, func.count(col(Exam.id)))
            .outerjoin(Exam, col(Exam.exam_type_id) == col(ExamType.id))
            .group_by(col(ExamType.id))
            .order_by(col(ExamType.name).asc())
        )
        if not include_inactive:
            stmt = stmt.where(ExamType.is_active == True)
        res = await self.session.exec(stmt)
        return list(res.all())

    async def create(self, exam_type: ExamType) -> ExamType:
        self.session.add(exam_type)
        await self.session.commit()
        await self.session.refresh(exam_type)
        return exam_type

    async def update(self, exam_type: ExamType, update_data: Dict[str, Any]) -> ExamType:
        for key, value in update_data.items():
            if value is not None and hasattr(exam_type, key):
                setattr(exam_type, key, value)
        exam_type.updated_at = datetime.now(timezone.utc)
        self.session.add(exam_type)
        await self.session.commit()
        await self.session.refresh(exam_type)
        return exam_type

    async def delete(self, exam_type: ExamType) -> bool:
        await self.session.delete(exam_type)
        await self.session.commit()
        return True

    async def count_associated_exams(self, exam_type_id: int) -> int:
        stmt = select(func.count(col(Exam.id))).where(col(Exam.exam_type_id) == exam_type_id)
        res = await self.session.exec(stmt)
        return res.one() or 0
