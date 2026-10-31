"""Free plan limits: 20 answered questions per day and no post-test summary or analysis.

A "day" is the calendar day in India (IST), resetting at midnight. Answers count from tests
(ExamQuestionResponse.answered_at, set the first time a question is answered) and from the practice
page (PracticeAnswer rows). Re-answering or changing an answer to a question already counted is free.
Premium students and staff are never limited.
"""
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict

from fastapi import HTTPException, status
from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.user import SubscriptionTier, User, UserRole

FREE_DAILY_QUESTION_LIMIT = 20
IST = timezone(timedelta(hours=5, minutes=30))

DAILY_LIMIT_CODE = "FREE_DAILY_LIMIT_REACHED"
ANALYSIS_LOCKED_CODE = "FREE_PLAN_ANALYSIS_LOCKED"


def ist_day_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Start of today and start of tomorrow in IST, as UTC-aware datetimes."""
    now_ist = (now or datetime.now(timezone.utc)).astimezone(IST)
    start = datetime.combine(now_ist.date(), time.min, tzinfo=IST)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


async def is_limited(session: AsyncSession, user: User) -> bool:
    """True for students on the free plan; Premium students and staff have no limits."""
    if user.role != UserRole.STUDENT:
        return False
    from app.services.user_service import get_subscription_tier

    return await get_subscription_tier(session, user.id) != SubscriptionTier.PREMIUM.value


async def answered_today(session: AsyncSession, user_id: int) -> int:
    """Questions answered today (IST) in tests and on the practice page."""
    from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer

    start, end = ist_day_bounds()
    in_tests = (await session.exec(
        select(func.count(ExamQuestionResponse.id))
        .join(ExamAttempt, col(ExamQuestionResponse.attempt_id) == col(ExamAttempt.id))
        .where(
            ExamAttempt.user_id == user_id,
            col(ExamQuestionResponse.answered_at) >= start,
            col(ExamQuestionResponse.answered_at) < end,
        )
    )).one()
    in_practice = (await session.exec(
        select(func.count(PracticeAnswer.id)).where(
            PracticeAnswer.user_id == user_id,
            col(PracticeAnswer.answered_at) >= start,
            col(PracticeAnswer.answered_at) < end,
        )
    )).one()
    return int(in_tests or 0) + int(in_practice or 0)


async def daily_usage(session: AsyncSession, user: User) -> Dict[str, Any]:
    """{limited, limit, used, remaining, resets_at}; limit/remaining are None when there is no limit."""
    _, resets_at = ist_day_bounds()
    if not await is_limited(session, user):
        return {"limited": False, "limit": None, "used": None, "remaining": None, "resets_at": resets_at.isoformat()}
    used = await answered_today(session, user.id)
    return {
        "limited": True,
        "limit": FREE_DAILY_QUESTION_LIMIT,
        "used": used,
        "remaining": max(0, FREE_DAILY_QUESTION_LIMIT - used),
        "resets_at": resets_at.isoformat(),
    }


async def remaining_today(session: AsyncSession, user: User) -> int | None:
    """Answers the user may still give today; None when unlimited."""
    if not await is_limited(session, user):
        return None
    return max(0, FREE_DAILY_QUESTION_LIMIT - await answered_today(session, user.id))


def daily_limit_error() -> HTTPException:
    _, resets_at = ist_day_bounds()
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": DAILY_LIMIT_CODE,
            "message": f"The free plan includes {FREE_DAILY_QUESTION_LIMIT} questions a day. "
                       "Upgrade to Pro for unlimited practice, or continue tomorrow.",
            "limit": FREE_DAILY_QUESTION_LIMIT,
            "resets_at": resets_at.isoformat(),
        },
    )


def analysis_locked_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": ANALYSIS_LOCKED_CODE,
            "message": "Detailed analysis is part of Pro. Your score, answers and explanations stay free.",
        },
    )
