from typing import Optional, List
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import AnswerKeyBatch, AnswerKeyMapping


class AnswerKeyRepository:
    """Repository handling all database operations for AnswerKeyBatch and AnswerKeyMapping entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_batches(self) -> List[AnswerKeyBatch]:
        stmt = select(AnswerKeyBatch).order_by(col(AnswerKeyBatch.created_at).desc())
        res = await self.session.exec(stmt)
        return list(res.all())

    async def get_batch_by_id(self, batch_id: int | str) -> Optional[AnswerKeyBatch]:
        try:
            bid = int(batch_id)
        except (ValueError, TypeError):
            return None
        return await self.session.get(AnswerKeyBatch, bid)

    async def get_mappings_for_batch(
        self, batch_id: int | str
    ) -> List[AnswerKeyMapping]:
        try:
            bid = int(batch_id)
        except (ValueError, TypeError):
            return []
        stmt = (
            select(AnswerKeyMapping)
            .where(AnswerKeyMapping.batch_id == bid)
            .order_by(col(AnswerKeyMapping.printed_question_number))
        )
        res = await self.session.exec(stmt)
        return list(res.all())
