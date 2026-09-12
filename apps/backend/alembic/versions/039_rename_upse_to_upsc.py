"""039_rename_upse_to_upsc

Revision ID: 039_rename_upse_to_upsc
Revises: 038_add_site_settings
Create Date: 2026-09-12 18:00:00.000000

Renames canonical exam type 'upse' to 'upsc' (UPSC Civil Services Examination)
and reconciles any linked exams to point to 'upsc'.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision: str = '039_rename_upse_to_upsc'
down_revision: Union[str, None] = '038_add_site_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    
    # 1. If 'upsc' does not exist and 'upse' exists, rename 'upse' -> 'upsc'
    bind.execute(
        text("""
            UPDATE exam_types
            SET type = 'upsc',
                name = 'UPSC Civil Services Examination',
                description = 'Union Public Service Commission - General Studies Paper 1',
                updated_at = NOW()
            WHERE type = 'upse'
              AND NOT EXISTS (SELECT 1 FROM exam_types WHERE type = 'upsc');
        """)
    )

    # 2. If 'upsc' still does not exist, insert it
    bind.execute(
        text("""
            INSERT INTO exam_types (type, name, total_duration, number_of_questions, total_marks, negative_marks, positive_marks, description, is_active, created_at, updated_at)
            VALUES ('upsc', 'UPSC Civil Services Examination', 120, 100, 200.0, 0.66, 2.0, 'Union Public Service Commission - General Studies Paper 1', true, NOW(), NOW())
            ON CONFLICT (type) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                updated_at = NOW();
        """)
    )

    # 3. If both existed, re-link exams referencing 'upse' to 'upsc' and remove 'upse'
    bind.execute(
        text("""
            UPDATE exams
            SET exam_type_id = (SELECT id FROM exam_types WHERE type = 'upsc' LIMIT 1)
            WHERE exam_type_id IN (SELECT id FROM exam_types WHERE type = 'upse');
        """)
    )
    bind.execute(
        text("""
            DELETE FROM exam_types
            WHERE type = 'upse'
              AND EXISTS (SELECT 1 FROM exam_types WHERE type = 'upsc');
        """)
    )

    # 4. Ensure any remaining exams with NULL exam_type_id link to 'upsc'
    bind.execute(
        text("""
            UPDATE exams
            SET exam_type_id = (SELECT id FROM exam_types WHERE type = 'upsc' LIMIT 1)
            WHERE exam_type_id IS NULL;
        """)
    )


def downgrade() -> None:
    pass
