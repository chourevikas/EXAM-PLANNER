from google.genai._gaos.models import listenvironments
import uuid
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

    async def get_batch_by_id(self, batch_id: uuid.UUID) -> Optional[AnswerKeyBatch]:
        return await self.session.get(AnswerKeyBatch, batch_id)

    async def get_mappings_for_batch(
        self, batch_id: uuid.UUID
    ) -> List[AnswerKeyMapping]:
        stmt = (
            select(AnswerKeyMapping)
            .where(AnswerKeyMapping.batch_id == batch_id)
            .order_by(col(AnswerKeyMapping.printed_question_number))
        )
        res = await self.session.exec(stmt)
        return list(res.all())
