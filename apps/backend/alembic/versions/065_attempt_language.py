"""065_attempt_language

Revision ID: 065_attempt_language
Revises: 064_milestones_and_weekly_email
Create Date: 2026-10-17 00:00:00.000000

The language a student chose before starting a test (en, hi or mr). It is fixed for the whole
attempt, so a resumed attempt continues in the same language. Existing attempts are English.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '065_attempt_language'
down_revision: Union[str, None] = '064_milestones_and_weekly_email'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'exam_attempts',
        sa.Column('language', sa.String(length=5), nullable=False, server_default='en'),
    )


def downgrade() -> None:
    op.drop_column('exam_attempts', 'language')
