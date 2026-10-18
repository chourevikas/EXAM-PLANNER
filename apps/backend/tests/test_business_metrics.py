"""Super admin revenue and engagement figures."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile, SubscriptionTier
from app.db.models.hierarchy import Exam
from app.db.models.question import Question
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer
from app.db.models.subscription import SubscriptionPlan, UserSubscription, BillingInterval, SubscriptionStatus
from app.db.models.enums import AttemptStatus, QuestionStatus, QuestionSourceType
from app.core.security import create_access_token, get_password_hash
from app.services import business_metrics_service as metrics

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
_state: dict = {}
NOW = datetime(2026, 10, 18, 9, 0, tzinfo=timezone.utc)  # 14:30 IST


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _add(session, obj):
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def _seed(session: AsyncSession):
    users = {}
    for name, role, joined in (
        ("monthly", UserRole.STUDENT, NOW - timedelta(days=40)),
        ("yearly", UserRole.STUDENT, NOW - timedelta(days=3)),
        ("granted", UserRole.STUDENT, NOW - timedelta(days=60)),
        ("free", UserRole.STUDENT, NOW - timedelta(days=1)),
        ("admin", UserRole.ADMIN, NOW - timedelta(days=100)),
        ("super", UserRole.SUPER_ADMIN, NOW - timedelta(days=100)),
    ):
        u = await _add(session, User(full_name=name.title(), email=f"{name}@biz.test", role=role,
                                     password_hash=get_password_hash("x"), created_at=joined))
        users[name] = u.id
        if role == UserRole.STUDENT:
            tier = SubscriptionTier.FREE if name == "free" else SubscriptionTier.PREMIUM
            session.add(StudentProfile(user_id=u.id, subscription_tier=tier))
    await session.commit()

    monthly = await _add(session, SubscriptionPlan(plan_code="PRO_M", name="Pro Monthly", price_cents=149900,
                                                   billing_interval=BillingInterval.MONTHLY))
    yearly = await _add(session, SubscriptionPlan(plan_code="PRO_Y", name="Pro Yearly", price_cents=999900,
                                                  billing_interval=BillingInterval.YEARLY))
    session.add_all([
        # Paid ₹999 with a discount (₹1,499 list), 10 days ago, still active
        UserSubscription(user_id=users["monthly"], plan_id=monthly.id, source="PAYMENT", status=SubscriptionStatus.ACTIVE,
                         current_period_start=NOW - timedelta(days=10), current_period_end=NOW + timedelta(days=20),
                         original_price=Decimal(149900), discounted_price=Decimal(99900)),
        # Paid ₹9,999 for a year, 2 days ago
        UserSubscription(user_id=users["yearly"], plan_id=yearly.id, source="PAYMENT", status=SubscriptionStatus.ACTIVE,
                         current_period_start=NOW - timedelta(days=2), current_period_end=NOW + timedelta(days=363),
                         original_price=Decimal(999900)),
        # An earlier month of the monthly student, expired 12 days ago (previous revenue, and ended in range)
        UserSubscription(user_id=users["monthly"], plan_id=monthly.id, source="PAYMENT", status=SubscriptionStatus.EXPIRED,
                         current_period_start=NOW - timedelta(days=42), current_period_end=NOW - timedelta(days=12),
                         original_price=Decimal(149900)),
        # Pro granted by an admin: no revenue
        UserSubscription(user_id=users["granted"], plan_id=monthly.id, source="ADMIN_GRANT", status=SubscriptionStatus.ACTIVE,
                         current_period_start=NOW - timedelta(days=5), current_period_end=NOW + timedelta(days=25),
                         original_price=Decimal(149900), discounted_price=Decimal(0)),
    ])
    await session.commit()

    exam = await _add(session, Exam(code="BIZ-1", name="UPSC 2024", source_year=2024, exam_type=QuestionSourceType.PYQ, is_active=True))
    dyn = await _add(session, Exam(code="DYN_1_1_x", name="Subject-wise", is_active=True))
    q = await _add(session, Question(exam_id=exam.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED))
    q2 = await _add(session, Question(exam_id=exam.id, question_number_in_paper=2, status=QuestionStatus.PUBLISHED))
    # Today: "monthly" finishes a Hindi test with 2 answers; "yearly" a subject-wise test 3 days ago
    t1 = await _add(session, ExamAttempt(user_id=users["monthly"], exam_id=exam.id, status=AttemptStatus.EVALUATED,
                                         language="hi", started_at=NOW - timedelta(hours=1), submitted_at=NOW - timedelta(minutes=10)))
    t2 = await _add(session, ExamAttempt(user_id=users["yearly"], exam_id=dyn.id, status=AttemptStatus.EVALUATED,
                                         started_at=NOW - timedelta(days=3, hours=1), submitted_at=NOW - timedelta(days=3)))
    session.add_all([
        ExamQuestionResponse(attempt_id=t1.id, question_id=q.id, answered_at=NOW - timedelta(minutes=30)),
        ExamQuestionResponse(attempt_id=t1.id, question_id=q2.id, answered_at=NOW - timedelta(minutes=20)),
        ExamQuestionResponse(attempt_id=t2.id, question_id=q.id, answered_at=NOW - timedelta(days=3, minutes=30)),
    ])
    # Yesterday the free student used all 20 free questions in practice
    for i in range(20):
        session.add(PracticeAnswer(user_id=users["free"], question_id=q.id, is_correct=i % 2 == 0,
                                   answered_at=NOW - timedelta(days=1, minutes=i)))
    # Staff activity never counts
    t3 = await _add(session, ExamAttempt(user_id=users["admin"], exam_id=exam.id, status=AttemptStatus.EVALUATED,
                                         started_at=NOW - timedelta(hours=2), submitted_at=NOW - timedelta(hours=1)))
    session.add(ExamQuestionResponse(attempt_id=t3.id, question_id=q.id, answered_at=NOW - timedelta(hours=1)))
    await session.commit()
    _state.update(users=users)


def _h(who: str, role: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['users'][who], role=role)}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


@pytest.mark.anyio
async def test_only_super_admins_see_it(client):
    url = "/api/v1/admin/business-metrics"
    assert (await client.get(url, headers=_h("admin", "ADMIN"))).status_code == 403
    assert (await client.get(url, headers=_h("free", "STUDENT"))).status_code == 403
    assert (await client.get(url, params={"range": "2y"}, headers=_h("super", "SUPER_ADMIN"))).status_code == 422
    res = await client.get(url, params={"range": "7d"}, headers=_h("super", "SUPER_ADMIN"))
    assert res.status_code == 200, res.text
    assert {"revenue", "engagement"} <= res.json().keys()


@pytest.mark.anyio
async def test_revenue(client):
    async with AsyncSession(test_engine) as s:
        r = await metrics.revenue(s, 30, NOW)
    assert r["revenue"] == 999.0 + 9999.0  # paid in the last 30 days, after discounts
    assert r["previous_revenue"] == 1499.0
    assert r["new_paid_subscriptions"] == 2 and r["paying_students"] == 2
    assert r["average_revenue_per_paying_student"] == 5499.0
    assert r["discounts_given"] == 500.0
    assert r["mrr"] == round(999.0 + 9999.0 / 12, 2)  # yearly counts a twelfth per month
    assert r["active_subscriptions_by_source"] == {"PAYMENT": 2, "ADMIN_GRANT": 1, "PROMO": 0}
    assert r["pro_students"] == 3 and r["ended_subscriptions"] == 1
    assert r["paid_conversion_percent"] == 50.0  # 2 of 4 students pay
    assert [p["plan"] for p in r["by_plan"]] == ["Pro Yearly", "Pro Monthly"]
    assert r["monthly"][-1] == {"month": "2026-10", "revenue": 999.0 + 9999.0}
    assert len(r["monthly"]) == 12


@pytest.mark.anyio
async def test_engagement(client):
    async with AsyncSession(test_engine) as s:
        e = await metrics.engagement(s, 7, NOW)
    assert e["total_students"] == 4
    assert e["new_students"] == 2  # yearly (3 days ago) and free (yesterday); staff never count
    assert (e["active_today"], e["active_7d"], e["active_30d"]) == (1, 3, 3)
    assert e["questions_answered"] == 2 + 1 + 20  # admin's answer excluded
    assert e["tests_completed"] == 2 and e["subject_wise_tests"] == 1
    assert e["free_students_hit_limit"] == 1
    assert e["test_languages"] == {"en": 1, "hi": 1, "mr": 0}
    assert e["top_exams"] == [{"exam": "UPSC 2024", "tests": 1}]
    assert len(e["daily"]) == 7 and e["daily"][-1]["date"] == "2026-10-18"
    assert e["daily"][-1]["active_students"] == 1 and e["daily"][-2]["questions"] == 20
