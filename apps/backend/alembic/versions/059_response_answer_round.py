"""059_response_answer_round

Revision ID: 059_response_answer_round
Revises: 058_response_confidence_level
Create Date: 2026-10-09 00:00:00.000000

exam_question_responses.answer_round: which pass of a full exam simulation the answer was given in.
1 = answered on the first visit, 2 = the student left the question unanswered and came back to it.
Detected by the exam engine client; NULL when unanswered or not tracked (practice, guest, old attempts).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '059_response_answer_round'
down_revision: Union[str, None] = '058_response_confidence_level'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c['name'] for c in insp.get_columns('exam_question_responses')}
    if 'answer_round' not in cols:
        op.add_column('exam_question_responses', sa.Column('answer_round', sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('exam_question_responses', 'answer_round')
