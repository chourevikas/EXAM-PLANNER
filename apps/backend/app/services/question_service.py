import uuid
from typing import Optional, List
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Question, QuestionStatus
from app.repositories.question_repository import QuestionRepository
from app.storage.factory import get_storage_provider
from app.formatters.yaml_exporter import async_export_question_to_yaml_string
from app.formatters.markdown_exporter import async_export_question_to_markdown


class QuestionService:
    """Service handling business logic and formatting export for Question entities."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = QuestionRepository(session)

    async def list_questions(
        self,
        exam_id: Optional[uuid.UUID] = None,
        status: Optional[QuestionStatus] = None
    ) -> List[Question]:
        return await self.repo.list_questions(exam_id=exam_id, status=status)

    async def get_question_yaml_file(self, question_id: uuid.UUID) -> str:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        return await async_export_question_to_yaml_string(self.session, q)

    async def get_question_markdown_file(self, question_id: uuid.UUID) -> str:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        storage = get_storage_provider()
        return await async_export_question_to_markdown(self.session, q, storage=storage)
