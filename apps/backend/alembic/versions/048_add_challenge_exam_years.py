"""048_add_challenge_exam_years

Revision ID: 048_add_challenge_exam_years
Revises: 047_add_student_onboarding
Create Date: 2026-09-20 00:00:00.000000

Lets a challenge be scoped to an exam and one or more exam years.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '048_add_challenge_exam_years'
down_revision: Union[str, None] = '047_add_student_onboarding'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'challenges' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('challenges')}
    with op.batch_alter_table('challenges') as batch_op:
        if 'exam_type_id' not in existing:
            batch_op.add_column(sa.Column('exam_type_id', sa.BigInteger(), nullable=True))
            batch_op.create_foreign_key(
                'fk_challenges_exam_type_id', 'exam_types', ['exam_type_id'], ['id'], ondelete='SET NULL'
            )
        if 'exam_name' not in existing:
            batch_op.add_column(sa.Column('exam_name', sa.String(length=200), nullable=True))
        if 'years' not in existing:
            batch_op.add_column(sa.Column('years', sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'challenges' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('challenges')}
    with op.batch_alter_table('challenges') as batch_op:
        if 'years' in existing:
            batch_op.drop_column('years')
        if 'exam_name' in existing:
            batch_op.drop_column('exam_name')
        if 'exam_type_id' in existing:
            batch_op.drop_constraint('fk_challenges_exam_type_id', type_='foreignkey')
            batch_op.drop_column('exam_type_id')
