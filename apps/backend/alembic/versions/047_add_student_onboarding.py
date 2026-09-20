"""047_add_student_onboarding

Revision ID: 047_add_student_onboarding
Revises: 046_add_student_target_exam
Create Date: 2026-09-20 00:00:00.000000

First-login onboarding: records when a student finished it and their self-rated
subject proficiency (1-5 per subject).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '047_add_student_onboarding'
down_revision: Union[str, None] = '046_add_student_target_exam'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ('onboarding_completed_at', sa.DateTime(timezone=True)),
    ('subject_proficiency', sa.JSON()),
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
