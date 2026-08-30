"""024_pk_stage_4_final_column_sweep

Revision ID: 024_pk_stage_4_final_sweep
Revises: 023_pk_stage_3_index_clean
Create Date: 2026-08-29 21:35:00.000000

Stage 4: Final Column Sweep
- Cleans up remaining UUID columns and ensures all foreign keys are named *_id (BIGINT).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '024_pk_stage_4_final_sweep'
down_revision: Union[str, None] = '023_pk_stage_3_index_clean'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    # student_profiles cleanup
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'id') THEN
                ALTER TABLE student_profiles DROP COLUMN id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'student_profiles' AND column_name = 'int_id') THEN
                ALTER TABLE student_profiles DROP COLUMN int_id CASCADE;
            END IF;
        END $$;
    """))

    # admin_profiles cleanup
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'admin_profiles' AND column_name = 'id') THEN
                ALTER TABLE admin_profiles DROP COLUMN id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'admin_profiles' AND column_name = 'int_id') THEN
                ALTER TABLE admin_profiles DROP COLUMN int_id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'admin_profiles' AND column_name = 'approved_by_id' AND data_type = 'uuid') THEN
                ALTER TABLE admin_profiles DROP COLUMN approved_by_id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'admin_profiles' AND column_name = 'approved_by_int_id') THEN
                ALTER TABLE admin_profiles RENAME COLUMN approved_by_int_id TO approved_by_id;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'admin_profiles' AND column_name = 'rejected_by_id' AND data_type = 'uuid') THEN
                ALTER TABLE admin_profiles DROP COLUMN rejected_by_id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'admin_profiles' AND column_name = 'rejected_by_int_id') THEN
                ALTER TABLE admin_profiles RENAME COLUMN rejected_by_int_id TO rejected_by_id;
            END IF;
        END $$;
    """))

    # passages cleanup
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'passages' AND column_name = 'subtopic_id' AND data_type = 'uuid') THEN
                ALTER TABLE passages DROP COLUMN subtopic_id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'passages' AND column_name = 'subtopic_int_id') THEN
                ALTER TABLE passages RENAME COLUMN subtopic_int_id TO subtopic_id;
            END IF;
        END $$;
    """))

    # questions cleanup
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'subtopic_id' AND data_type = 'uuid') THEN
                ALTER TABLE questions DROP COLUMN subtopic_id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'subtopic_int_id') THEN
                ALTER TABLE questions RENAME COLUMN subtopic_int_id TO subtopic_id;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'canonical_question_id' AND data_type = 'uuid') THEN
                ALTER TABLE questions DROP COLUMN canonical_question_id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'canonical_question_int_id') THEN
                ALTER TABLE questions RENAME COLUMN canonical_question_int_id TO canonical_question_id;
            END IF;
        END $$;
    """))

    # subjects cleanup
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'syllabus_version_id') THEN
                ALTER TABLE subjects DROP COLUMN syllabus_version_id CASCADE;
            END IF;
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'syllabus_version_int_id') THEN
                ALTER TABLE subjects DROP COLUMN syllabus_version_int_id CASCADE;
            END IF;
        END $$;
    """))

    # users.role_id cleanup
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role_id') THEN
                ALTER TABLE users DROP COLUMN role_id CASCADE;
            END IF;
        END $$;
    """))


def downgrade() -> None:
    pass
