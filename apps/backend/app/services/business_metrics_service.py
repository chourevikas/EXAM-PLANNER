"""Revenue and engagement figures for the super admin (Admin → Revenue & Engagement).

Revenue counts paid subscriptions (source PAYMENT): the price paid is the discounted price when a
discount applied, else the original price. Both are stored in paise (minor units), as the payment
and grant flows write them. Admin grants and promos give Pro without revenue and are counted
separately. Refunds live on payment orders (online payments branch) and are not netted here yet.

Engagement counts students only. A student is "active" on a day (IST) when they answered a question
in a test or in practice, or completed a test.
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer
from app.db.models.enums import AttemptStatus
from app.db.models.gamification import UserBadge
from app.db.models.hierarchy import Exam
from app.db.models.subscription import BillingInterval, SubscriptionPlan, SubscriptionStatus, UserSubscription
from app.db.models.user import StudentProfile, SubscriptionTier, User, UserRole
from app.services.free_plan import FREE_DAILY_QUESTION_LIMIT, IST

RANGES = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}
_DONE = [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]


def range_days(value: Optional[str]) -> int:
    return RANGES.get((value or "30d").lower(), 30)


def _ist_today(now: datetime) -> date:
    return now.astimezone(IST).date()


def _ist_start(day: date) -> datetime:
    """Midnight IST at the start of `day`, as a UTC-aware datetime."""
    return datetime(day.year, day.month, day.day, tzinfo=IST).astimezone(timezone.utc)


def _ist_day_expr(session: AsyncSession, column):
    """SQL for the IST calendar day of a timestamp (Postgres and SQLite)."""
    if session.bind.dialect.name == "postgresql":
        return func.date(func.timezone("Asia/Kolkata", column))
    return func.date(column, "+330 minutes")


def _as_date(value: Any) -> date:
    return value if isinstance(value, date) else date.fromisoformat(str(value)[:10])


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _paid_minor(sub: UserSubscription, plan: Optional[SubscriptionPlan]) -> int:
    """What the student paid for this subscription, in paise."""
    if sub.discounted_price is not None:
        return int(Decimal(sub.discounted_price))
    if sub.original_price is not None:
        return int(Decimal(sub.original_price))
    return int(plan.price_cents) if plan else 0


def _monthly_minor(amount: int, plan: Optional[SubscriptionPlan]) -> float:
    """The monthly value of a payment (yearly / 12); lifetime plans don't recur, so 0."""
    interval = plan.billing_interval if plan else BillingInterval.MONTHLY
    if interval == BillingInterval.YEARLY:
        return amount / 12.0
    if interval == BillingInterval.LIFETIME:
        return 0.0
    return float(amount)


def _rupees(minor: float) -> float:
    return round(minor / 100.0, 2)


def _month_key(dt: datetime) -> str:
    return dt.astimezone(IST).strftime("%Y-%m")


def _last_months(today: date, n: int) -> List[str]:
    keys: List[str] = []
    y, m = today.year, today.month
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


async def _student_ids(session: AsyncSession) -> Set[int]:
    return set((await session.exec(select(User.id).where(User.role == UserRole.STUDENT))).all())


