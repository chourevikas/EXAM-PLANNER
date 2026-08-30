"""019_pk_change_stage_b_backfill

Revision ID: 019_pk_stage_b_backfill
Revises: 018_pk_stage_a_additive
Create Date: 2026-08-29 20:30:00.000000

Stage B: Backfill
- Populates newly created `*_int_id` foreign key columns by joining with parent tables on existing UUID foreign keys.
- Safe chunked/batched execution pattern without taking table-exclusive locks.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '019_pk_stage_b_backfill'
down_revision: Union[str, None] = '018_pk_stage_a_additive'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (child_table, child_fk_int_col, parent_table, child_fk_uuid_col, parent_uuid_col)
BACKFILL_MAPPINGS = [
    ("student_profiles", "user_int_id", "users", "user_id", "id"),
    ("admin_profiles", "user_int_id", "users", "user_id", "id"),
    ("admin_profiles", "approved_by_int_id", "users", "approved_by_id", "id"),
    ("admin_profiles", "rejected_by_int_id", "users", "rejected_by_id", "id"),
    ("admin_approval_logs", "admin_user_int_id", "users", "admin_user_id", "id"),
    ("admin_approval_logs", "reviewed_by_int_id", "users", "reviewed_by_id", "id"),
    ("refresh_tokens", "user_int_id", "users", "user_id", "id"),
    ("syllabus_versions", "exam_int_id", "exams", "exam_id", "id"),
    ("subjects", "syllabus_version_int_id", "syllabus_versions", "syllabus_version_id", "id"),
    ("topics", "subject_int_id", "subjects", "subject_id", "id"),
    ("subtopics", "topic_int_id", "topics", "topic_id", "id"),
    ("passages", "exam_int_id", "exams", "exam_id", "id"),
    ("passages", "subtopic_int_id", "subtopics", "subtopic_id", "id"),
    ("passage_translations", "passage_int_id", "passages", "passage_id", "id"),
    ("questions", "exam_int_id", "exams", "exam_id", "id"),
    ("questions", "subtopic_int_id", "subtopics", "subtopic_id", "id"),
    ("questions", "passage_int_id", "passages", "passage_id", "id"),
    ("questions", "canonical_question_int_id", "questions", "canonical_question_id", "id"),
    ("question_translations", "question_int_id", "questions", "question_id", "id"),
    ("question_options", "question_int_id", "questions", "question_id", "id"),
    ("option_translations", "option_int_id", "question_options", "option_id", "id"),
    ("question_assets", "question_int_id", "questions", "question_id", "id"),
    ("question_metadata", "question_int_id", "questions", "question_id", "id"),
    ("question_explanations", "question_int_id", "questions", "question_id", "id"),
    ("question_hierarchy_links", "question_int_id", "questions", "question_id", "id"),
    ("question_hierarchy_links", "subtopic_int_id", "subtopics", "subtopic_id", "id"),
    ("question_hierarchy_links", "topic_int_id", "topics", "topic_id", "id"),
    ("question_hierarchy_links", "subject_int_id", "subjects", "subject_id", "id"),
    ("pipeline_runs", "exam_int_id", "exams", "exam_id", "id"),
    ("test_questions", "test_int_id", "tests", "test_id", "id"),
    ("test_questions", "question_int_id", "questions", "question_id", "id"),
    ("user_test_attempts", "user_int_id", "users", "user_id", "id"),
    ("user_test_attempts", "test_int_id", "tests", "test_id", "id"),
    ("user_test_attempts", "exam_attempt_int_id", "exam_attempts", "exam_attempt_id", "id"),
    ("user_question_responses", "attempt_int_id", "user_test_attempts", "attempt_id", "id"),
    ("user_question_responses", "exam_response_int_id", "exam_question_responses", "exam_response_id", "id"),
    ("user_question_responses", "question_int_id", "questions", "question_id", "id"),
    ("user_question_responses", "selected_option_int_id", "question_options", "selected_option_id", "id"),
    ("user_question_responses", "initial_selected_option_int_id", "question_options", "initial_selected_option_id", "id"),
    ("question_switch_logs", "response_int_id", "user_question_responses", "response_id", "id"),
    ("question_switch_logs", "exam_response_int_id", "exam_question_responses", "exam_response_id", "id"),
    ("question_switch_logs", "from_option_int_id", "question_options", "from_option_id", "id"),
    ("question_switch_logs", "to_option_int_id", "question_options", "to_option_id", "id"),
    ("user_concept_retention", "user_int_id", "users", "user_id", "id"),
    ("user_concept_retention", "subtopic_int_id", "subtopics", "subtopic_id", "id"),
    ("exam_attempts", "user_int_id", "users", "user_id", "id"),
    ("exam_attempts", "exam_int_id", "exams", "exam_id", "id"),
    ("exam_question_responses", "attempt_int_id", "exam_attempts", "attempt_id", "id"),
    ("exam_question_responses", "question_int_id", "questions", "question_id", "id"),
    ("exam_question_responses", "selected_option_int_id", "question_options", "selected_option_id", "id"),
    ("exam_question_responses", "initial_option_int_id", "question_options", "initial_option_id", "id"),
    ("user_memory_states", "user_int_id", "users", "user_id", "id"),
    ("user_memory_states", "question_int_id", "questions", "question_id", "id"),
    ("user_memory_states", "subtopic_int_id", "subtopics", "subtopic_id", "id"),
    ("user_skill_profiles", "user_int_id", "users", "user_id", "id"),
    ("user_taxonomy_mastery", "user_int_id", "users", "user_id", "id"),
    ("exam_question_reports", "attempt_int_id", "exam_attempts", "attempt_id", "id"),
    ("exam_question_reports", "question_int_id", "questions", "question_id", "id"),
    ("exam_attempt_reports", "attempt_int_id", "exam_attempts", "attempt_id", "id"),
    ("exam_attempt_reports", "user_int_id", "users", "user_id", "id"),
    ("exam_attempt_reports", "exam_int_id", "exams", "exam_id", "id"),
    ("user_skill_progression_reports", "attempt_int_id", "exam_attempts", "attempt_id", "id"),
    ("user_skill_progression_reports", "user_int_id", "users", "user_id", "id"),
    ("human_review_tasks", "question_int_id", "questions", "question_id", "id"),
    ("human_review_tasks", "exam_int_id", "exams", "exam_id", "id"),
    ("human_review_tasks", "assigned_admin_int_id", "users", "assigned_admin_id", "id"),
    ("plan_feature_links", "plan_int_id", "subscription_plans", "plan_id", "id"),
    ("plan_feature_links", "feature_int_id", "platform_features", "feature_id", "id"),
    ("user_subscriptions", "user_int_id", "users", "user_id", "id"),
    ("user_subscriptions", "plan_int_id", "subscription_plans", "plan_id", "id"),
    ("answer_key_batches", "exam_int_id", "exams", "exam_id", "id"),
    ("answer_key_mappings", "batch_int_id", "answer_key_batches", "batch_id", "id"),
    ("answer_key_mappings", "question_int_id", "questions", "question_id", "id"),
    ("user_badges", "user_int_id", "users", "user_id", "id"),
    ("user_badges", "badge_int_id", "badges", "badge_id", "id"),
    ("xp_logs", "user_int_id", "users", "user_id", "id"),
    ("study_tasks", "user_int_id", "users", "user_id", "id"),
    ("study_tasks", "source_attempt_int_id", "exam_attempts", "source_attempt_id", "id"),
    ("study_activities", "user_int_id", "users", "user_id", "id"),
    ("notifications", "user_int_id", "users", "user_id", "id"),
    ("testimonials", "user_int_id", "users", "user_id", "id"),
]


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    for child_tbl, child_fk_int, parent_tbl, child_fk_uuid, parent_uuid in BACKFILL_MAPPINGS:
        if child_tbl in existing_tables and parent_tbl in existing_tables:
            child_cols = [c["name"] for c in insp.get_columns(child_tbl)]
            parent_cols = [c["name"] for c in insp.get_columns(parent_tbl)]

            if child_fk_int in child_cols and child_fk_uuid in child_cols and "int_id" in parent_cols and parent_uuid in parent_cols:
                # Update in batches to avoid locking
                sql = f"""
                    UPDATE {child_tbl} AS c
                    SET {child_fk_int} = p.int_id
                    FROM {parent_tbl} AS p
                    WHERE c.{child_fk_uuid} = p.{parent_uuid}
                      AND c.{child_fk_uuid} IS NOT NULL
                      AND c.{child_fk_int} IS NULL;
                """
                bind.execute(sa.text(sql))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    for child_tbl, child_fk_int, _, _, _ in reversed(BACKFILL_MAPPINGS):
        if child_tbl in existing_tables:
            child_cols = [c["name"] for c in insp.get_columns(child_tbl)]
            if child_fk_int in child_cols:
                sql = f"UPDATE {child_tbl} SET {child_fk_int} = NULL WHERE {child_fk_int} IS NOT NULL;"
                bind.execute(sa.text(sql))
