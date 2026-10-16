"""062_free_plan_daily_usage

Revision ID: 062_free_plan_daily_usage
Revises: 059_response_answer_round
Create Date: 2026-10-17 00:00:00.000000

Free plan: 20 answered questions per day (IST), across tests and the practice page.
- exam_question_responses.answered_at: when a question was first answered in a test.
- practice_answers: practice-page answers by signed-in students (one per question per day).

Numbered 062 so it can't clash with 060/061 on the payments branch; merging that branch needs an
Alembic merge revision joining the two heads.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '062_free_plan_daily_usage'
down_revision: Union[str, None] = '059_response_answer_round'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c['name'] for c in insp.get_columns('exam_question_responses')}
    if 'answered_at' not in cols:
        op.add_column('exam_question_responses', sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True))
        op.create_index('ix_exam_question_responses_answered_at', 'exam_question_responses', ['answered_at'])

    if not insp.has_table('practice_answers'):
        op.create_table(
            'practice_answers',
            sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('question_id', sa.BigInteger(), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('selected_option_id', sa.BigInteger(), sa.ForeignKey('question_options.id', ondelete='SET NULL'), nullable=True),
            sa.Column('is_correct', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('answered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_practice_answers_user_answered', 'practice_answers', ['user_id', 'answered_at'])


def downgrade() -> None:
    op.drop_index('ix_practice_answers_user_answered', table_name='practice_answers')
    op.drop_table('practice_answers')
    op.drop_index('ix_exam_question_responses_answered_at', table_name='exam_question_responses')
    op.drop_column('exam_question_responses', 'answered_at')
