"""054_knowledge_tags_ai

Revision ID: 054_knowledge_tags_ai
Revises: 053_knowledge_layer
Create Date: 2026-09-24 00:00:00.000000

Nullable questions.knowledge_tags_ai: Knowledge Layer tags extracted by the LLM, kept apart from
the authored knowledge_tags_raw so re-enrichment can reuse them instead of calling the model again.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '054_knowledge_tags_ai'
down_revision: Union[str, None] = '053_knowledge_layer'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if 'questions' in insp.get_table_names():
        existing = {c['name'] for c in insp.get_columns('questions')}
        if 'knowledge_tags_ai' not in existing:
            with op.batch_alter_table('questions') as batch_op:
                batch_op.add_column(
                    sa.Column('knowledge_tags_ai', sa.JSON().with_variant(postgresql.JSONB(), 'postgresql'), nullable=True)
                )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if 'questions' in insp.get_table_names():
        existing = {c['name'] for c in insp.get_columns('questions')}
        if 'knowledge_tags_ai' in existing:
            with op.batch_alter_table('questions') as batch_op:
                batch_op.drop_column('knowledge_tags_ai')
