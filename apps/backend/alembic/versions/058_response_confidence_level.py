"""058_response_confidence_level

Revision ID: 058_response_confidence_level
Revises: 057_llm_usage_events
Create Date: 2026-10-01 00:00:00.000000

exam_question_responses.confidence_level: the student's self-reported confidence for an answer
(SURE / FIFTY_FIFTY / GUESS), captured from the exam and practice bottom bars. Nullable; stored as
a short string rather than a Postgres enum so new levels need no type migration.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '058_response_confidence_level'
down_revision: Union[str, None] = '057_llm_usage_events'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c['name'] for c in insp.get_columns('exam_question_responses')}
    if 'confidence_level' not in cols:
        op.add_column('exam_question_responses', sa.Column('confidence_level', sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column('exam_question_responses', 'confidence_level')
