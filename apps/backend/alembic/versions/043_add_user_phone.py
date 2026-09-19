"""043_add_user_phone

Revision ID: 043_add_user_phone
Revises: 042_add_reverse_logic
Create Date: 2026-09-19 00:00:00.000000

Adds users.phone so the mobile number a student enters on their profile is
actually persisted and can be shown in the admin candidate profile.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '043_add_user_phone'
down_revision: Union[str, None] = '042_add_reverse_logic'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'users' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('users')]
        if 'phone' not in cols:
            with op.batch_alter_table('users') as batch_op:
                batch_op.add_column(sa.Column('phone', sa.String(length=32), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'users' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('users')]
        if 'phone' in cols:
            with op.batch_alter_table('users') as batch_op:
                batch_op.drop_column('phone')
