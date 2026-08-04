import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_async_session
from app.db.models import Question, QuestionStatus
from app.services.question_service import QuestionService


router = APIRouter(prefix="/questions", tags=["Questions & Formatted Outputs"])


@router.get("", response_model=List[Question])
async def list_questions(
    exam_id: Optional[uuid.UUID] = None,
    status: Optional[QuestionStatus] = None,
    session: AsyncSession = Depends(get_async_session)
):
    service = QuestionService(session)
    return await service.list_questions(exam_id=exam_id, status=status)


@router.get("/{question_id}/formatted/yaml", response_class=PlainTextResponse)
async def get_question_yaml_file(question_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)):
    service = QuestionService(session)
    return await service.get_question_yaml_file(question_id)


@router.get("/{question_id}/formatted/markdown", response_class=PlainTextResponse)
async def get_question_markdown_file(question_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)):
    service = QuestionService(session)
    return await service.get_question_markdown_file(question_id)
