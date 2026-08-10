import uuid
from typing import Optional, List
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import Question, QuestionStatus


class QuestionRepository:
    """Repository handling database operations for Question entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, question_id: uuid.UUID) -> Optional[Question]:
        return await self.session.get(Question, question_id)

    async def list_questions(
        self,
        exam_id: Optional[uuid.UUID] = None,
        status: Optional[QuestionStatus] = None,
    ) -> List[Question]:
        stmt = select(Question)
        if exam_id:
            stmt = stmt.where(Question.exam_id == exam_id)
        if status:
            stmt = stmt.where(Question.status == status)
        res = await self.session.exec(stmt)
        return res.all()
