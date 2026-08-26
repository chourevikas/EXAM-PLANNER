"""014_add_exam_last_synced_at

Revision ID: 014_exam_last_synced_at
Revises: 013_add_rejected_enum
Create Date: 2026-08-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '014_exam_last_synced_at'
down_revision = '013_add_rejected_enum'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'exams' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exams')]
        with op.batch_alter_table('exams') as batch_op:
            if 'last_synced_at' not in existing_cols:
                batch_op.add_column(
                    sa.Column(
                        'last_synced_at',
                        sa.DateTime(timezone=True),
                        nullable=True,
                    )
                )

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'exams' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exams')]
        with op.batch_alter_table('exams') as batch_op:
            if 'last_synced_at' in existing_cols:
                batch_op.drop_column('last_synced_at')
