"""013_add_rejected_enum_and_pipeline_support

Revision ID: 013_add_rejected_enum
Revises: 012_missing_question_cols
Create Date: 2026-08-17 21:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '013_add_rejected_enum'
down_revision = '012_missing_question_cols'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if dialect_name == 'postgresql':
        # Add REJECTED to questionstatus enum if not already present
        op.execute("ALTER TYPE questionstatus ADD VALUE IF NOT EXISTS 'REJECTED';")

    # Inspect tables to ensure exam pipeline columns are present
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'exams' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exams')]
        with op.batch_alter_table('exams') as batch_op:
            if 'pdf_path' not in existing_cols:
                batch_op.add_column(sa.Column('pdf_path', sa.String(), nullable=True))
            if 'answer_key_pdf_path' not in existing_cols:
                batch_op.add_column(sa.Column('answer_key_pdf_path', sa.String(), nullable=True))
            if 'questions_json_path' not in existing_cols:
                batch_op.add_column(sa.Column('questions_json_path', sa.String(), nullable=True))
            if 'solutions_json_path' not in existing_cols:
                batch_op.add_column(sa.Column('solutions_json_path', sa.String(), nullable=True))
            if 'questions_json_folder_path' not in existing_cols:
                batch_op.add_column(sa.Column('questions_json_folder_path', sa.String(), nullable=True))
            if 'solutions_json_folder_path' not in existing_cols:
                batch_op.add_column(sa.Column('solutions_json_folder_path', sa.String(), nullable=True))

def downgrade() -> None:
    pass
