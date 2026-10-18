"""Practice-page answers by signed-in students and the free plan's daily question usage."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_current_user
from app.db.models.analytics import PracticeAnswer
from app.db.models.enums import QuestionStatus
from app.db.models.question import Question, QuestionOption
from app.db.models.user import User, UserRole
from app.db.session import get_async_session
from app.services import free_plan

router = APIRouter(tags=["Practice"])


class PracticeAnswerIn(BaseModel):
    question_id: int
    selected_option_id: Optional[int] = None


@router.get("/users/me/daily-usage", summary="Questions answered today and what's left on the free plan")
async def get_daily_usage(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    return await free_plan.daily_usage(session, current_user)


@router.post("/practice/answers", summary="Record a practice-page answer (counts toward the free plan's daily limit)")
async def record_practice_answer(
    payload: PracticeAnswerIn,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    question = await session.get(Question, payload.question_id)
    if not question or question.status != QuestionStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Question not found")

    option = None
    if payload.selected_option_id is not None:
        option = await session.get(QuestionOption, payload.selected_option_id)
        if not option or option.question_id != question.id:
            raise HTTPException(status_code=422, detail="Option does not belong to this question")

    # Only students' practice is recorded; answering the same question again today doesn't count twice
    counted = False
    if current_user.role == UserRole.STUDENT:
        start, end = free_plan.ist_day_bounds()
        already = (await session.exec(
            select(PracticeAnswer.id).where(
                PracticeAnswer.user_id == current_user.id,
                PracticeAnswer.question_id == question.id,
                col(PracticeAnswer.answered_at) >= start,
                col(PracticeAnswer.answered_at) < end,
            )
        )).first()
        if not already:
            remaining = await free_plan.remaining_today(session, current_user)
            if remaining is not None and remaining <= 0:
                raise free_plan.daily_limit_error()
            is_correct = bool(option and option.is_correct)
            practice = PracticeAnswer(
                user_id=current_user.id,
                question_id=question.id,
                selected_option_id=option.id if option else None,
                is_correct=is_correct,
            )
            session.add(practice)
            await session.commit()
            await session.refresh(practice)
            counted = True

            from app.services import xp_service
            if is_correct:
                await xp_service.award(
                    session, current_user.id, xp_service.XP_CORRECT_ANSWER, "CORRECT_ANSWERS",
                    f"practice:{practice.id}", "Correct practice answer", commit=False,
                )
            await xp_service.award_active_day(session, current_user.id, commit=False)
            # Reschedule the question for spaced revision (right: later, wrong: sooner)
            from app.services import revision_service
            await revision_service.record_answer(session, current_user.id, question, is_correct)
            await session.commit()
            await xp_service.forget_cached_stats(current_user.id)

            from app.services import milestone_service
            await milestone_service.check(session, current_user.id)

    return {"counted": counted, "usage": await free_plan.daily_usage(session, current_user)}
