"""029_add_teacher_points_and_rewards_tables

Revision ID: 029_add_teacher_points_rewards
Revises: 028_seed_review_perms
Create Date: 2026-08-31 10:10:00.000000

Adds teacher_profiles, review_points_logs, and teacher_rewards. Purely
additive; no existing tables are touched.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '029_add_teacher_points_rewards'
down_revision: Union[str, None] = '028_seed_review_perms'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'teacher_profiles' not in tables:
        op.create_table(
            'teacher_profiles',
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('total_review_points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('reviews_completed_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('user_id'),
        )

    if 'review_points_logs' not in tables:
        op.create_table(
            'review_points_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('review_task_id', sa.Integer(), nullable=True),
            sa.Column('question_id', sa.Integer(), nullable=True),
            sa.Column('action', sa.String(length=20), nullable=False),
            sa.Column('points', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['review_task_id'], ['human_review_tasks.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_review_points_logs_user_id', 'review_points_logs', ['user_id'])

    if 'teacher_rewards' not in tables:
        op.create_table(
            'teacher_rewards',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('teacher_id', sa.Integer(), nullable=False),
            sa.Column('admin_id', sa.Integer(), nullable=True),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('points_value', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['teacher_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_teacher_rewards_teacher_id', 'teacher_rewards', ['teacher_id'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'teacher_rewards' in tables:
        op.drop_table('teacher_rewards')
    if 'review_points_logs' in tables:
        op.drop_table('review_points_logs')
    if 'teacher_profiles' in tables:
        op.drop_table('teacher_profiles')
