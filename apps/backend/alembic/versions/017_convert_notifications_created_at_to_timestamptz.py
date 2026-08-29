"""017_convert_notifications_created_at_to_timestamptz

Revision ID: 017_notifications_timestamptz
Revises: 016_blooms_taxonomy_mastery
Create Date: 2026-08-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '017_notifications_timestamptz'
down_revision = '016_blooms_taxonomy_mastery'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if "notifications" in existing_tables:
        columns = [c["name"] for c in inspector.get_columns("notifications")]
        if "created_at" in columns:
            with op.batch_alter_table("notifications") as batch_op:
                batch_op.alter_column(
                    "created_at",
                    type_=sa.DateTime(timezone=True),
                    postgresql_using="created_at AT TIME ZONE 'UTC'"
                )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if "notifications" in existing_tables:
        columns = [c["name"] for c in inspector.get_columns("notifications")]
        if "created_at" in columns:
            with op.batch_alter_table("notifications") as batch_op:
                batch_op.alter_column(
                    "created_at",
                    type_=sa.DateTime(timezone=False)
                )
