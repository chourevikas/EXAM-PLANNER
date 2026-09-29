"""057_llm_usage_events

Revision ID: 057_llm_usage_events
Revises: 055_exam_mixed_bank
Create Date: 2026-09-30 00:00:00.000000

llm_usage_events: one row per LLM request (feature, exam/attempt/user it was for, input / cached /
output / thinking tokens, cost, latency, outcome) so spend can be broken down per feature and per
request. Revises 055 because 056_payments_cashfree is not on this branch yet; when both are merged,
point this revision at 056_payments_cashfree.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '057_llm_usage_events'
down_revision: Union[str, None] = '055_exam_mixed_bank'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if 'llm_usage_events' in insp.get_table_names():
        return
    op.create_table(
        'llm_usage_events',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('feature', sa.String(length=64), nullable=False),
        sa.Column('model', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='ok'),
        sa.Column('error', sa.String(length=500), nullable=True),
        sa.Column('exam_id', sa.Integer(), nullable=True),
        sa.Column('attempt_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('detail', sa.String(length=128), nullable=True),
        sa.Column('input_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('output_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('thinking_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cached_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cost_usd', sa.Float(), nullable=False, server_default='0'),
        sa.Column('cost_inr', sa.Float(), nullable=False, server_default='0'),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
    )
    op.create_index('ix_llm_usage_events_created_at', 'llm_usage_events', ['created_at'])
    op.create_index('ix_llm_usage_feature_created', 'llm_usage_events', ['feature', 'created_at'])
    op.create_index('ix_llm_usage_exam', 'llm_usage_events', ['exam_id'])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if 'llm_usage_events' in insp.get_table_names():
        op.drop_table('llm_usage_events')