async def revenue(session: AsyncSession, days: int, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    today = _ist_today(now)
    since = _ist_start(today - timedelta(days=days - 1))
    prev_since = _ist_start(today - timedelta(days=2 * days - 1))

    plans = {p.id: p for p in (await session.exec(select(SubscriptionPlan))).all()}
    subs = list((await session.exec(select(UserSubscription))).all())
    students = await _student_ids(session)
    subs = [s for s in subs if s.user_id in students]

    def is_active(s: UserSubscription) -> bool:
        end = _aware(s.current_period_end)
        return s.status == SubscriptionStatus.ACTIVE and (end is None or end > now)

    active = [s for s in subs if is_active(s)]
    active_by_source: Dict[str, int] = {}
    for s in active:
        source = str(s.source or "PAYMENT").upper()
        active_by_source[source] = active_by_source.get(source, 0) + 1

    paid = [s for s in subs if str(s.source or "").upper() == "PAYMENT"]
    mrr_minor = sum(_monthly_minor(_paid_minor(s, plans.get(s.plan_id)), plans.get(s.plan_id)) for s in paid if is_active(s))

    def started(s: UserSubscription) -> datetime:
        return _aware(s.current_period_start) or _aware(s.created_at) or now

    in_range = [s for s in paid if started(s) >= since]
    prev_range = [s for s in paid if prev_since <= started(s) < since]
    revenue_minor = sum(_paid_minor(s, plans.get(s.plan_id)) for s in in_range)
    prev_revenue_minor = sum(_paid_minor(s, plans.get(s.plan_id)) for s in prev_range)
    discount_minor = sum(
        max(0, int(Decimal(s.original_price)) - int(Decimal(s.discounted_price)))
        for s in in_range if s.original_price is not None and s.discounted_price is not None
    )
    paying_students = {s.user_id for s in in_range}

    # Subscriptions that ended in the period (expired or cancelled), any source
    ended = [
        s for s in subs
        if s.status in (SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED)
        and _aware(s.current_period_end) is not None and since <= _aware(s.current_period_end) <= now
    ]

    pro_students = (await session.exec(
        select(func.count(StudentProfile.user_id))
        .join(User, col(User.id) == col(StudentProfile.user_id))
        .where(User.role == UserRole.STUDENT, StudentProfile.subscription_tier == SubscriptionTier.PREMIUM)
    )).one()

    months = _last_months(today, 12)
    by_month = {k: 0 for k in months}
    for s in paid:
        key = _month_key(started(s))
        if key in by_month:
            by_month[key] += _paid_minor(s, plans.get(s.plan_id))

    by_plan: Dict[int, Dict[str, Any]] = {}
    for s in in_range:
        plan = plans.get(s.plan_id)
        row = by_plan.setdefault(s.plan_id, {"plan": plan.name if plan else f"Plan {s.plan_id}", "subscriptions": 0, "revenue": 0.0})
        row["subscriptions"] += 1
        row["revenue"] += _rupees(_paid_minor(s, plan))

    total_students = len(students)
    paid_active_students = len({s.user_id for s in paid if is_active(s)})
    return {
        "currency": "INR",
        "range_days": days,
        "revenue": _rupees(revenue_minor),
        "previous_revenue": _rupees(prev_revenue_minor),
        "mrr": _rupees(mrr_minor),
        "new_paid_subscriptions": len(in_range),
        "paying_students": len(paying_students),
        "average_revenue_per_paying_student": _rupees(revenue_minor / len(paying_students)) if paying_students else 0.0,
        "discounts_given": _rupees(discount_minor),
        "ended_subscriptions": len(ended),
        "pro_students": int(pro_students or 0),
        "active_subscriptions_by_source": {
            "PAYMENT": active_by_source.get("PAYMENT", 0),
            "ADMIN_GRANT": active_by_source.get("ADMIN_GRANT", 0),
            "PROMO": active_by_source.get("PROMO", 0),
        },
        "paid_conversion_percent": round(paid_active_students * 100.0 / total_students, 1) if total_students else 0.0,
        "monthly": [{"month": k, "revenue": _rupees(v)} for k, v in by_month.items()],
        "by_plan": sorted(by_plan.values(), key=lambda r: -r["revenue"]),
    }


async def _active_pairs(session: AsyncSession, since: datetime, students: Set[int]) -> Set[Tuple[int, date]]:
    """(student, IST day) for every day a student answered a question or completed a test."""
    pairs: Set[Tuple[int, date]] = set()
    t_day = _ist_day_expr(session, ExamQuestionResponse.answered_at)
    rows = (await session.exec(
        select(ExamAttempt.user_id, t_day)
        .join(ExamAttempt, col(ExamAttempt.id) == col(ExamQuestionResponse.attempt_id))
        .where(col(ExamQuestionResponse.answered_at) >= since)
        .distinct()
    )).all()
    p_day = _ist_day_expr(session, PracticeAnswer.answered_at)
    rows += (await session.exec(
        select(PracticeAnswer.user_id, p_day).where(col(PracticeAnswer.answered_at) >= since).distinct()
    )).all()
    a_day = _ist_day_expr(session, ExamAttempt.submitted_at)
    rows += (await session.exec(
        select(ExamAttempt.user_id, a_day)
        .where(col(ExamAttempt.status).in_(_DONE), col(ExamAttempt.submitted_at) >= since)
        .distinct()
    )).all()
    for user_id, day in rows:
        if user_id in students and day is not None:
            pairs.add((user_id, _as_date(day)))
    return pairs


def _actives(pairs: Iterable[Tuple[int, date]], first: date, last: date) -> Set[int]:
    return {u for u, d in pairs if first <= d <= last}


async def engagement(session: AsyncSession, days: int, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    today = _ist_today(now)
    first_day = today - timedelta(days=days - 1)
    since = _ist_start(first_day)
    # Look back far enough for 30-day actives and the previous period
    lookback = _ist_start(today - timedelta(days=max(2 * days, 30) - 1))
    students = await _student_ids(session)

    pairs = await _active_pairs(session, lookback, students)
    dau = _actives(pairs, today, today)
    wau = _actives(pairs, today - timedelta(days=6), today)
    mau = _actives(pairs, today - timedelta(days=29), today)
    period_actives = _actives(pairs, first_day, today)
    previous_actives = _actives(pairs, first_day - timedelta(days=days), first_day - timedelta(days=1))
    returning = period_actives & previous_actives

    daily_active: Dict[date, int] = {first_day + timedelta(days=i): 0 for i in range(days)}
    for _, d in pairs:
        if d in daily_active:
            daily_active[d] += 1

    signup_day = _ist_day_expr(session, User.created_at)
    signups_by_day: Dict[date, int] = {d: 0 for d in daily_active}
    for day, n in (await session.exec(
        select(signup_day, func.count(User.id))
        .where(User.role == UserRole.STUDENT, col(User.created_at) >= since)
        .group_by(signup_day)
    )).all():
        d = _as_date(day)
        if d in signups_by_day:
            signups_by_day[d] = int(n)

    # Questions answered per day (tests + practice) and tests completed per day
    t_day = _ist_day_expr(session, ExamQuestionResponse.answered_at)
    p_day = _ist_day_expr(session, PracticeAnswer.answered_at)
    a_day = _ist_day_expr(session, ExamAttempt.submitted_at)
    questions_by_day: Dict[date, int] = {d: 0 for d in daily_active}
    for day, n in (await session.exec(
        select(t_day, func.count(ExamQuestionResponse.id))
        .join(ExamAttempt, col(ExamAttempt.id) == col(ExamQuestionResponse.attempt_id))
        .where(col(ExamQuestionResponse.answered_at) >= since, col(ExamAttempt.user_id).in_(students or {-1}))
        .group_by(t_day)
    )).all() + (await session.exec(
        select(p_day, func.count(PracticeAnswer.id))
        .where(col(PracticeAnswer.answered_at) >= since, col(PracticeAnswer.user_id).in_(students or {-1}))
        .group_by(p_day)
    )).all():
        d = _as_date(day)
        if d in questions_by_day:
            questions_by_day[d] += int(n)
    tests_by_day: Dict[date, int] = {d: 0 for d in daily_active}
    for day, n in (await session.exec(
        select(a_day, func.count(ExamAttempt.id))
        .where(col(ExamAttempt.status).in_(_DONE), col(ExamAttempt.submitted_at) >= since,
               col(ExamAttempt.user_id).in_(students or {-1}))
        .group_by(a_day)
    )).all():
        d = _as_date(day)
        if d in tests_by_day:
            tests_by_day[d] += int(n)

    # Languages chosen for tests started in the period
    languages = {lang or "en": int(n) for lang, n in (await session.exec(
        select(ExamAttempt.language, func.count(ExamAttempt.id))
        .where(col(ExamAttempt.started_at) >= since, col(ExamAttempt.user_id).in_(students or {-1}))
        .group_by(ExamAttempt.language)
    )).all()}

    # Free students who used all of a day's questions (a sign they may upgrade)
    free_ids = set((await session.exec(
        select(StudentProfile.user_id).where(StudentProfile.subscription_tier != SubscriptionTier.PREMIUM)
    )).all()) & students
    per_day_answers: Dict[Tuple[int, date], int] = {}
    for user_id, day, n in (await session.exec(
        select(ExamAttempt.user_id, t_day, func.count(ExamQuestionResponse.id))
        .join(ExamAttempt, col(ExamAttempt.id) == col(ExamQuestionResponse.attempt_id))
        .where(col(ExamQuestionResponse.answered_at) >= since)
        .group_by(ExamAttempt.user_id, t_day)
    )).all() + (await session.exec(
        select(PracticeAnswer.user_id, p_day, func.count(PracticeAnswer.id))
        .where(col(PracticeAnswer.answered_at) >= since)
        .group_by(PracticeAnswer.user_id, p_day)
    )).all():
        if user_id in free_ids:
            key = (user_id, _as_date(day))
            per_day_answers[key] = per_day_answers.get(key, 0) + int(n)
    hit_limit_students = {u for (u, _), n in per_day_answers.items() if n >= FREE_DAILY_QUESTION_LIMIT}

    top_exams = [
        {"exam": name or code, "tests": int(n)}
        for name, code, n in (await session.exec(
            select(Exam.name, Exam.code, func.count(ExamAttempt.id))
            .join(Exam, col(Exam.id) == col(ExamAttempt.exam_id))
            .where(col(ExamAttempt.status).in_(_DONE), col(ExamAttempt.submitted_at) >= since,
                   col(ExamAttempt.user_id).in_(students or {-1}), ~col(Exam.code).like("DYN_%"))
            .group_by(Exam.name, Exam.code)
            .order_by(func.count(ExamAttempt.id).desc())
            .limit(5)
        )).all()
    ]
    subject_wise = (await session.exec(
        select(func.count(ExamAttempt.id))
        .join(Exam, col(Exam.id) == col(ExamAttempt.exam_id))
        .where(col(ExamAttempt.status).in_(_DONE), col(ExamAttempt.submitted_at) >= since,
               col(ExamAttempt.user_id).in_(students or {-1}), col(Exam.code).like("DYN_%"))
    )).one()

    milestones = (await session.exec(
        select(func.count(UserBadge.id)).where(col(UserBadge.unlocked_at) >= since, col(UserBadge.user_id).in_(students or {-1}))
    )).one()
    weekly_email = (await session.exec(
        select(func.count(StudentProfile.user_id)).where(col(StudentProfile.weekly_email_enabled).is_(True))
    )).one()

    total_questions = sum(questions_by_day.values())
    return {
        "range_days": days,
        "total_students": len(students),
        "new_students": sum(signups_by_day.values()),
        "active_today": len(dau),
        "active_7d": len(wau),
        "active_30d": len(mau),
        "active_in_range": len(period_actives),
        "stickiness_percent": round(len(dau) * 100.0 / len(mau), 1) if mau else 0.0,
        "returning_percent": round(len(returning) * 100.0 / len(previous_actives), 1) if previous_actives else None,
        "questions_answered": total_questions,
        "tests_completed": sum(tests_by_day.values()),
        "subject_wise_tests": int(subject_wise or 0),
        "questions_per_active_student": round(total_questions / len(period_actives), 1) if period_actives else 0.0,
        "free_students_hit_limit": len(hit_limit_students),
        "milestones_unlocked": int(milestones or 0),
        "weekly_email_subscribers": int(weekly_email or 0),
        "test_languages": {code: languages.get(code, 0) for code in ("en", "hi", "mr")},
        "top_exams": top_exams,
        "daily": [
            {
                "date": d.isoformat(),
                "active_students": daily_active[d],
                "new_students": signups_by_day[d],
                "questions": questions_by_day[d],
                "tests": tests_by_day[d],
            }
            for d in sorted(daily_active)
        ],
    }
