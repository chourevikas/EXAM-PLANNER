"""020_pk_change_stage_c_constrain

Revision ID: 020_pk_stage_c_constrain
Revises: 019_pk_stage_b_backfill
Create Date: 2026-08-29 20:35:00.000000

Stage C: Constrain & Index
- Creates supporting indexes on all new `*_int_id` columns concurrently.
- Creates unique indexes on `int_id` columns across primary tables.
- Adds foreign key constraints with `NOT VALID` and validates them without long table locks.
- Adds supporting indexes for previously unindexed foreign keys.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '020_pk_stage_c_constrain'
down_revision: Union[str, None] = '019_pk_stage_b_backfill'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables where int_id must have a UNIQUE index / constraint
UNIQUE_INT_ID_TABLES = [
    "users",
    "student_profiles",
    "admin_profiles",
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
    "question_explanations",
    "question_hierarchy_links",
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
]

# (child_table, fk_col, parent_table, parent_col, constraint_name, ondelete)
FK_CONSTRAINTS = [
    ("student_profiles", "user_int_id", "users", "int_id", "fk_student_profiles_user_int_id", "CASCADE"),
    ("admin_profiles", "user_int_id", "users", "int_id", "fk_admin_profiles_user_int_id", "CASCADE"),
    ("admin_profiles", "approved_by_int_id", "users", "int_id", "fk_admin_profiles_approved_by_int_id", "SET NULL"),
    ("admin_profiles", "rejected_by_int_id", "users", "int_id", "fk_admin_profiles_rejected_by_int_id", "SET NULL"),
    ("admin_approval_logs", "admin_user_int_id", "users", "int_id", "fk_admin_approval_logs_admin_user_int_id", "CASCADE"),
    ("admin_approval_logs", "reviewed_by_int_id", "users", "int_id", "fk_admin_approval_logs_reviewed_by_int_id", "SET NULL"),
    ("refresh_tokens", "user_int_id", "users", "int_id", "fk_refresh_tokens_user_int_id", "CASCADE"),
    ("syllabus_versions", "exam_int_id", "exams", "int_id", "fk_syllabus_versions_exam_int_id", "CASCADE"),
    ("subjects", "syllabus_version_int_id", "syllabus_versions", "int_id", "fk_subjects_syllabus_version_int_id", "CASCADE"),
    ("topics", "subject_int_id", "subjects", "int_id", "fk_topics_subject_int_id", "CASCADE"),
    ("subtopics", "topic_int_id", "topics", "int_id", "fk_subtopics_topic_int_id", "CASCADE"),
    ("passages", "exam_int_id", "exams", "int_id", "fk_passages_exam_int_id", "CASCADE"),
    ("passages", "subtopic_int_id", "subtopics", "int_id", "fk_passages_subtopic_int_id", "SET NULL"),
    ("passage_translations", "passage_int_id", "passages", "int_id", "fk_passage_trans_passage_int_id", "CASCADE"),
    ("questions", "exam_int_id", "exams", "int_id", "fk_questions_exam_int_id", "CASCADE"),
    ("questions", "subtopic_int_id", "subtopics", "int_id", "fk_questions_subtopic_int_id", "SET NULL"),
    ("questions", "passage_int_id", "passages", "int_id", "fk_questions_passage_int_id", "SET NULL"),
    ("questions", "canonical_question_int_id", "questions", "int_id", "fk_questions_canonical_q_int_id", "SET NULL"),
    ("question_translations", "question_int_id", "questions", "int_id", "fk_question_trans_q_int_id", "CASCADE"),
    ("question_options", "question_int_id", "questions", "int_id", "fk_question_options_q_int_id", "CASCADE"),
    ("option_translations", "option_int_id", "question_options", "int_id", "fk_opt_trans_option_int_id", "CASCADE"),
    ("question_assets", "question_int_id", "questions", "int_id", "fk_question_assets_q_int_id", "CASCADE"),
    ("question_metadata", "question_int_id", "questions", "int_id", "fk_question_metadata_q_int_id", "CASCADE"),
    ("question_explanations", "question_int_id", "questions", "int_id", "fk_question_expl_q_int_id", "CASCADE"),
    ("question_hierarchy_links", "question_int_id", "questions", "int_id", "fk_qhl_question_int_id", "CASCADE"),
    ("question_hierarchy_links", "subtopic_int_id", "subtopics", "int_id", "fk_qhl_subtopic_int_id", "CASCADE"),
    ("question_hierarchy_links", "topic_int_id", "topics", "int_id", "fk_qhl_topic_int_id", "CASCADE"),
    ("question_hierarchy_links", "subject_int_id", "subjects", "int_id", "fk_qhl_subject_int_id", "CASCADE"),
    ("pipeline_runs", "exam_int_id", "exams", "int_id", "fk_pipeline_runs_exam_int_id", "CASCADE"),
    ("test_questions", "test_int_id", "tests", "int_id", "fk_test_questions_test_int_id", "CASCADE"),
    ("test_questions", "question_int_id", "questions", "int_id", "fk_test_questions_question_int_id", "CASCADE"),
    ("user_test_attempts", "user_int_id", "users", "int_id", "fk_user_test_attempts_user_int_id", "CASCADE"),
    ("user_test_attempts", "test_int_id", "tests", "int_id", "fk_user_test_attempts_test_int_id", "SET NULL"),
    ("user_test_attempts", "exam_attempt_int_id", "exam_attempts", "int_id", "fk_user_test_attempts_exam_att_int_id", "CASCADE"),
    ("user_question_responses", "attempt_int_id", "user_test_attempts", "int_id", "fk_uqr_attempt_int_id", "CASCADE"),
    ("user_question_responses", "exam_response_int_id", "exam_question_responses", "int_id", "fk_uqr_exam_resp_int_id", "CASCADE"),
    ("user_question_responses", "question_int_id", "questions", "int_id", "fk_uqr_question_int_id", "CASCADE"),
    ("user_question_responses", "selected_option_int_id", "question_options", "int_id", "fk_uqr_selected_opt_int_id", "SET NULL"),
    ("user_question_responses", "initial_selected_option_int_id", "question_options", "int_id", "fk_uqr_initial_opt_int_id", "SET NULL"),
    ("question_switch_logs", "response_int_id", "user_question_responses", "int_id", "fk_qsl_response_int_id", "CASCADE"),
    ("question_switch_logs", "exam_response_int_id", "exam_question_responses", "int_id", "fk_qsl_exam_resp_int_id", "CASCADE"),
    ("question_switch_logs", "from_option_int_id", "question_options", "int_id", "fk_qsl_from_opt_int_id", "SET NULL"),
    ("question_switch_logs", "to_option_int_id", "question_options", "int_id", "fk_qsl_to_opt_int_id", "SET NULL"),
    ("user_concept_retention", "user_int_id", "users", "int_id", "fk_u_retention_user_int_id", "CASCADE"),
    ("user_concept_retention", "subtopic_int_id", "subtopics", "int_id", "fk_u_retention_subtopic_int_id", "CASCADE"),
    ("exam_attempts", "user_int_id", "users", "int_id", "fk_exam_attempts_user_int_id", "CASCADE"),
    ("exam_attempts", "exam_int_id", "exams", "int_id", "fk_exam_attempts_exam_int_id", "CASCADE"),
    ("exam_question_responses", "attempt_int_id", "exam_attempts", "int_id", "fk_eqr_attempt_int_id", "CASCADE"),
    ("exam_question_responses", "question_int_id", "questions", "int_id", "fk_eqr_question_int_id", "CASCADE"),
    ("exam_question_responses", "selected_option_int_id", "question_options", "int_id", "fk_eqr_selected_opt_int_id", "SET NULL"),
    ("exam_question_responses", "initial_option_int_id", "question_options", "int_id", "fk_eqr_initial_opt_int_id", "SET NULL"),
    ("user_memory_states", "user_int_id", "users", "int_id", "fk_user_mem_user_int_id", "CASCADE"),
    ("user_memory_states", "question_int_id", "questions", "int_id", "fk_user_mem_q_int_id", "CASCADE"),
    ("user_memory_states", "subtopic_int_id", "subtopics", "int_id", "fk_user_mem_subtopic_int_id", "CASCADE"),
    ("user_skill_profiles", "user_int_id", "users", "int_id", "fk_user_skill_user_int_id", "CASCADE"),
    ("user_taxonomy_mastery", "user_int_id", "users", "int_id", "fk_user_tax_mastery_user_int_id", "CASCADE"),
    ("exam_question_reports", "attempt_int_id", "exam_attempts", "int_id", "fk_eq_rep_attempt_int_id", "CASCADE"),
    ("exam_question_reports", "question_int_id", "questions", "int_id", "fk_eq_rep_q_int_id", "CASCADE"),
    ("exam_attempt_reports", "attempt_int_id", "exam_attempts", "int_id", "fk_att_rep_attempt_int_id", "CASCADE"),
    ("exam_attempt_reports", "user_int_id", "users", "int_id", "fk_att_rep_user_int_id", "CASCADE"),
    ("exam_attempt_reports", "exam_int_id", "exams", "int_id", "fk_att_rep_exam_int_id", "CASCADE"),
    ("user_skill_progression_reports", "attempt_int_id", "exam_attempts", "int_id", "fk_skill_prog_attempt_int_id", "CASCADE"),
    ("user_skill_progression_reports", "user_int_id", "users", "int_id", "fk_skill_prog_user_int_id", "CASCADE"),
    ("human_review_tasks", "question_int_id", "questions", "int_id", "fk_hrt_q_int_id", "CASCADE"),
    ("human_review_tasks", "exam_int_id", "exams", "int_id", "fk_hrt_exam_int_id", "CASCADE"),
    ("human_review_tasks", "assigned_admin_int_id", "users", "int_id", "fk_hrt_assigned_admin_int_id", "SET NULL"),
    ("plan_feature_links", "plan_int_id", "subscription_plans", "int_id", "fk_pfl_plan_int_id", "CASCADE"),
    ("plan_feature_links", "feature_int_id", "platform_features", "int_id", "fk_pfl_feature_int_id", "CASCADE"),
    ("user_subscriptions", "user_int_id", "users", "int_id", "fk_user_subs_user_int_id", "CASCADE"),
    ("user_subscriptions", "plan_int_id", "subscription_plans", "int_id", "fk_user_subs_plan_int_id", "CASCADE"),
    ("answer_key_batches", "exam_int_id", "exams", "int_id", "fk_akb_exam_int_id", "CASCADE"),
    ("answer_key_mappings", "batch_int_id", "answer_key_batches", "int_id", "fk_akm_batch_int_id", "CASCADE"),
    ("answer_key_mappings", "question_int_id", "questions", "int_id", "fk_akm_question_int_id", "CASCADE"),
    ("user_badges", "user_int_id", "users", "int_id", "fk_user_badges_user_int_id", "CASCADE"),
    ("user_badges", "badge_int_id", "badges", "int_id", "fk_user_badges_badge_int_id", "CASCADE"),
    ("xp_logs", "user_int_id", "users", "int_id", "fk_xp_logs_user_int_id", "CASCADE"),
    ("study_tasks", "user_int_id", "users", "int_id", "fk_study_tasks_user_int_id", "CASCADE"),
    ("study_tasks", "source_attempt_int_id", "exam_attempts", "int_id", "fk_study_tasks_source_att_int_id", "SET NULL"),
    ("study_activities", "user_int_id", "users", "int_id", "fk_study_activities_user_int_id", "CASCADE"),
    ("notifications", "user_int_id", "users", "int_id", "fk_notifications_user_int_id", "CASCADE"),
    ("testimonials", "user_int_id", "users", "int_id", "fk_testimonials_user_int_id", "CASCADE"),
]

# Indexes to create on FK columns: (table_name, col_name, index_name)
FK_INDEXES = [
    (child_tbl, fk_col, f"ix_{child_tbl}_{fk_col}")
    for child_tbl, fk_col, _, _, _, _ in FK_CONSTRAINTS
]


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    # 1. Unique index on int_id for primary tables
    for tbl in UNIQUE_INT_ID_TABLES:
        if tbl in existing_tables:
            idx_name = f"ux_{tbl}_int_id"
            op.execute(sa.text(f"CREATE UNIQUE INDEX IF NOT EXISTS {idx_name} ON {tbl} (int_id);"))

    # 2. Indexes on FK columns
    for tbl, col_name, idx_name in FK_INDEXES:
        if tbl in existing_tables:
            op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tbl} ({col_name});"))

    # 3. Add FK constraints with NOT VALID and validate
    for child_tbl, fk_col, parent_tbl, parent_col, constraint_name, ondelete in FK_CONSTRAINTS:
        if child_tbl in existing_tables and parent_tbl in existing_tables:
            op.execute(sa.text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{constraint_name}') THEN
                        ALTER TABLE {child_tbl}
                        ADD CONSTRAINT {constraint_name}
                        FOREIGN KEY ({fk_col}) REFERENCES {parent_tbl}({parent_col})
                        ON DELETE {ondelete}
                        NOT VALID;
                    END IF;
                END $$;
            """))
            op.execute(sa.text(f"ALTER TABLE {child_tbl} VALIDATE CONSTRAINT {constraint_name};"))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    # 1. Drop FK constraints
    for child_tbl, _, _, _, constraint_name, _ in reversed(FK_CONSTRAINTS):
        if child_tbl in existing_tables:
            op.execute(sa.text(f"ALTER TABLE {child_tbl} DROP CONSTRAINT IF EXISTS {constraint_name};"))

    # 2. Drop FK indexes
    for tbl, _, idx_name in reversed(FK_INDEXES):
        if tbl in existing_tables:
            op.execute(sa.text(f"DROP INDEX IF EXISTS {idx_name};"))

    # 3. Drop Unique indexes on int_id
    for tbl in reversed(UNIQUE_INT_ID_TABLES):
        if tbl in existing_tables:
            idx_name = f"ux_{tbl}_int_id"
            op.execute(sa.text(f"DROP INDEX IF EXISTS {idx_name};"))
