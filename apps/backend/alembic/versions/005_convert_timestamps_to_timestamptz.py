"""005_convert_timestamps_to_timestamptz

Revision ID: 005_convert_timestamptz
Revises: 004_create_remaining_tables
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '005_convert_timestamptz'
down_revision = '004_create_remaining_tables'
branch_labels = None
depends_on = None

# List of (table_name, column_name) pairs to convert to TIMESTAMPTZ
TIMESTAMP_COLUMNS = [
    ("pipeline_runs", "started_at"),
    ("pipeline_runs", "completed_at"),
    ("exams", "created_at"),
    ("exams", "updated_at"),
    ("question_explanations", "created_at"),
    ("question_explanations", "updated_at"),
    ("users", "created_at"),
    ("users", "updated_at"),
    ("users", "last_login"),
    ("questions", "created_at"),
    ("questions", "updated_at"),
    ("question_assets", "created_at"),
    ("passages", "created_at"),
    ("tests", "created_at"),
    ("user_test_attempts", "started_at"),
    ("user_test_attempts", "submitted_at"),
    ("user_concept_retentions", "created_at"),
    ("user_concept_retentions", "last_reviewed_at"),
    ("user_concept_retentions", "next_scheduled_review"),
    ("exam_attempts", "created_at"),
    ("user_memory_states", "created_at"),
    ("human_review_tasks", "created_at"),
    ("human_review_tasks", "reviewed_at"),
    ("user_subscriptions", "current_period_start"),
    ("user_subscriptions", "current_period_end"),
    ("user_subscriptions", "created_at"),
    ("user_subscriptions", "updated_at"),
    ("platform_features", "created_at"),
    ("subscription_plans", "created_at"),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    for table_name, col_name in TIMESTAMP_COLUMNS:
        if table_name in existing_tables:
            columns = [c["name"] for c in inspector.get_columns(table_name)]
            if col_name in columns:
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.alter_column(
                        col_name,
                        type_=sa.DateTime(timezone=True),
                        postgresql_using=f"{col_name} AT TIME ZONE 'UTC'"
                    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    for table_name, col_name in TIMESTAMP_COLUMNS:
        if table_name in existing_tables:
            columns = [c["name"] for c in inspector.get_columns(table_name)]
            if col_name in columns:
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.alter_column(col_name, type_=sa.DateTime(timezone=False))
