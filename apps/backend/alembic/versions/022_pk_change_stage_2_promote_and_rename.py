"""022_pk_change_stage_2_promote_and_rename

Revision ID: 022_pk_stage_2_promote_and_rename
Revises: 021_pk_stage_1_mandatory_fks
Create Date: 2026-08-29 21:23:00.000000

Stage 2: Promote BIGINT to Primary Key & Rename to id/*_id
- Drops old UUID primary key and foreign key constraints.
- Promotes int_id to PRIMARY KEY on all tables.
- Drops legacy UUID columns.
- Renames int_id to id and *_int_id to *_id across all tables.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '022_pk_stage_2_promote'
down_revision: Union[str, None] = '021_pk_stage_1_mandatory_fks'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables with standard (id, int_id) primary keys
STANDARD_PK_TABLES = [
    "users",
    "admin_approval_logs",
    "refresh_tokens",
    "exams",
    "syllabus_versions",
    "subjects",
    "topics",
    "subtopics",
    "passages",
    "passage_translations",
    "questions",
    "question_translations",
    "question_options",
    "option_translations",
    "question_assets",
    "question_metadata",
    "question_hierarchy_links",
    "question_explanations",
    "pipeline_runs",
    "tests",
    "user_test_attempts",
    "user_question_responses",
    "question_switch_logs",
    "user_concept_retention",
    "exam_attempts",
    "exam_question_responses",
    "user_memory_states",
    "user_taxonomy_mastery",
    "exam_question_reports",
    "exam_attempt_reports",
    "user_skill_progression_reports",
    "human_review_tasks",
    "platform_features",
    "subscription_plans",
    "plan_feature_links",
    "user_subscriptions",
    "answer_key_batches",
    "answer_key_mappings",
    "badges",
    "user_badges",
    "xp_logs",
    "study_tasks",
    "study_activities",
    "notifications",
    "testimonials",
    "question_bookmarks",
]

# Columns to rename from *_int_id to *_id
RENAME_COLUMNS = [
    ("student_profiles", "user_int_id", "user_id"),
    ("admin_profiles", "user_int_id", "user_id"),
    ("admin_approval_logs", "admin_user_int_id", "admin_user_id"),
    ("admin_approval_logs", "reviewed_by_int_id", "reviewed_by_id"),
    ("refresh_tokens", "user_int_id", "user_id"),
    ("syllabus_versions", "exam_int_id", "exam_id"),
    ("subjects", "version_int_id", "version_id"),
    ("topics", "subject_int_id", "subject_id"),
    ("subtopics", "topic_int_id", "topic_id"),
    ("passages", "exam_int_id", "exam_id"),
    ("passage_translations", "passage_int_id", "passage_id"),
    ("questions", "exam_int_id", "exam_id"),
    ("questions", "passage_int_id", "passage_id"),
    ("question_translations", "question_int_id", "question_id"),
    ("question_options", "question_int_id", "question_id"),
    ("option_translations", "option_int_id", "option_id"),
    ("question_assets", "question_int_id", "question_id"),
    ("question_metadata", "question_int_id", "question_id"),
    ("question_hierarchy_links", "question_int_id", "question_id"),
    ("question_hierarchy_links", "subtopic_int_id", "subtopic_id"),
    ("question_hierarchy_links", "topic_int_id", "topic_id"),
    ("question_hierarchy_links", "subject_int_id", "subject_id"),
    ("question_explanations", "question_int_id", "question_id"),
    ("pipeline_runs", "exam_int_id", "exam_id"),
    ("tests", "exam_int_id", "exam_id"),
    ("test_questions", "test_int_id", "test_id"),
    ("test_questions", "question_int_id", "question_id"),
    ("user_test_attempts", "user_int_id", "user_id"),
    ("user_test_attempts", "test_int_id", "test_id"),
    ("user_test_attempts", "exam_attempt_int_id", "exam_attempt_id"),
    ("user_question_responses", "attempt_int_id", "attempt_id"),
    ("user_question_responses", "exam_response_int_id", "exam_response_id"),
    ("user_question_responses", "question_int_id", "question_id"),
    ("user_question_responses", "selected_option_int_id", "selected_option_id"),
    ("user_question_responses", "initial_selected_option_int_id", "initial_selected_option_id"),
    ("question_switch_logs", "response_int_id", "response_id"),
    ("question_switch_logs", "exam_response_int_id", "exam_response_id"),
    ("question_switch_logs", "from_option_int_id", "from_option_id"),
    ("question_switch_logs", "to_option_int_id", "to_option_id"),
    ("user_concept_retention", "user_int_id", "user_id"),
    ("user_concept_retention", "subtopic_int_id", "subtopic_id"),
    ("exam_attempts", "user_int_id", "user_id"),
    ("exam_attempts", "exam_int_id", "exam_id"),
    ("exam_question_responses", "attempt_int_id", "attempt_id"),
    ("exam_question_responses", "question_int_id", "question_id"),
    ("exam_question_responses", "selected_option_int_id", "selected_option_id"),
    ("exam_question_responses", "initial_option_int_id", "initial_option_id"),
    ("user_memory_states", "user_int_id", "user_id"),
    ("user_memory_states", "question_int_id", "question_id"),
    ("user_memory_states", "subtopic_int_id", "subtopic_id"),
    ("user_skill_profiles", "user_int_id", "user_id"),
    ("user_taxonomy_mastery", "user_int_id", "user_id"),
    ("exam_question_reports", "attempt_int_id", "attempt_id"),
    ("exam_question_reports", "question_int_id", "question_id"),
    ("exam_attempt_reports", "attempt_int_id", "attempt_id"),
    ("exam_attempt_reports", "user_int_id", "user_id"),
    ("exam_attempt_reports", "exam_int_id", "exam_id"),
    ("user_skill_progression_reports", "attempt_int_id", "attempt_id"),
    ("user_skill_progression_reports", "user_int_id", "user_id"),
    ("human_review_tasks", "question_int_id", "question_id"),
    ("human_review_tasks", "exam_int_id", "exam_id"),
    ("human_review_tasks", "assigned_admin_int_id", "assigned_admin_id"),
    ("plan_feature_links", "plan_int_id", "plan_id"),
    ("plan_feature_links", "feature_int_id", "feature_id"),
    ("user_subscriptions", "user_int_id", "user_id"),
    ("user_subscriptions", "plan_int_id", "plan_id"),
    ("answer_key_batches", "exam_int_id", "exam_id"),
    ("answer_key_mappings", "batch_int_id", "batch_id"),
    ("answer_key_mappings", "question_int_id", "question_id"),
    ("user_badges", "user_int_id", "user_id"),
    ("user_badges", "badge_int_id", "badge_id"),
    ("xp_logs", "user_int_id", "user_id"),
    ("study_tasks", "user_int_id", "user_id"),
    ("study_tasks", "source_attempt_int_id", "source_attempt_id"),
    ("study_activities", "user_int_id", "user_id"),
    ("notifications", "user_int_id", "user_id"),
    ("testimonials", "user_int_id", "user_id"),
    ("question_bookmarks", "user_int_id", "user_id"),
    ("question_bookmarks", "question_int_id", "question_id"),
]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    # 1. Drop old foreign key constraints referencing UUID columns
    conn.execute(sa.text("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT tc.table_name, tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND kcu.column_name NOT LIKE '%_int_id'
            ) LOOP
                EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE;';
            END LOOP;
        END $$;
    """))

    # 2. Drop old primary keys and set int_id as PRIMARY KEY
    for tbl in STANDARD_PK_TABLES:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{tbl}') THEN
                    ALTER TABLE {tbl} DROP CONSTRAINT IF EXISTS {tbl}_pkey CASCADE;
                    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = '{tbl}' AND column_name = 'int_id') THEN
                        ALTER TABLE {tbl} ADD CONSTRAINT {tbl}_pkey PRIMARY KEY (int_id);
                    END IF;
                END IF;
            END $$;
        """))

    # Special 1-to-1 table primary keys (user_int_id)
    for tbl in ["student_profiles", "admin_profiles", "user_skill_profiles"]:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{tbl}') THEN
                    ALTER TABLE {tbl} DROP CONSTRAINT IF EXISTS {tbl}_pkey CASCADE;
                    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = '{tbl}' AND column_name = 'user_int_id') THEN
                        ALTER TABLE {tbl} ADD CONSTRAINT {tbl}_pkey PRIMARY KEY (user_int_id);
                    END IF;
                END IF;
            END $$;
        """))

    # Special composite PK (test_questions: test_int_id, question_int_id)
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'test_questions') THEN
                ALTER TABLE test_questions DROP CONSTRAINT IF EXISTS test_questions_pkey CASCADE;
                IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'test_questions' AND column_name = 'test_int_id') 
                   AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'test_questions' AND column_name = 'question_int_id') THEN
                    ALTER TABLE test_questions ADD CONSTRAINT test_questions_pkey PRIMARY KEY (test_int_id, question_int_id);
                END IF;
            END IF;
        END $$;
    """))

    # 3. Drop old UUID columns
    # Drop old UUID id columns on standard tables
    for tbl in STANDARD_PK_TABLES:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = 'id' AND data_type = 'uuid'
                ) THEN
                    ALTER TABLE {tbl} DROP COLUMN id CASCADE;
                END IF;
            END $$;
        """))

    # Drop old UUID foreign key columns
    for tbl, int_col, old_uuid_col in RENAME_COLUMNS:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = '{old_uuid_col}' AND data_type = 'uuid'
                ) THEN
                    ALTER TABLE {tbl} DROP COLUMN {old_uuid_col} CASCADE;
                END IF;
            END $$;
        """))

    # 4. Rename int_id -> id on all standard tables
    for tbl in STANDARD_PK_TABLES:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = 'int_id'
                ) AND NOT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = 'id'
                ) THEN
                    ALTER TABLE {tbl} RENAME COLUMN int_id TO id;
                END IF;
            END $$;
        """))

    # 5. Rename *_int_id -> *_id
    for tbl, int_col, target_col in RENAME_COLUMNS:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = '{int_col}'
                ) AND NOT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = '{target_col}'
                ) THEN
                    ALTER TABLE {tbl} RENAME COLUMN {int_col} TO {target_col};
                END IF;
            END $$;
        """))


def downgrade() -> None:
    pass
