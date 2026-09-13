"""040_add_user_notification_reads

Revision ID: 040_add_user_notification_reads
Revises: 039_rename_upse_to_upsc
Create Date: 2026-09-13 13:48:00.000000

Creates:
- user_notification_reads table for persisting read receipts across personal and broadcast notifications
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '040_add_user_notification_reads'
down_revision: Union[str, None] = '039_rename_upse_to_upsc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'user_notification_reads' not in tables:
        op.create_table(
            'user_notification_reads',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('user_id', sa.BigInteger(), nullable=False),
            sa.Column('notification_id', sa.String(length=100), nullable=False),
            sa.Column('read_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.UniqueConstraint('user_id', 'notification_id', name='uq_user_notif_read'),
        )
        op.create_index('ix_user_notification_reads_user_id', 'user_notification_reads', ['user_id'])
        op.create_index('ix_user_notification_reads_notification_id', 'user_notification_reads', ['notification_id'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'user_notification_reads' in tables:
        op.drop_index('ix_user_notification_reads_notification_id', table_name='user_notification_reads')
        op.drop_index('ix_user_notification_reads_user_id', table_name='user_notification_reads')
        op.drop_table('user_notification_reads')
