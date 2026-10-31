"""064_milestones_and_weekly_email

Revision ID: 064_milestones_and_weekly_email
Revises: 063_leaderboards_and_xp_ledger
Create Date: 2026-10-17 00:00:00.000000

Milestones are admin-managed badges with a criterion and threshold, and a weekly summary email the
student schedules.
- badges: criteria_type, threshold, xp_reward (default 100), is_active.
- Seeds the client's milestones (active): 500 questions solved, 30-day streak; and suggested ones
  (inactive, for admins to switch on): first test, 100 and 1,000 questions, 7-day streak.
- student_profiles: weekly_email_enabled (off by default), weekly_email_day (0 = Monday),
  weekly_email_hour (local time), weekly_email_last_sent_at.
"""
from datetime import datetime, timezone
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '064_milestones_and_weekly_email'
down_revision: Union[str, None] = '063_leaderboards_and_xp_ledger'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = [
    # name, description, criteria_type, threshold, active
    ("500 Questions", "Solved 500 questions.", "QUESTIONS_SOLVED", 500, True),
    ("30-Day Streak", "Studied 30 days in a row.", "STREAK_DAYS", 30, True),
    ("First Test", "Completed your first test.", "TESTS_COMPLETED", 1, False),
    ("100 Questions", "Solved 100 questions.", "QUESTIONS_SOLVED", 100, False),
    ("1,000 Questions", "Solved 1,000 questions.", "QUESTIONS_SOLVED", 1000, False),
    ("7-Day Streak", "Studied 7 days in a row.", "STREAK_DAYS", 7, False),
]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())

    badge_cols = {c['name'] for c in insp.get_columns('badges')}
    if 'criteria_type' not in badge_cols:
        op.add_column('badges', sa.Column('criteria_type', sa.String(30), nullable=True))
    if 'threshold' not in badge_cols:
        op.add_column('badges', sa.Column('threshold', sa.Integer(), nullable=True))
    if 'xp_reward' not in badge_cols:
        op.add_column('badges', sa.Column('xp_reward', sa.Integer(), nullable=False, server_default='100'))
    if 'is_active' not in badge_cols:
        op.add_column('badges', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))

    prof_cols = {c['name'] for c in insp.get_columns('student_profiles')}
    if 'weekly_email_enabled' not in prof_cols:
        op.add_column('student_profiles', sa.Column('weekly_email_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    if 'weekly_email_day' not in prof_cols:
        op.add_column('student_profiles', sa.Column('weekly_email_day', sa.Integer(), nullable=False, server_default='6'))
    if 'weekly_email_hour' not in prof_cols:
        op.add_column('student_profiles', sa.Column('weekly_email_hour', sa.Integer(), nullable=False, server_default='18'))
    if 'weekly_email_last_sent_at' not in prof_cols:
        op.add_column('student_profiles', sa.Column('weekly_email_last_sent_at', sa.DateTime(timezone=True), nullable=True))

    badges = sa.table(
        'badges',
        sa.column('name', sa.String), sa.column('description', sa.String), sa.column('criteria_type', sa.String),
        sa.column('threshold', sa.Integer), sa.column('xp_reward', sa.Integer), sa.column('is_active', sa.Boolean),
        sa.column('created_at', sa.DateTime(timezone=True)),
    )
    existing = {r[0] for r in op.get_bind().execute(sa.text("SELECT name FROM badges WHERE criteria_type IS NOT NULL"))}
    rows = [
        {"name": n, "description": d, "criteria_type": c, "threshold": t, "xp_reward": 100, "is_active": a,
         "created_at": datetime.now(timezone.utc)}
        for n, d, c, t, a in SEED if n not in existing
    ]
    if rows:
        op.bulk_insert(badges, rows)


def downgrade() -> None:
    op.execute("DELETE FROM badges WHERE criteria_type IS NOT NULL")
    for col in ('weekly_email_last_sent_at', 'weekly_email_hour', 'weekly_email_day', 'weekly_email_enabled'):
        op.drop_column('student_profiles', col)
    for col in ('is_active', 'xp_reward', 'threshold', 'criteria_type'):
        op.drop_column('badges', col)
