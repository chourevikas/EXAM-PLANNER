"""012_add_missing_question_columns

Revision ID: 012_missing_question_cols
Revises: 011_full_report_and_aggregate
Create Date: 2026-08-16 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '012_missing_question_cols'
down_revision = '011_full_report_and_aggregate'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'questions' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('questions')]
        with op.batch_alter_table('questions') as batch_op:
            if 'accuracy_percentage' not in existing_cols:
                batch_op.add_column(sa.Column('accuracy_percentage', sa.Float(), nullable=True))
            if 'missing_fields_json' not in existing_cols:
                batch_op.add_column(sa.Column('missing_fields_json', JSONB(), nullable=True))
            if 'requires_human_review' not in existing_cols:
                batch_op.add_column(sa.Column('requires_human_review', sa.Boolean(), nullable=False, server_default='false'))
                batch_op.create_index('ix_questions_requires_human_review', ['requires_human_review'])
            if 'validation_status' not in existing_cols:
                batch_op.add_column(sa.Column('validation_status', sa.String(), nullable=True, server_default='PENDING'))
                batch_op.create_index('ix_questions_validation_status', ['validation_status'])
            if 'validation_issues_json' not in existing_cols:
                batch_op.add_column(sa.Column('validation_issues_json', JSONB(), nullable=True))
            if 'page_number_in_pdf' not in existing_cols:
                batch_op.add_column(sa.Column('page_number_in_pdf', sa.Integer(), nullable=True))

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'questions' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('questions')]
        with op.batch_alter_table('questions') as batch_op:
            if 'page_number_in_pdf' in existing_cols:
                batch_op.drop_column('page_number_in_pdf')
            if 'validation_issues_json' in existing_cols:
                batch_op.drop_column('validation_issues_json')
            if 'validation_status' in existing_cols:
                batch_op.drop_index('ix_questions_validation_status')
                batch_op.drop_column('validation_status')
            if 'requires_human_review' in existing_cols:
                batch_op.drop_index('ix_questions_requires_human_review')
                batch_op.drop_column('requires_human_review')
            if 'missing_fields_json' in existing_cols:
                batch_op.drop_column('missing_fields_json')
            if 'accuracy_percentage' in existing_cols:
                batch_op.drop_column('accuracy_percentage')
