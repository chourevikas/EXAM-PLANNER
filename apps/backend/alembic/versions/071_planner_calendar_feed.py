"""071_planner_calendar_feed

Revision ID: 071_planner_calendar_feed
Revises: 070_study_planner_v2
Create Date: 2026-10-24 00:00:00.000000

A secret per student for their study-plan calendar subscription link (Google, Apple and Outlook subscribe to it
and pick up plan changes on their own).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '071_planner_calendar_feed'
down_revision: Union[str, None] = '070_study_planner_v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("planner_settings")}
    if "calendar_token" not in existing:
        op.add_column("planner_settings", sa.Column("calendar_token", sa.String(64), nullable=True))
        op.create_index("ix_planner_settings_calendar_token", "planner_settings", ["calendar_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_planner_settings_calendar_token", table_name="planner_settings")
    op.drop_column("planner_settings", "calendar_token")
