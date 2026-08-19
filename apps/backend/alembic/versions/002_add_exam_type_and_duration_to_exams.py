"""002_add_exam_type_and_duration_to_exams

Revision ID: 002_add_exam_type
Revises: 001_add_canonical_q_id
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '002_add_exam_type'
down_revision = '001_add_canonical_q_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'exams' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('exams')]
        with op.batch_alter_table('exams') as batch_op:
            if 'exam_type' not in columns:
                batch_op.add_column(
                    sa.Column('exam_type', sa.String(length=50), nullable=True, server_default='PYQ')
                )
                batch_op.create_index('ix_exams_exam_type', ['exam_type'])
            if 'total_duration_minutes' not in columns:
                batch_op.add_column(
                    sa.Column('total_duration_minutes', sa.Integer(), nullable=True, server_default='120')
                )
            if 'total_marks' not in columns:
                batch_op.add_column(
                    sa.Column('total_marks', sa.Float(), nullable=True, server_default='200.0')
                )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'exams' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('exams')]
        with op.batch_alter_table('exams') as batch_op:
            if 'exam_type' in columns:
                batch_op.drop_index('ix_exams_exam_type')
                batch_op.drop_column('exam_type')
            if 'total_duration_minutes' in columns:
                batch_op.drop_column('total_duration_minutes')
            if 'total_marks' in columns:
                batch_op.drop_column('total_marks')
