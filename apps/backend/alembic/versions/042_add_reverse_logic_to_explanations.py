"""042_add_reverse_logic_to_explanations

Revision ID: 042_add_reverse_logic
Revises: 041_ensure_challenge_enums
Create Date: 2026-09-16 00:00:00.000000

Adds question_explanations.reverse_logic — a single free-form text block
covering the reasoning for all options together, replacing the old
per-option distractor analysis fields in the admin review UI.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '042_add_reverse_logic'
down_revision: Union[str, None] = '041_ensure_challenge_enums'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'question_explanations' in tables:
        qe_cols = [c['name'] for c in insp.get_columns('question_explanations')]
        with op.batch_alter_table('question_explanations') as batch_op:
            if 'reverse_logic' not in qe_cols:
                batch_op.add_column(sa.Column('reverse_logic', sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'question_explanations' in tables:
        qe_cols = [c['name'] for c in insp.get_columns('question_explanations')]
        with op.batch_alter_table('question_explanations') as batch_op:
            if 'reverse_logic' in qe_cols:
                batch_op.drop_column('reverse_logic')
