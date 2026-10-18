"""068_existing_students_pro

Revision ID: 068_existing_students_pro
Revises: 067_exam_marking_scheme
Create Date: 2026-10-18 00:00:00.000000

Launch offer (client, 18 Oct 2026): every student registered before this release gets Pro for three
months from the deploy. Each gets a PROMO subscription (price paid ₹0) on the Pro plan ending 90 days
from now, and their plan tier becomes PREMIUM. The daily expiry job moves them back to Free when it
ends. Students who already have an active subscription keep it unchanged. New students start Free.
"""
from datetime import datetime, timedelta, timezone
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '068_existing_students_pro'
down_revision: Union[str, None] = '067_exam_marking_scheme'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PROMO_DAYS = 90
REASON = "Launch offer: existing students get Pro for 3 months"


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=PROMO_DAYS)

    # The Pro plan: the most expensive active paid plan
    plan = bind.execute(sa.text(
        "SELECT id, price_cents FROM subscription_plans WHERE is_active = :t AND price_cents > 0 "
        "ORDER BY price_cents DESC LIMIT 1"
    ), {"t": True}).first()
    if plan is None:
        return  # no Pro plan configured: nothing to grant

    students = [r[0] for r in bind.execute(sa.text("SELECT id FROM users WHERE role = 'STUDENT'")).fetchall()]
    already = {r[0] for r in bind.execute(sa.text(
        "SELECT DISTINCT user_id FROM user_subscriptions WHERE status = 'ACTIVE' AND current_period_end > :now"
    ), {"now": now}).fetchall()}

    profiles = {r[0] for r in bind.execute(sa.text("SELECT user_id FROM student_profiles")).fetchall()}
    for user_id in students:
        if user_id in already:
            continue
        # Status is a Postgres enum: the 'ACTIVE' literal is cast by the database (a bound text parameter isn't)
        bind.execute(sa.text(
            "INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end, "
            "cancel_at_period_end, source, grant_reason, original_price, discounted_price, created_at, updated_at) "
            "VALUES (:u, :p, 'ACTIVE', :start, :end, :f, 'PROMO', :reason, :price, 0, :now, :now)"
        ), {"u": user_id, "p": plan[0], "start": now, "end": end, "f": False, "reason": REASON, "price": plan[1], "now": now})
        if user_id in profiles:
            bind.execute(sa.text("UPDATE student_profiles SET subscription_tier = 'PREMIUM' WHERE user_id = :u"), {"u": user_id})
        else:
            # Not onboarded yet: create the profile through the model so every column gets its default
            # (a fresh database has no students, so this never runs against an older schema)
            from sqlmodel import Session
            from app.db.models.user import StudentProfile, SubscriptionTier
            with Session(bind=bind) as s:
                s.add(StudentProfile(user_id=user_id, subscription_tier=SubscriptionTier.PREMIUM))
                s.flush()


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "UPDATE student_profiles SET subscription_tier = 'FREE' WHERE user_id IN "
        "(SELECT user_id FROM user_subscriptions WHERE source = 'PROMO' AND grant_reason = :r)"
    ), {"r": REASON})
    bind.execute(sa.text("DELETE FROM user_subscriptions WHERE source = 'PROMO' AND grant_reason = :r"), {"r": REASON})
