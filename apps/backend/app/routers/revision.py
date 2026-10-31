"""The student's revision: questions due by their spaced-repetition schedule."""
from fastapi import APIRouter, Depends, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_current_user
from app.core.languages import parse_language
from app.db.models.user import User
from app.db.session import get_async_session
from app.services import revision_service

router = APIRouter(prefix="/users/me/revision", tags=["Revision"])


@router.get("", summary="Questions and topics due for revision today")
async def revision_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await revision_service.due_summary(session, current_user.id)


@router.get("/practice", summary="Due questions with solutions, for a revision practice session")
async def revision_practice(
    language: str = Query(default="en", description="Session language: en, hi or mr"),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Same item shape as GET /questions, most overdue first."""
    from app.services.question_service import QuestionService

    questions = await revision_service.due_questions(session, current_user.id, limit)
    items = await QuestionService(session)._build_batch_question_detail_responses(
        questions, target_lang=parse_language(language), include_solutions=True
    )
    return JSONResponse(content=jsonable_encoder({"items": items, "total": len(items)}))
