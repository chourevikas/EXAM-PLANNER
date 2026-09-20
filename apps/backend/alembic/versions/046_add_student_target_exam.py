"""046_add_student_target_exam

Revision ID: 046_add_student_target_exam
Revises: 045_add_question_reports
Create Date: 2026-09-20 00:00:00.000000

Persists the exam-preparation details students enter on their profile (target exam, target year,
optional subject, weekly study goal) so admins can see them on the Users page.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '046_add_student_target_exam'
down_revision: Union[str, None] = '045_add_question_reports'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ('target_exam', sa.String(length=100)),
    ('target_year', sa.String(length=10)),
    ('optional_subject', sa.String(length=150)),
    ('weekly_hours', sa.String(length=10)),
]


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'student_profiles' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('student_profiles')}
    with op.batch_alter_table('student_profiles') as batch_op:
        for name, type_ in COLUMNS:
            if name not in existing:
                batch_op.add_column(sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'student_profiles' not in insp.get_table_names():
        return
    existing = {c['name'] for c in insp.get_columns('student_profiles')}
    with op.batch_alter_table('student_profiles') as batch_op:
        for name, _ in COLUMNS:
            if name in existing:
                batch_op.drop_column(name)
