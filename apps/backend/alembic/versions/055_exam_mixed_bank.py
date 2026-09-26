"""055_exam_mixed_bank

Revision ID: 055_exam_mixed_bank
Revises: 054_knowledge_tags_ai
Create Date: 2026-09-26 00:00:00.000000

exams.is_mixed_bank: uploads that mix exams and years ("[MPSC Mains 2017]", "[STI Pre 2014]" per
question) instead of one paper of one exam and year. Existing exams are single papers (false).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '055_exam_mixed_bank'
down_revision: Union[str, None] = '054_knowledge_tags_ai'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if 'exams' in insp.get_table_names():
        existing = {c['name'] for c in insp.get_columns('exams')}
        if 'is_mixed_bank' not in existing:
            with op.batch_alter_table('exams') as batch_op:
                batch_op.add_column(
                    sa.Column('is_mixed_bank', sa.Boolean(), nullable=False, server_default=sa.false())
                )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if 'exams' in insp.get_table_names():
        existing = {c['name'] for c in insp.get_columns('exams')}
        if 'is_mixed_bank' in existing:
            with op.batch_alter_table('exams') as batch_op:
                batch_op.drop_column('is_mixed_bank')
