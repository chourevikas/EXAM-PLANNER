"""036_add_challenges

Revision ID: 036_add_challenges
Revises: 035_add_broadcast_notifications
Create Date: 2026-09-09 00:00:00.000000

Creates:
- challenges, challenge_questions, challenge_invites, challenge_attempts,
  challenge_responses tables for the Challenge + Share feature
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '036_add_challenges'
down_revision: Union[str, None] = '035_add_broadcast_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'challenges' not in tables:
        op.create_table(
            'challenges',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('creator_id', sa.BigInteger(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('question_count', sa.Integer(), nullable=False, server_default='10'),
            sa.Column('difficulty', sa.String(length=20), nullable=True),
            sa.Column('subject_name', sa.String(length=200), nullable=True),
            sa.Column('time_limit_minutes', sa.Integer(), nullable=False, server_default='15'),
            sa.Column('visibility', sa.String(length=20), nullable=False, server_default='INVITE_ONLY'),
            sa.Column('share_token', sa.String(length=64), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='ACTIVE'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        )
        op.create_index('ix_challenges_creator_id', 'challenges', ['creator_id'])
        op.create_index('ix_challenges_creator_status', 'challenges', ['creator_id', 'status'])
        op.create_index('ix_challenges_share_token', 'challenges', ['share_token'], unique=True)
        op.create_index('ix_challenges_visibility', 'challenges', ['visibility'])
        op.create_index('ix_challenges_status', 'challenges', ['status'])
        op.create_index('ix_challenges_expires_at', 'challenges', ['expires_at'])

    if 'challenge_questions' not in tables:
        op.create_table(
            'challenge_questions',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('challenge_id', sa.BigInteger(), nullable=False),
            sa.Column('question_id', sa.BigInteger(), nullable=False),
            sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        )
        op.create_index('ix_challenge_questions_challenge_id', 'challenge_questions', ['challenge_id'])
        op.create_index('ix_challenge_questions_question_id', 'challenge_questions', ['question_id'])
        op.create_index(
            'ix_challenge_questions_challenge_order', 'challenge_questions',
            ['challenge_id', 'order_index'], unique=True,
        )

    if 'challenge_invites' not in tables:
        op.create_table(
            'challenge_invites',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('challenge_id', sa.BigInteger(), nullable=False),
            sa.Column('invited_user_id', sa.BigInteger(), nullable=False),
            sa.Column('invited_by_id', sa.BigInteger(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['invited_user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['invited_by_id'], ['users.id'], ondelete='CASCADE'),
        )
        op.create_index('ix_challenge_invites_challenge_id', 'challenge_invites', ['challenge_id'])
        op.create_index('ix_challenge_invites_user', 'challenge_invites', ['invited_user_id'])
        op.create_index(
            'ix_challenge_invites_challenge_user', 'challenge_invites',
            ['challenge_id', 'invited_user_id'], unique=True,
        )

    if 'challenge_attempts' not in tables:
        op.create_table(
            'challenge_attempts',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('challenge_id', sa.BigInteger(), nullable=False),
            sa.Column('user_id', sa.BigInteger(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='IN_PROGRESS'),
            sa.Column('total_score', sa.Float(), nullable=False, server_default='0'),
            sa.Column('total_correct', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('total_incorrect', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('total_unattempted', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('time_spent_seconds', sa.Float(), nullable=False, server_default='0'),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        )
        op.create_index('ix_challenge_attempts_challenge_id', 'challenge_attempts', ['challenge_id'])
        op.create_index('ix_challenge_attempts_user', 'challenge_attempts', ['user_id'])
        op.create_index(
            'ix_challenge_attempts_challenge_user', 'challenge_attempts',
            ['challenge_id', 'user_id'],
        )
        op.create_index('ix_challenge_attempts_status', 'challenge_attempts', ['status'])

    if 'challenge_responses' not in tables:
        op.create_table(
            'challenge_responses',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('attempt_id', sa.BigInteger(), nullable=False),
            sa.Column('question_id', sa.BigInteger(), nullable=False),
            sa.Column('selected_option_id', sa.BigInteger(), nullable=True),
            sa.Column('is_correct', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('time_spent_seconds', sa.Float(), nullable=False, server_default='0'),
            sa.Column('answered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['attempt_id'], ['challenge_attempts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['selected_option_id'], ['question_options.id'], ondelete='SET NULL'),
        )
        op.create_index('ix_challenge_responses_attempt_id', 'challenge_responses', ['attempt_id'])
        op.create_index('ix_challenge_responses_question_id', 'challenge_responses', ['question_id'])
        op.create_index(
            'ix_challenge_responses_attempt_q', 'challenge_responses',
            ['attempt_id', 'question_id'], unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'challenge_responses' in tables:
        op.drop_table('challenge_responses')
    if 'challenge_attempts' in tables:
        op.drop_table('challenge_attempts')
    if 'challenge_invites' in tables:
        op.drop_table('challenge_invites')
    if 'challenge_questions' in tables:
        op.drop_table('challenge_questions')
    if 'challenges' in tables:
        op.drop_table('challenges')
