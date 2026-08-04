"""Add student_profiles, admin_profiles, admin_approval_logs

Revision ID: 907a16534fd4
Revises: f92b507b351c
Create Date: 2026-07-31 20:52:57.598516

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "907a16534fd4"
down_revision: Union[str, Sequence[str], None] = "f92b507b351c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safely add REJECTED to userstatus enum if PostgreSQL dialect
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(
            sa.text("ALTER TYPE userstatus ADD VALUE IF NOT EXISTS 'REJECTED'")
        )

    op.create_table(
        "admin_approval_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("admin_user_id", sa.String(length=36), nullable=False),
        sa.Column("reviewed_by_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["admin_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "admin_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("organization_name", sa.String(length=255), nullable=True),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("approved_by_id", sa.String(length=36), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("rejected_by_id", sa.String(length=36), nullable=True),
        sa.Column("rejected_at", sa.DateTime(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["rejected_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "student_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column(
            "subscription_tier",
            postgresql.ENUM(
                "GUEST", "FREE", "PREMIUM", name="subscriptiontier", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("free_questions_attempted", sa.Integer(), nullable=True),
        sa.Column("current_streak", sa.Integer(), nullable=True),
        sa.Column("highest_streak", sa.Integer(), nullable=True),
        sa.Column("total_xp", sa.Integer(), nullable=True),
        sa.Column("level", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.drop_column("users", "level")
    op.drop_column("users", "highest_streak")
    op.drop_column("users", "total_xp")
    op.drop_column("users", "current_streak")
    op.drop_column("users", "subscription_tier")
    op.drop_column("users", "free_questions_attempted")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "free_questions_attempted", sa.INTEGER(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_tier",
            postgresql.ENUM("GUEST", "FREE", "PREMIUM", name="subscriptiontier"),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("current_streak", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "users", sa.Column("total_xp", sa.INTEGER(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("highest_streak", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "users", sa.Column("level", sa.INTEGER(), autoincrement=False, nullable=True)
    )
    op.drop_table("student_profiles")
    op.drop_table("admin_profiles")
    op.drop_table("admin_approval_logs")
