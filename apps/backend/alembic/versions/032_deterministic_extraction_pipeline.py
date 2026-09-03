"""032_deterministic_extraction_pipeline

Revision ID: 032_deterministic_pipeline
Revises: 031_testimonials_timestamptz
Create Date: 2026-09-03 19:00:00.000000

Adds columns to questions, question_explanations, question_assets, pipeline_runs,
makes question_explanations.core_concept and question_assets.asset_path nullable,
and creates question_option_reasoning table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '032_deterministic_pipeline'
down_revision: Union[str, None] = '031_testimonials_timestamptz'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 1. Update questions table
    if 'questions' in tables:
        q_cols = [c['name'] for c in insp.get_columns('questions')]
        with op.batch_alter_table('questions') as batch_op:
            if 'subject_raw' not in q_cols:
                batch_op.add_column(sa.Column('subject_raw', sa.String(length=255), nullable=True))
            if 'topic_raw' not in q_cols:
                batch_op.add_column(sa.Column('topic_raw', sa.String(length=255), nullable=True))
            if 'subtopic_raw' not in q_cols:
                batch_op.add_column(sa.Column('subtopic_raw', sa.String(length=255), nullable=True))
            if 'difficulty_raw' not in q_cols:
                batch_op.add_column(sa.Column('difficulty_raw', sa.String(length=50), nullable=True))
            if 'extraction_method' not in q_cols:
                batch_op.add_column(sa.Column('extraction_method', sa.String(length=20), nullable=True, server_default='DOCLING_REGEX'))
            if 'extraction_confidence' not in q_cols:
                batch_op.add_column(sa.Column('extraction_confidence', sa.Numeric(precision=4, scale=3), nullable=True))
            if 'extraction_issues_json' not in q_cols:
                batch_op.add_column(sa.Column('extraction_issues_json', sa.JSON(), nullable=True))

    # 2. Update question_explanations table
    if 'question_explanations' in tables:
        qe_cols = [c['name'] for c in insp.get_columns('question_explanations')]
        with op.batch_alter_table('question_explanations') as batch_op:
            if 'common_mistake' not in qe_cols:
                batch_op.add_column(sa.Column('common_mistake', sa.Text(), nullable=True))
            if 'core_concept' in qe_cols:
                batch_op.alter_column('core_concept', existing_type=sa.Text(), nullable=True)

    # 3. Update question_assets table
    if 'question_assets' in tables:
        qa_cols = [c['name'] for c in insp.get_columns('question_assets')]
        with op.batch_alter_table('question_assets') as batch_op:
            if 'table_markdown' not in qa_cols:
                batch_op.add_column(sa.Column('table_markdown', sa.Text(), nullable=True))
            if 'asset_path' in qa_cols:
                batch_op.alter_column('asset_path', existing_type=sa.String(), nullable=True)

    # 4. Create question_option_reasoning table
    if 'question_option_reasoning' not in tables:
        op.create_table(
            'question_option_reasoning',
            sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), primary_key=True, autoincrement=True),
            sa.Column('question_option_id', sa.BigInteger(), sa.ForeignKey('question_options.id', ondelete='CASCADE'), nullable=False),
            sa.Column('why_tempting', sa.Text(), nullable=False),
            sa.Column('whats_actually_true', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        )
        op.create_index('ux_option_reasoning_option', 'question_option_reasoning', ['question_option_id'], unique=True)

    # 5. Update pipeline_runs table
    if 'pipeline_runs' in tables:
        pr_cols = [c['name'] for c in insp.get_columns('pipeline_runs')]
        with op.batch_alter_table('pipeline_runs') as batch_op:
            if 'extraction_method' not in pr_cols:
                batch_op.add_column(sa.Column('extraction_method', sa.String(length=20), nullable=True, server_default='DOCLING_REGEX'))


def downgrade() -> None:
    pass
