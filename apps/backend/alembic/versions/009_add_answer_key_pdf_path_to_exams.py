"""009_add_answer_key_pdf_path_to_exams

Revision ID: 009_add_answer_key_pdf_path
Revises: 008_exam_pipeline_status
Create Date: 2026-08-13

"""
from alembic import op
import sqlalchemy as sa


revision = '009_add_answer_key_pdf_path'
down_revision = '008_exam_pipeline_status'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    tables = insp.get_table_names()
    if 'exams' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exams')]
        with op.batch_alter_table('exams') as batch_op:
            if 'answer_key_pdf_path' not in existing_cols:
                batch_op.add_column(
                    sa.Column('answer_key_pdf_path', sa.String(length=500), nullable=True)
                )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    tables = insp.get_table_names()
    if 'exams' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exams')]
        with op.batch_alter_table('exams') as batch_op:
            if 'answer_key_pdf_path' in existing_cols:
                batch_op.drop_column('answer_key_pdf_path')
