"""007_add_gamification_and_studytask_models

Revision ID: 1ce80f939214
Revises: 006_exam_lifecycle
Create Date: 2026-08-10 19:33:19.123474

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '1ce80f939214'
down_revision: Union[str, None] = '006_exam_lifecycle'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    import app.db.models  # noqa: F401
    from sqlmodel import SQLModel

    SQLModel.metadata.create_all(bind=bind, checkfirst=True)

    if 'student_profiles' in insp.get_table_names():
        existing_cols = [c['name'] for c in insp.get_columns('student_profiles')]
        with op.batch_alter_table('student_profiles') as batch_op:
            if 'current_streak' not in existing_cols:
                batch_op.add_column(sa.Column('current_streak', sa.Integer(), nullable=False, server_default='0'))
            if 'highest_streak' not in existing_cols:
                batch_op.add_column(sa.Column('highest_streak', sa.Integer(), nullable=False, server_default='0'))
            if 'total_xp' not in existing_cols:
                batch_op.add_column(sa.Column('total_xp', sa.Integer(), nullable=False, server_default='0'))
            if 'level' not in existing_cols:
                batch_op.add_column(sa.Column('level', sa.Integer(), nullable=False, server_default='1'))
            if 'last_study_date' not in existing_cols:
                batch_op.add_column(sa.Column('last_study_date', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    pass
