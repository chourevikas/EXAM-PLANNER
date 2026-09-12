"""034_add_exam_types_and_fk_to_exams

Revision ID: 034_add_exam_types
Revises: 033_drop_unused_columns
Create Date: 2026-09-06 00:47:00.000000

Creates:
- exam_types table with full metadata (type, name, duration, questions, marks, negative/positive scoring)
- exam_type_id FK column on exams table
- Seeds default 'upsc' ExamType and links existing exams
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision: str = '034_add_exam_types'
down_revision: Union[str, None] = '033_drop_unused_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 1. Create exam_types table if it doesn't exist
    if 'exam_types' not in tables:
        op.create_table(
            'exam_types',
            sa.Column('id', sa.BigInteger(), sa.Identity(always=False, start=1), nullable=False),
            sa.Column('type', sa.String(length=50), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('total_duration', sa.Integer(), nullable=False, server_default='120'),
            sa.Column('number_of_questions', sa.Integer(), nullable=False, server_default='100'),
            sa.Column('total_marks', sa.Float(), nullable=False, server_default='200.0'),
            sa.Column('negative_marks', sa.Float(), nullable=False, server_default='0.66'),
            sa.Column('positive_marks', sa.Float(), nullable=False, server_default='2.0'),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('type', name='uq_exam_types_type'),
        )
        op.create_index('ix_exam_types_type', 'exam_types', ['type'], unique=True)
        op.create_index('ix_exam_types_active', 'exam_types', ['is_active'])

    # 2. Add exam_type_id foreign key column to exams table
    if 'exams' in tables:
        exam_cols = {c['name'] for c in insp.get_columns('exams')}
        if 'exam_type_id' not in exam_cols:
            with op.batch_alter_table('exams') as batch_op:
                batch_op.add_column(sa.Column('exam_type_id', sa.BigInteger(), nullable=True))
                batch_op.create_foreign_key(
                    'fk_exams_exam_type_id',
                    'exam_types',
                    ['exam_type_id'],
                    ['id'],
                    ondelete='SET NULL'
                )
                batch_op.create_index('ix_exams_exam_type_id', ['exam_type_id'])

    # 3. Seed initial default 'upsc' ExamType record if not present
    bind.execute(
        text("""
            INSERT INTO exam_types (type, name, total_duration, number_of_questions, total_marks, negative_marks, positive_marks, description, is_active, created_at, updated_at)
            VALUES ('upsc', 'UPSC Civil Services Examination', 120, 100, 200.0, 0.66, 2.0, 'Union Public Service Commission - General Studies Paper 1', true, NOW(), NOW())
            ON CONFLICT (type) DO UPDATE SET
                name = EXCLUDED.name,
                total_duration = EXCLUDED.total_duration,
                number_of_questions = EXCLUDED.number_of_questions,
                total_marks = EXCLUDED.total_marks,
                negative_marks = EXCLUDED.negative_marks,
                positive_marks = EXCLUDED.positive_marks,
                updated_at = NOW();
        """)
    )

    # 4. Backfill existing exams to link to 'upsc' exam type
    bind.execute(
        text("""
            UPDATE exams 
            SET exam_type_id = (SELECT id FROM exam_types WHERE type = 'upsc' LIMIT 1)
            WHERE exam_type_id IS NULL;
        """)
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'exams' in tables:
        exam_cols = {c['name'] for c in insp.get_columns('exams')}
        if 'exam_type_id' in exam_cols:
            with op.batch_alter_table('exams') as batch_op:
                batch_op.drop_constraint('fk_exams_exam_type_id', type_='foreignkey')
                batch_op.drop_index('ix_exams_exam_type_id')
                batch_op.drop_column('exam_type_id')

    if 'exam_types' in tables:
        op.drop_index('ix_exam_types_active', table_name='exam_types')
        op.drop_index('ix_exam_types_type', table_name='exam_types')
        op.drop_table('exam_types')
