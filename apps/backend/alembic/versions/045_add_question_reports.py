"""045_add_question_reports

Revision ID: 045_add_question_reports
Revises: 044_admin_section_perms
Create Date: 2026-09-19 00:00:00.000000

Adds question_reports: problems students report on published questions, triaged in
the admin "Reported Questions" view.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '045_add_question_reports'
down_revision: Union[str, None] = '044_admin_section_perms'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if 'question_reports' in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        'question_reports',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('question_id', sa.BigInteger(), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reporter_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reason', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='OPEN'),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('resolved_by_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_question_reports_question_id', 'question_reports', ['question_id'])
    op.create_index('ix_question_reports_reporter_id', 'question_reports', ['reporter_id'])
    op.create_index('ix_question_reports_status', 'question_reports', ['status'])
    op.create_index('ix_question_reports_question_status', 'question_reports', ['question_id', 'status'])


def downgrade() -> None:
    bind = op.get_bind()
    if 'question_reports' in sa.inspect(bind).get_table_names():
        op.drop_table('question_reports')
