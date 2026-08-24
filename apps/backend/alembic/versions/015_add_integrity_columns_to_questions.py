"""015_add_integrity_columns_to_questions

Revision ID: 015_question_integrity_cols
Revises: 014_exam_last_synced_at
Create Date: 2026-08-24 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '015_question_integrity_cols'
down_revision = '014_exam_last_synced_at'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'questions' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('questions')]
        with op.batch_alter_table('questions') as batch_op:
            if 'integrity_status' not in existing_cols:
                batch_op.add_column(
                    sa.Column(
                        'integrity_status',
                        sa.String(length=50),
                        nullable=True,
                        server_default='PENDING',
                    )
                )
                batch_op.create_index('ix_questions_integrity_status', ['integrity_status'])

            if 'integrity_reasons_json' not in existing_cols:
                batch_op.add_column(
                    sa.Column(
                        'integrity_reasons_json',
                        sa.JSON(),
                        nullable=True,
                    )
                )

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'questions' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('questions')]
        with op.batch_alter_table('questions') as batch_op:
            if 'integrity_status' in existing_cols:
                batch_op.drop_index('ix_questions_integrity_status')
                batch_op.drop_column('integrity_status')
            if 'integrity_reasons_json' in existing_cols:
                batch_op.drop_column('integrity_reasons_json')
