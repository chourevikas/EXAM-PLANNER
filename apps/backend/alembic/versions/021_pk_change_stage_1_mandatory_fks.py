"""021_pk_change_stage_1_mandatory_fks

Revision ID: 021_pk_stage_1_mandatory_fks
Revises: 020_pk_stage_c_constrain
Create Date: 2026-08-29 21:20:00.000000

Stage 1: Make integer FKs mandatory and correct (fixes insert drift)
- Backfills any remaining NULL *_int_id columns across child tables.
- Applies NOT NULL constraints to mandatory integer FK columns.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '021_pk_stage_1_mandatory_fks'
down_revision: Union[str, None] = '020_pk_stage_c_constrain'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# List of (child_table, fk_col, parent_table, parent_pk_col) for backfilling
BACKFILL_MAP = [
    # question_bookmarks
    ("question_bookmarks", "user_int_id", "users", "user_id"),
    ("question_bookmarks", "question_int_id", "questions", "question_id"),
    # Student / Admin / Refresh tokens
    ("student_profiles", "user_int_id", "users", "user_id"),
    ("admin_profiles", "user_int_id", "users", "user_id"),
    ("admin_approval_logs", "admin_user_int_id", "users", "admin_user_id"),
    ("admin_approval_logs", "reviewed_by_int_id", "users", "reviewed_by_id"),
    ("refresh_tokens", "user_int_id", "users", "user_id"),
    # Hierarchy
    ("syllabus_versions", "exam_int_id", "exams", "exam_id"),
    ("subjects", "version_int_id", "syllabus_versions", "version_id"),
    ("topics", "subject_int_id", "subjects", "subject_id"),
    ("subtopics", "topic_int_id", "topics", "topic_id"),
    # Questions & Content
    ("passages", "exam_int_id", "exams", "exam_id"),
    ("passage_translations", "passage_int_id", "passages", "passage_id"),
    ("questions", "passage_int_id", "passages", "passage_id"),
    ("questions", "exam_int_id", "exams", "exam_id"),
    ("question_translations", "question_int_id", "questions", "question_id"),
    ("question_options", "question_int_id", "questions", "question_id"),
    ("option_translations", "option_int_id", "question_options", "option_id"),
    ("question_assets", "question_int_id", "questions", "question_id"),
    ("question_metadata", "question_int_id", "questions", "question_id"),
    ("question_hierarchy_links", "question_int_id", "questions", "question_id"),
    ("question_hierarchy_links", "subtopic_int_id", "subtopics", "subtopic_id"),
    ("question_hierarchy_links", "topic_int_id", "topics", "topic_id"),
    ("question_hierarchy_links", "subject_int_id", "subjects", "subject_id"),
    ("question_explanations", "question_int_id", "questions", "question_id"),
    ("pipeline_runs", "exam_int_id", "exams", "exam_id"),
    # Telemetry & Testing
    ("tests", "exam_int_id", "exams", "exam_id"),
    ("test_questions", "test_int_id", "tests", "test_id"),
    ("test_questions", "question_int_id", "questions", "question_id"),
    ("user_test_attempts", "user_int_id", "users", "user_id"),
    ("user_test_attempts", "test_int_id", "tests", "test_id"),
    ("user_test_attempts", "exam_attempt_int_id", "exam_attempts", "exam_attempt_id"),
    ("user_question_responses", "attempt_int_id", "user_test_attempts", "attempt_id"),
    ("user_question_responses", "exam_response_int_id", "exam_question_responses", "exam_response_id"),
    ("user_question_responses", "question_int_id", "questions", "question_id"),
    ("user_question_responses", "selected_option_int_id", "question_options", "selected_option_id"),
    ("question_switch_logs", "response_int_id", "user_question_responses", "response_id"),
    ("question_switch_logs", "exam_response_int_id", "exam_question_responses", "exam_response_id"),
    ("user_concept_retention", "user_int_id", "users", "user_id"),
    ("user_concept_retention", "subtopic_int_id", "subtopics", "subtopic_id"),
    # Analytics & Reports
    ("exam_attempts", "user_int_id", "users", "user_id"),
    ("exam_attempts", "exam_int_id", "exams", "exam_id"),
    ("exam_question_responses", "attempt_int_id", "exam_attempts", "attempt_id"),
    ("exam_question_responses", "question_int_id", "questions", "question_id"),
    ("user_memory_states", "user_int_id", "users", "user_id"),
    ("user_memory_states", "question_int_id", "questions", "question_id"),
    ("user_memory_states", "subtopic_int_id", "subtopics", "subtopic_id"),
    ("user_skill_profiles", "user_int_id", "users", "user_id"),
    ("user_taxonomy_mastery", "user_int_id", "users", "user_id"),
    ("exam_question_reports", "attempt_int_id", "exam_attempts", "attempt_id"),
    ("exam_question_reports", "question_int_id", "questions", "question_id"),
    ("exam_attempt_reports", "attempt_int_id", "exam_attempts", "attempt_id"),
    ("exam_attempt_reports", "user_int_id", "users", "user_id"),
    ("exam_attempt_reports", "exam_int_id", "exams", "exam_id"),
    ("user_skill_progression_reports", "attempt_int_id", "exam_attempts", "attempt_id"),
    ("user_skill_progression_reports", "user_int_id", "users", "user_id"),
    ("human_review_tasks", "question_int_id", "questions", "question_id"),
    ("human_review_tasks", "exam_int_id", "exams", "exam_id"),
    ("human_review_tasks", "assigned_admin_int_id", "users", "assigned_admin_id"),
    # Subscriptions & Gamification
    ("plan_feature_links", "plan_int_id", "subscription_plans", "plan_id"),
    ("plan_feature_links", "feature_int_id", "platform_features", "feature_id"),
    ("user_subscriptions", "user_int_id", "users", "user_id"),
    ("user_subscriptions", "plan_int_id", "subscription_plans", "plan_id"),
    ("answer_key_batches", "exam_int_id", "exams", "exam_id"),
    ("answer_key_mappings", "batch_int_id", "answer_key_batches", "batch_id"),
    ("user_badges", "user_int_id", "users", "user_id"),
    ("user_badges", "badge_int_id", "badges", "badge_id"),
    ("xp_logs", "user_int_id", "users", "user_id"),
    ("study_tasks", "user_int_id", "users", "user_id"),
    ("study_activities", "user_int_id", "users", "user_id"),
    ("notifications", "user_int_id", "users", "user_id"),
    ("testimonials", "user_int_id", "users", "user_id"),
]

# Mandatory foreign key columns to set NOT NULL
MANDATORY_NOT_NULL_FKS = [
    ("student_profiles", "user_int_id"),
    ("admin_profiles", "user_int_id"),
    ("refresh_tokens", "user_int_id"),
    ("syllabus_versions", "exam_int_id"),
    ("subjects", "version_int_id"),
    ("topics", "subject_int_id"),
    ("subtopics", "topic_int_id"),
    ("passage_translations", "passage_int_id"),
    ("question_translations", "question_int_id"),
    ("question_options", "question_int_id"),
    ("option_translations", "option_int_id"),
    ("question_assets", "question_int_id"),
    ("question_metadata", "question_int_id"),
    ("question_hierarchy_links", "question_int_id"),
    ("question_hierarchy_links", "subtopic_int_id"),
    ("question_explanations", "question_int_id"),
    ("pipeline_runs", "exam_int_id"),
    ("test_questions", "test_int_id"),
    ("test_questions", "question_int_id"),
    ("user_test_attempts", "user_int_id"),
    ("user_test_attempts", "test_int_id"),
    ("user_question_responses", "attempt_int_id"),
    ("user_question_responses", "question_int_id"),
    ("user_concept_retention", "user_int_id"),
    ("user_concept_retention", "subtopic_int_id"),
    ("exam_attempts", "user_int_id"),
    ("exam_attempts", "exam_int_id"),
    ("exam_question_responses", "attempt_int_id"),
    ("exam_question_responses", "question_int_id"),
    ("user_memory_states", "user_int_id"),
    ("user_skill_profiles", "user_int_id"),
    ("user_taxonomy_mastery", "user_int_id"),
    ("exam_question_reports", "attempt_int_id"),
    ("exam_question_reports", "question_int_id"),
    ("exam_attempt_reports", "attempt_int_id"),
    ("exam_attempt_reports", "user_int_id"),
    ("exam_attempt_reports", "exam_int_id"),
    ("user_skill_progression_reports", "attempt_int_id"),
    ("user_skill_progression_reports", "user_int_id"),
    ("human_review_tasks", "question_int_id"),
    ("human_review_tasks", "exam_int_id"),
    ("plan_feature_links", "plan_int_id"),
    ("plan_feature_links", "feature_int_id"),
    ("user_subscriptions", "user_int_id"),
    ("user_subscriptions", "plan_int_id"),
    ("answer_key_batches", "exam_int_id"),
    ("answer_key_mappings", "batch_int_id"),
    ("user_badges", "user_int_id"),
    ("user_badges", "badge_int_id"),
    ("xp_logs", "user_int_id"),
    ("study_tasks", "user_int_id"),
    ("study_activities", "user_int_id"),
    ("notifications", "user_int_id"),
]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    # Ensure question_bookmarks has int_id and *_int_id if not present
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'question_bookmarks') THEN
                IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'question_bookmarks' AND column_name = 'int_id') THEN
                    ALTER TABLE question_bookmarks ADD COLUMN int_id BIGINT GENERATED ALWAYS AS IDENTITY;
                END IF;
                IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'question_bookmarks' AND column_name = 'user_int_id') THEN
                    ALTER TABLE question_bookmarks ADD COLUMN user_int_id BIGINT;
                END IF;
                IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'question_bookmarks' AND column_name = 'question_int_id') THEN
                    ALTER TABLE question_bookmarks ADD COLUMN question_int_id BIGINT;
                END IF;
            END IF;
        END $$;
    """))

    # Backfill all child tables
    for child_tbl, child_int_col, parent_tbl, child_uuid_col in BACKFILL_MAP:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{child_tbl}' AND column_name = '{child_int_col}'
                ) AND EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{child_tbl}' AND column_name = '{child_uuid_col}'
                ) AND EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{parent_tbl}' AND column_name = 'int_id'
                ) THEN
                    UPDATE {child_tbl} c
                    SET {child_int_col} = p.int_id
                    FROM {parent_tbl} p
                    WHERE c.{child_uuid_col} = p.id
                      AND c.{child_int_col} IS NULL
                      AND c.{child_uuid_col} IS NOT NULL;
                END IF;
            END $$;
        """))

    # Apply NOT NULL constraints to mandatory foreign key columns
    for tbl, col_name in MANDATORY_NOT_NULL_FKS:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = '{col_name}' AND is_nullable = 'YES'
                ) THEN
                    -- Delete or handle orphaned rows if any before applying NOT NULL
                    DELETE FROM {tbl} WHERE {col_name} IS NULL;
                    ALTER TABLE {tbl} ALTER COLUMN {col_name} SET NOT NULL;
                END IF;
            END $$;
        """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    for tbl, col_name in MANDATORY_NOT_NULL_FKS:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = '{tbl}' AND column_name = '{col_name}' AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE {tbl} ALTER COLUMN {col_name} DROP NOT NULL;
                END IF;
            END $$;
        """))
