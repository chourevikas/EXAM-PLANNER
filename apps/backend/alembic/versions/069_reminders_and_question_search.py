"""069_reminders_and_question_search

Revision ID: 069_reminders_and_question_search
Revises: 068_existing_students_pro
Create Date: 2026-10-19 00:00:00.000000

Reminder preferences on student_profiles (all on by default, so existing reminders keep going out), and a
full-text index on question text for the header search. The index uses the 'simple' configuration so
English, Hindi and Marathi text are all tokenised the same way; searches match word prefixes.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '069_reminders_and_question_search'
down_revision: Union[str, None] = '068_existing_students_pro'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BOOL_COLUMNS = (
    "notify_revision",
    "notify_pending_tasks",
    "notify_task_email",
    "notify_weak_topic",
    "notify_current_affairs",
    "notify_full_paper",
)


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("student_profiles")}
    for name in BOOL_COLUMNS:
        if name not in existing:
            op.add_column("student_profiles", sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.true()))
    if "notify_full_paper_day" not in existing:
        op.add_column("student_profiles", sa.Column("notify_full_paper_day", sa.Integer(), nullable=False, server_default="6"))

    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_question_translations_text_fts "
            "ON question_translations USING gin (to_tsvector('simple', question_text))"
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_question_translations_text_fts")
    op.drop_column("student_profiles", "notify_full_paper_day")
    for name in reversed(BOOL_COLUMNS):
        op.drop_column("student_profiles", name)
