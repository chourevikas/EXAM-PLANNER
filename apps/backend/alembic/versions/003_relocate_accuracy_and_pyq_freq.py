"""003_relocate_accuracy_and_pyq_freq

Revision ID: 003_relocate_acc_freq
Revises: 002_add_exam_type
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '003_relocate_acc_freq'
down_revision = '002_add_exam_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Drop historical_accuracy and pyq_frequency from question_metadata if present
    if 'question_metadata' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('question_metadata')]
        with op.batch_alter_table('question_metadata') as batch_op:
            if 'historical_accuracy' in columns:
                batch_op.drop_column('historical_accuracy')
            if 'pyq_frequency' in columns:
                batch_op.drop_column('pyq_frequency')

    # 2. Add pyq_frequency to subtopics if missing
    if 'subtopics' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('subtopics')]
        if 'pyq_frequency' not in columns:
            with op.batch_alter_table('subtopics') as batch_op:
                batch_op.add_column(
                    sa.Column('pyq_frequency', sa.Integer(), nullable=False, server_default='0')
                )
                batch_op.create_index('ix_subtopics_pyq_frequency', ['pyq_frequency'])

    # 3. Add candidate_accuracy_pct to exam_question_responses if missing
    if 'exam_question_responses' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('exam_question_responses')]
        if 'candidate_accuracy_pct' not in columns:
            with op.batch_alter_table('exam_question_responses') as batch_op:
                batch_op.add_column(
                    sa.Column('candidate_accuracy_pct', sa.Float(), nullable=True)
                )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'question_metadata' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('question_metadata')]
        with op.batch_alter_table('question_metadata') as batch_op:
            if 'historical_accuracy' not in columns:
                batch_op.add_column(sa.Column('historical_accuracy', sa.Float(), nullable=True))
            if 'pyq_frequency' not in columns:
                batch_op.add_column(sa.Column('pyq_frequency', sa.Integer(), nullable=True))

    if 'subtopics' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('subtopics')]
        if 'pyq_frequency' in columns:
            with op.batch_alter_table('subtopics') as batch_op:
                batch_op.drop_index('ix_subtopics_pyq_frequency')
                batch_op.drop_column('pyq_frequency')

    if 'exam_question_responses' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('exam_question_responses')]
        if 'candidate_accuracy_pct' in columns:
            with op.batch_alter_table('exam_question_responses') as batch_op:
                batch_op.drop_column('candidate_accuracy_pct')
