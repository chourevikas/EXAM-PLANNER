"""008_add_exam_pipeline_status_columns

Revision ID: 008_exam_pipeline_status
Revises: 1ce80f939214
Create Date: 2026-08-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '008_exam_pipeline_status'
down_revision = '1ce80f939214'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    existing_cols = [c['name'] for c in insp.get_columns('exams')] if 'exams' in insp.get_table_names() else []

    if 'exams' in insp.get_table_names():
        with op.batch_alter_table('exams') as batch_op:
            if 'status' not in existing_cols:
                batch_op.add_column(sa.Column('status', sa.String(length=50), nullable=False, server_default='PENDING_HUMAN_REVIEW'))
            if 'total_questions' not in existing_cols:
                batch_op.add_column(sa.Column('total_questions', sa.Integer(), nullable=True, server_default='100'))
            if 'extracted_questions_count' not in existing_cols:
                batch_op.add_column(sa.Column('extracted_questions_count', sa.Integer(), nullable=False, server_default='0'))
            if 'missing_questions_count' not in existing_cols:
                batch_op.add_column(sa.Column('missing_questions_count', sa.Integer(), nullable=False, server_default='0'))
            if 'missing_question_numbers_json' not in existing_cols:
                batch_op.add_column(sa.Column('missing_question_numbers_json', sa.JSON(), nullable=True))
            if 'questions_json_folder_path' not in existing_cols:
                batch_op.add_column(sa.Column('questions_json_folder_path', sa.String(length=500), nullable=True))
            if 'solutions_json_folder_path' not in existing_cols:
                batch_op.add_column(sa.Column('solutions_json_folder_path', sa.String(length=500), nullable=True))


def downgrade() -> None:
    pass
