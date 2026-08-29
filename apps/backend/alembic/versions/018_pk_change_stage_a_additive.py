"""018_pk_change_stage_a_additive

Revision ID: 018_pk_stage_a_additive
Revises: 017_notifications_timestamptz
Create Date: 2026-08-29 20:25:00.000000

Stage A: Additive
- Adds new `int_id` BIGINT identity columns alongside existing UUID PKs.
- Adds new `*_int_id` BIGINT nullable foreign key columns alongside existing UUID FKs.
- No existing columns are dropped or renamed.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '018_pk_stage_a_additive'
down_revision: Union[str, None] = '017_notifications_timestamptz'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables requiring int_id identity PK
TABLES_WITH_INT_ID_PK = [
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

# (table_name, column_name)
FK_COLUMNS_TO_ADD = [
    ("student_profiles", "user_int_id"),
    ("admin_profiles", "user_int_id"),
    ("admin_profiles", "approved_by_int_id"),
    ("admin_profiles", "rejected_by_int_id"),
    ("admin_approval_logs", "admin_user_int_id"),
    ("admin_approval_logs", "reviewed_by_int_id"),
    ("refresh_tokens", "user_int_id"),
    ("syllabus_versions", "exam_int_id"),
    ("subjects", "syllabus_version_int_id"),
    ("topics", "subject_int_id"),
    ("subtopics", "topic_int_id"),
    ("passages", "exam_int_id"),
    ("passages", "subtopic_int_id"),
    ("passage_translations", "passage_int_id"),
    ("questions", "exam_int_id"),
    ("questions", "subtopic_int_id"),
    ("questions", "passage_int_id"),
    ("questions", "canonical_question_int_id"),
    ("question_translations", "question_int_id"),
    ("question_options", "question_int_id"),
    ("option_translations", "option_int_id"),
    ("question_assets", "question_int_id"),
    ("question_metadata", "question_int_id"),
    ("question_explanations", "question_int_id"),
    ("question_hierarchy_links", "question_int_id"),
    ("question_hierarchy_links", "subtopic_int_id"),
    ("question_hierarchy_links", "topic_int_id"),
    ("question_hierarchy_links", "subject_int_id"),
    ("pipeline_runs", "exam_int_id"),
    ("test_questions", "test_int_id"),
    ("test_questions", "question_int_id"),
    ("user_test_attempts", "user_int_id"),
    ("user_test_attempts", "test_int_id"),
    ("user_test_attempts", "exam_attempt_int_id"),
    ("user_question_responses", "attempt_int_id"),
    ("user_question_responses", "exam_response_int_id"),
    ("user_question_responses", "question_int_id"),
    ("user_question_responses", "selected_option_int_id"),
    ("user_question_responses", "initial_selected_option_int_id"),
    ("question_switch_logs", "response_int_id"),
    ("question_switch_logs", "exam_response_int_id"),
    ("question_switch_logs", "from_option_int_id"),
    ("question_switch_logs", "to_option_int_id"),
    ("user_concept_retention", "user_int_id"),
    ("user_concept_retention", "subtopic_int_id"),
    ("exam_attempts", "user_int_id"),
    ("exam_attempts", "exam_int_id"),
    ("exam_question_responses", "attempt_int_id"),
    ("exam_question_responses", "question_int_id"),
    ("exam_question_responses", "selected_option_int_id"),
    ("exam_question_responses", "initial_option_int_id"),
    ("user_memory_states", "user_int_id"),
    ("user_memory_states", "question_int_id"),
    ("user_memory_states", "subtopic_int_id"),
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
    ("human_review_tasks", "assigned_admin_int_id"),
    ("plan_feature_links", "plan_int_id"),
    ("plan_feature_links", "feature_int_id"),
    ("user_subscriptions", "user_int_id"),
    ("user_subscriptions", "plan_int_id"),
    ("answer_key_batches", "exam_int_id"),
    ("answer_key_mappings", "batch_int_id"),
    ("answer_key_mappings", "question_int_id"),
    ("user_badges", "user_int_id"),
    ("user_badges", "badge_int_id"),
    ("xp_logs", "user_int_id"),
    ("study_tasks", "user_int_id"),
    ("study_tasks", "source_attempt_int_id"),
    ("study_activities", "user_int_id"),
    ("notifications", "user_int_id"),
    ("testimonials", "user_int_id"),
]


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    # 1. Add int_id to primary tables
    for tbl in TABLES_WITH_INT_ID_PK:
        if tbl in existing_tables:
            cols = [c["name"] for c in insp.get_columns(tbl)]
            if "int_id" not in cols:
                op.add_column(
                    tbl,
                    sa.Column("int_id", sa.BigInteger(), sa.Identity(always=True), nullable=False)
                )

    # 2. Add nullable foreign key columns
    for tbl, col_name in FK_COLUMNS_TO_ADD:
        if tbl in existing_tables:
            cols = [c["name"] for c in insp.get_columns(tbl)]
            if col_name not in cols:
                op.add_column(
                    tbl,
                    sa.Column(col_name, sa.BigInteger(), nullable=True)
                )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    # 1. Drop FK columns
    for tbl, col_name in reversed(FK_COLUMNS_TO_ADD):
        if tbl in existing_tables:
            cols = [c["name"] for c in insp.get_columns(tbl)]
            if col_name in cols:
                op.drop_column(tbl, col_name)

    # 2. Drop int_id columns
    for tbl in reversed(TABLES_WITH_INT_ID_PK):
        if tbl in existing_tables:
            cols = [c["name"] for c in insp.get_columns(tbl)]
            if "int_id" in cols:
                op.drop_column(tbl, "int_id")
