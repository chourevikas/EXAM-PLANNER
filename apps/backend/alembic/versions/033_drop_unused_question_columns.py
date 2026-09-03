"""033_drop_unused_question_columns

Revision ID: 033_drop_unused_columns
Revises: 032_deterministic_pipeline
Create Date: 2026-09-03 20:12:00.000000

Drops unused columns from questions table:
- passage_id
- canonical_question_id
- passage_page_numbers_json
- accuracy_percentage
- missing_fields_json
- validation_status
- validation_issues_json
- integrity_status
- integrity_reasons_json
- page_number_in_pdf
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '033_drop_unused_columns'
down_revision: Union[str, None] = '032_deterministic_pipeline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'questions' in tables:
        q_cols = {c['name'] for c in insp.get_columns('questions')}
        indexes = {i['name'] for i in insp.get_indexes('questions')}
        fks = insp.get_foreign_keys('questions')

        with op.batch_alter_table('questions') as batch_op:
            # 1. Drop foreign keys if present
            for fk in fks:
                if 'passage_id' in fk.get('constrained_columns', []):
                    batch_op.drop_constraint(fk['name'], type_='foreignkey')
                elif 'canonical_question_id' in fk.get('constrained_columns', []):
                    batch_op.drop_constraint(fk['name'], type_='foreignkey')

            # 2. Drop indexes if present
            for idx_name in ('ix_questions_passage', 'ix_questions_validation_status', 'ix_questions_integrity_status'):
                if idx_name in indexes:
                    batch_op.drop_index(idx_name)

            # 3. Drop columns if present
            cols_to_drop = [
                'passage_id',
                'canonical_question_id',
                'passage_page_numbers_json',
                'accuracy_percentage',
                'missing_fields_json',
                'validation_status',
                'validation_issues_json',
                'integrity_status',
                'integrity_reasons_json',
                'page_number_in_pdf',
            ]
            for col in cols_to_drop:
                if col in q_cols:
                    batch_op.drop_column(col)


def downgrade() -> None:
    # Downgrade reinstates columns as nullable for backward compatibility
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'questions' in tables:
        q_cols = {c['name'] for c in insp.get_columns('questions')}
        with op.batch_alter_table('questions') as batch_op:
            if 'passage_id' not in q_cols:
                batch_op.add_column(sa.Column('passage_id', sa.BigInteger(), nullable=True))
            if 'canonical_question_id' not in q_cols:
                batch_op.add_column(sa.Column('canonical_question_id', sa.BigInteger(), nullable=True))
            if 'passage_page_numbers_json' not in q_cols:
                batch_op.add_column(sa.Column('passage_page_numbers_json', sa.JSON(), nullable=True))
            if 'accuracy_percentage' not in q_cols:
                batch_op.add_column(sa.Column('accuracy_percentage', sa.Float(), nullable=True))
            if 'missing_fields_json' not in q_cols:
                batch_op.add_column(sa.Column('missing_fields_json', sa.JSON(), nullable=True))
            if 'validation_status' not in q_cols:
                batch_op.add_column(sa.Column('validation_status', sa.String(length=50), nullable=True))
            if 'validation_issues_json' not in q_cols:
                batch_op.add_column(sa.Column('validation_issues_json', sa.JSON(), nullable=True))
            if 'integrity_status' not in q_cols:
                batch_op.add_column(sa.Column('integrity_status', sa.String(length=50), nullable=True))
            if 'integrity_reasons_json' not in q_cols:
                batch_op.add_column(sa.Column('integrity_reasons_json', sa.JSON(), nullable=True))
            if 'page_number_in_pdf' not in q_cols:
                batch_op.add_column(sa.Column('page_number_in_pdf', sa.Integer(), nullable=True))
