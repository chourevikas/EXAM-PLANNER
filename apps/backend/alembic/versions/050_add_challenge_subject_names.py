"""050_add_challenge_subject_names

Revision ID: 050_add_challenge_subject_names
Revises: 049_challenge_enums_varchar
Create Date: 2026-09-21 00:00:00.000000

A challenge can now cover several subjects (previously a single subject_name).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '050_add_challenge_subject_names'
down_revision: Union[str, None] = '049_challenge_enums_varchar'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'challenges' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('challenges')}
    if 'subject_names' not in existing:
        with op.batch_alter_table('challenges') as batch_op:
            batch_op.add_column(sa.Column('subject_names', sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'challenges' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('challenges')}
    if 'subject_names' in existing:
        with op.batch_alter_table('challenges') as batch_op:
            batch_op.drop_column('subject_names')
