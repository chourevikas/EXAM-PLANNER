"""067_exam_marking_scheme

Revision ID: 067_exam_marking_scheme
Revises: 066_ms_translation_perms
Create Date: 2026-10-18 00:00:00.000000

Each exam stores its marking scheme (marks for a correct answer, marks deducted for a wrong one),
asked when the exam is added. Existing exams get the scheme their questions already carry (the most
common marks among them), else their exam type's.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '067_exam_marking_scheme'
down_revision: Union[str, None] = '066_ms_translation_perms'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exams', sa.Column('marks_per_question', sa.Float(), nullable=True))
    op.add_column('exams', sa.Column('negative_marks_per_question', sa.Float(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT exam_id, marks, negative_marks, COUNT(*) AS n FROM questions "
        "GROUP BY exam_id, marks, negative_marks ORDER BY exam_id, n DESC"
    )).fetchall()
    seen = set()
    for exam_id, marks, negative, _ in rows:
        if exam_id in seen or marks is None:
            continue
        seen.add(exam_id)
        bind.execute(
            sa.text("UPDATE exams SET marks_per_question = :m, negative_marks_per_question = :n WHERE id = :id"),
            {"m": float(marks), "n": float(negative or 0), "id": exam_id},
        )
    # Exams without questions yet: their exam type's scheme
    bind.execute(sa.text(
        "UPDATE exams SET "
        "marks_per_question = (SELECT et.positive_marks FROM exam_types et WHERE et.id = exams.exam_type_id), "
        "negative_marks_per_question = (SELECT et.negative_marks FROM exam_types et WHERE et.id = exams.exam_type_id) "
        "WHERE marks_per_question IS NULL AND exam_type_id IS NOT NULL"
    ))


def downgrade() -> None:
    op.drop_column('exams', 'negative_marks_per_question')
    op.drop_column('exams', 'marks_per_question')
