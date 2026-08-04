import uuid
from typing import Optional, List
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import AnswerKeyBatch, AnswerKeyMapping


class AnswerKeyRepository:
    """Repository handling all database operations for AnswerKeyBatch and AnswerKeyMapping entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_batches(self) -> List[AnswerKeyBatch]:
        stmt = select(AnswerKeyBatch).order_by(AnswerKeyBatch.created_at.desc())
        res = await self.session.exec(stmt)
        return res.all()

    async def get_batch_by_id(self, batch_id: uuid.UUID) -> Optional[AnswerKeyBatch]:
        return await self.session.get(AnswerKeyBatch, batch_id)

    async def get_mappings_for_batch(self, batch_id: uuid.UUID) -> List[AnswerKeyMapping]:
        stmt = select(AnswerKeyMapping).where(AnswerKeyMapping.batch_id == batch_id).order_by(AnswerKeyMapping.printed_question_number)
        res = await self.session.exec(stmt)
        return res.all()
