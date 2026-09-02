"""030_add_current_affairs_table

Revision ID: 030_add_current_affairs_table
Revises: 029_add_teacher_points_rewards
Create Date: 2026-09-02 21:00:00.000000

Adds current_affairs table with safe existence checks.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '030_add_current_affairs_table'
down_revision: Union[str, None] = '029_add_teacher_points_rewards'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'current_affairs' not in tables:
        op.create_table(
            'current_affairs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('topic', sa.String(), nullable=True),
            sa.Column('subtopic', sa.String(), nullable=True),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('is_published', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_by_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_current_affairs_date', 'current_affairs', ['date'], unique=False)
        op.create_index('ix_current_affairs_is_published', 'current_affairs', ['is_published'], unique=False)
        op.create_index('ix_current_affairs_topic', 'current_affairs', ['topic'], unique=False)
        op.create_index('ix_current_affairs_subtopic', 'current_affairs', ['subtopic'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'current_affairs' in tables:
        op.drop_table('current_affairs')
