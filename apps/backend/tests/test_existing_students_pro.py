"""Launch offer (existing students get Pro for 3 months) and subscriptions ending on time."""
import importlib.util
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.user import User, UserRole, StudentProfile, SubscriptionTier
from app.db.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus, BillingInterval
from app.db.models.notification import UserNotification
from app.services.subscription_expiry_service import expire_due

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=timezone.utc)


def _load_migration():
    path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "068_existing_students_pro.py"
    spec = importlib.util.spec_from_file_location("m068", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _seed_people(s: Session) -> dict:
    ids = {}
    for name, role in (("old", UserRole.STUDENT), ("paying", UserRole.STUDENT), ("noprofile", UserRole.STUDENT), ("admin", UserRole.ADMIN)):
        u = User(full_name=name, email=f"{name}@promo.test", role=role)
        s.add(u)
        s.commit()
        s.refresh(u)
        ids[name] = u.id
    s.add(StudentProfile(user_id=ids["old"], subscription_tier=SubscriptionTier.FREE))
    s.add(StudentProfile(user_id=ids["paying"], subscription_tier=SubscriptionTier.PREMIUM))
    free = SubscriptionPlan(plan_code="FREE", name="Free", price_cents=0, billing_interval=BillingInterval.LIFETIME)
    pro = SubscriptionPlan(plan_code="PRO", name="Pro", price_cents=149900, billing_interval=BillingInterval.MONTHLY)
    s.add_all([free, pro])
    s.commit()
    s.refresh(pro)
    s.add(UserSubscription(user_id=ids["paying"], plan_id=pro.id, status=SubscriptionStatus.ACTIVE, source="PAYMENT",
                           current_period_start=datetime.now(timezone.utc) - timedelta(days=3),
                           current_period_end=datetime.now(timezone.utc) + timedelta(days=27)))
    s.commit()
    ids["pro_plan"] = pro.id
    return ids


def test_migration_gives_existing_students_three_months_of_pro():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        ids = _seed_people(s)
    migration = _load_migration()
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()

    with Session(engine) as s:
        subs = {sub.user_id: sub for sub in s.exec(select(UserSubscription).where(UserSubscription.source == "PROMO")).all()}
        assert set(subs) == {ids["old"], ids["noprofile"]}  # the paying student keeps their own; staff get nothing
        promo = subs[ids["old"]]
        days = (promo.current_period_end - promo.current_period_start).days
        assert (promo.status, promo.plan_id, days, int(promo.discounted_price)) == (SubscriptionStatus.ACTIVE, ids["pro_plan"], 90, 0)
        tiers = {p.user_id: p.subscription_tier for p in s.exec(select(StudentProfile)).all()}
        assert tiers == {ids["old"]: SubscriptionTier.PREMIUM, ids["paying"]: SubscriptionTier.PREMIUM,
                         ids["noprofile"]: SubscriptionTier.PREMIUM}

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.downgrade()
    with Session(engine) as s:
        assert not s.exec(select(UserSubscription).where(UserSubscription.source == "PROMO")).all()
        assert s.exec(select(StudentProfile).where(StudentProfile.user_id == ids["old"])).one().subscription_tier == SubscriptionTier.FREE


def test_migration_without_a_pro_plan_does_nothing():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        s.add(User(full_name="x", email="x@promo.test", role=UserRole.STUDENT))
        s.commit()
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            _load_migration().upgrade()
        assert conn.execute(text("SELECT COUNT(*) FROM user_subscriptions")).scalar() == 0


@pytest.mark.anyio
async def test_ended_subscriptions_move_students_back_to_free():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(engine, expire_on_commit=False) as s:
        plan = SubscriptionPlan(plan_code="PRO", name="Pro", price_cents=149900, billing_interval=BillingInterval.MONTHLY)
        s.add(plan)
        users = {}
        for name, role in (("ended", UserRole.STUDENT), ("renewed", UserRole.STUDENT), ("current", UserRole.STUDENT), ("staff", UserRole.ADMIN)):
            u = User(full_name=name, email=f"{name}@exp.test", role=role)
            s.add(u)
            await s.commit()
            await s.refresh(u)
            users[name] = u.id
            if role == UserRole.STUDENT:
                s.add(StudentProfile(user_id=u.id, subscription_tier=SubscriptionTier.PREMIUM))
        await s.commit()
        await s.refresh(plan)

        def sub(user, start_days, end_days, source="PROMO"):
            return UserSubscription(user_id=users[user], plan_id=plan.id, status=SubscriptionStatus.ACTIVE, source=source,
                                    current_period_start=NOW + timedelta(days=start_days), current_period_end=NOW + timedelta(days=end_days),
                                    original_price=Decimal(149900), discounted_price=Decimal(0))
        s.add_all([
            sub("ended", -90, -1),                       # promo over yesterday
            sub("renewed", -90, -1), sub("renewed", -1, 29, "PAYMENT"),  # promo over, but they paid
            sub("current", -10, 80),                     # still running
            sub("staff", -90, -1),
        ])
        await s.commit()

        assert await expire_due(s, NOW) == 1
        statuses = {(x.user_id, x.source): x.status for x in (await s.exec(select(UserSubscription))).all()}
        assert statuses[(users["ended"], "PROMO")] == SubscriptionStatus.EXPIRED
        assert statuses[(users["renewed"], "PAYMENT")] == SubscriptionStatus.ACTIVE
        assert statuses[(users["current"], "PROMO")] == SubscriptionStatus.ACTIVE
        tiers = {p.user_id: p.subscription_tier for p in (await s.exec(select(StudentProfile))).all()}
        assert tiers[users["ended"]] == SubscriptionTier.FREE
        assert tiers[users["renewed"]] == SubscriptionTier.PREMIUM and tiers[users["current"]] == SubscriptionTier.PREMIUM
        notes = (await s.exec(select(UserNotification))).all()
        assert [(n.user_id, n.title) for n in notes] == [(users["ended"], "Your Pro access has ended")]

        assert await expire_due(s, NOW) == 0  # nothing left to do
