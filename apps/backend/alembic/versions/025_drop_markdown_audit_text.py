"""025_drop_markdown_audit_text

Revision ID: 025_drop_markdown_audit_text
Revises: 024_pk_stage_4_final_sweep
Create Date: 2026-08-30 07:20:00.000000

Drop markdown_audit_text from exam_attempt_reports table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '025_drop_markdown_audit_text'
down_revision: Union[str, None] = '024_pk_stage_4_final_sweep'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    # exam_attempt_reports.markdown_audit_text drop
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'exam_attempt_reports' AND column_name = 'markdown_audit_text'
            ) THEN
                ALTER TABLE exam_attempt_reports DROP COLUMN markdown_audit_text CASCADE;
            END IF;
        END $$;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'exam_attempt_reports' AND column_name = 'markdown_audit_text'
            ) THEN
                ALTER TABLE exam_attempt_reports ADD COLUMN markdown_audit_text TEXT;
            END IF;
        END $$;
    """))
