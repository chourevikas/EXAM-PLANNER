"""072_user_feedback

Revision ID: 072_user_feedback
Revises: 071_planner_calendar_feed
Create Date: 2026-10-24 00:00:00.000000

"Report a problem" from the student app: the reports, with an optional screenshot, and the admin.feedback
permission for the Feedback section of the admin panel.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '072_user_feedback'
down_revision: Union[str, None] = '071_planner_calendar_feed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TS = sa.DateTime(timezone=True)
NOW = sa.text("CURRENT_TIMESTAMP")

PERMISSIONS = [
    ('admin.feedback', 'Feedback', 'Read and close problem reports and suggestions sent from the app.'),
]


def upgrade() -> None:
    bind = op.get_bind()
    if "user_feedback" not in set(sa.inspect(bind).get_table_names()):
        op.create_table(
            "user_feedback",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("category", sa.String(20), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("page_url", sa.String(500), nullable=True),
            sa.Column("user_agent", sa.String(300), nullable=True),
            sa.Column("screenshot_path", sa.String(255), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
            sa.Column("admin_note", sa.Text(), nullable=True),
            sa.Column("resolved_by_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"),
                      nullable=True),
            sa.Column("resolved_at", TS, nullable=True),
            sa.Column("created_at", TS, nullable=False, server_default=NOW),
        )
        op.create_index("ix_user_feedback_status_created", "user_feedback", ["status", "created_at"])

    permissions = sa.table(
        'permissions',
        sa.column('key', sa.String),
        sa.column('label', sa.String),
        sa.column('description', sa.String),
        sa.column('created_at', sa.DateTime(timezone=True)),
    )
    existing = {row[0] for row in bind.execute(sa.select(permissions.c.key))}
    for key, label, description in PERMISSIONS:
        if key not in existing:
            bind.execute(
                permissions.insert().values(key=key, label=label, description=description, created_at=sa.func.now())
            )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM permissions WHERE key = 'admin.feedback'"))
    op.drop_index("ix_user_feedback_status_created", table_name="user_feedback")
    op.drop_table("user_feedback")
