"""035_add_broadcast_notifications_table

Revision ID: 035_add_broadcast_notifications
Revises: 034_add_exam_types
Create Date: 2026-09-08 20:30:00.000000

Creates:
- broadcast_notifications table for admin-managed broadcast notifications
- indexes on status, created_at, published_at, created_by_id
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '035_add_broadcast_notifications'
down_revision: Union[str, None] = '034_add_exam_types_and_fk_to_exams'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'broadcast_notifications' not in tables:
        op.create_table(
            'broadcast_notifications',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('content_type', sa.String(length=50), nullable=False, server_default='other'),
            sa.Column('link', sa.String(length=1000), nullable=True),
            sa.Column('attachment', sa.String(length=1000), nullable=True),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='draft'),
            sa.Column('created_by_id', sa.BigInteger(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        )
        op.create_index('ix_broadcast_notifications_status', 'broadcast_notifications', ['status'])
        op.create_index('ix_broadcast_notifications_created_at', 'broadcast_notifications', ['created_at'])
        op.create_index('ix_broadcast_notifications_published_at', 'broadcast_notifications', ['published_at'])
        op.create_index('ix_broadcast_notifications_created_by_id', 'broadcast_notifications', ['created_by_id'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'broadcast_notifications' in tables:
        op.drop_index('ix_broadcast_notifications_created_by_id', table_name='broadcast_notifications')
        op.drop_index('ix_broadcast_notifications_published_at', table_name='broadcast_notifications')
        op.drop_index('ix_broadcast_notifications_created_at', table_name='broadcast_notifications')
        op.drop_index('ix_broadcast_notifications_status', table_name='broadcast_notifications')
        op.drop_table('broadcast_notifications')
