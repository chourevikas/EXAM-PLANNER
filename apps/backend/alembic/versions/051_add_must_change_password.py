"""051_add_must_change_password

Revision ID: 051_add_must_change_password
Revises: 050_add_challenge_subject_names
Create Date: 2026-09-21 00:00:00.000000

Staff accounts created by a Super Admin start with an emailed temporary password
and must set their own before using the API.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '051_add_must_change_password'
down_revision: Union[str, None] = '050_add_challenge_subject_names'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'users' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('users')}
    if 'must_change_password' not in existing:
        with op.batch_alter_table('users') as batch_op:
            batch_op.add_column(
                sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default=sa.false())
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'users' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('users')}
    if 'must_change_password' in existing:
        with op.batch_alter_table('users') as batch_op:
            batch_op.drop_column('must_change_password')
