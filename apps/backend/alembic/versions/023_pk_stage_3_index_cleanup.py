"""023_pk_stage_3_index_cleanup

Revision ID: 023_pk_stage_3_index_clean
Revises: 022_pk_stage_2_promote
Create Date: 2026-08-29 21:30:00.000000

Stage 3: Index Deduplication & Partial Indexes
- Drops 9 redundant standalone single-column indexes duplicated by composite indexes.
- Converts full boolean B-Trees to partial indexes.
- Adds partial indexes for hot working-queue queries.
- Adds supporting indexes for question_bookmarks and remaining foreign keys.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '023_pk_stage_3_index_clean'
down_revision: Union[str, None] = '022_pk_stage_2_promote'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REDUNDANT_INDEXES = [
    ("user_test_attempts", "ix_user_test_attempts_user_id"),
    ("user_test_attempts", "ix_user_test_attempts_user_int_id"),
    ("user_question_responses", "ix_user_question_responses_attempt_id"),
    ("user_question_responses", "ix_user_question_responses_attempt_int_id"),
    ("exam_attempts", "ix_exam_attempts_user_id"),
    ("exam_attempts", "ix_exam_attempts_user_int_id"),
    ("exam_question_responses", "ix_exam_question_responses_attempt_id"),
    ("exam_question_responses", "ix_exam_question_responses_attempt_int_id"),
    ("exam_question_reports", "ix_exam_question_reports_attempt_id"),
    ("exam_question_reports", "ix_exam_question_reports_attempt_int_id"),
    ("user_concept_retention", "ix_user_concept_retention_user_id"),
    ("user_concept_retention", "ix_user_concept_retention_user_int_id"),
    ("user_taxonomy_mastery", "ix_user_taxonomy_mastery_user_id"),
    ("user_taxonomy_mastery", "ix_user_taxonomy_mastery_user_int_id"),
    ("plan_feature_links", "ix_plan_feature_links_plan_id"),
    ("plan_feature_links", "ix_plan_feature_links_plan_int_id"),
    ("user_subscriptions", "ix_user_subscriptions_user_id"),
    ("user_subscriptions", "ix_user_subscriptions_user_int_id"),
]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    # 1. Drop redundant single-column indexes
    for tbl, idx_name in REDUNDANT_INDEXES:
        conn.execute(sa.text(f"DROP INDEX IF EXISTS {idx_name};"))

    # 2. Add partial indexes for boolean flags
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_eq_responses_marked_review 
        ON exam_question_responses (attempt_id) 
        WHERE is_marked_for_review = TRUE;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_eq_responses_switched 
        ON exam_question_responses (attempt_id) 
        WHERE is_switched = TRUE;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_review_tasks_flagged_val 
        ON human_review_tasks (exam_id) 
        WHERE is_flagged_by_validator = TRUE;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_study_tasks_uncompleted 
        ON study_tasks (user_id, scheduled_date) 
        WHERE is_completed = FALSE;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_study_tasks_ai_recommended 
        ON study_tasks (user_id) 
        WHERE is_ai_recommended = TRUE;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_subscription_plans_active 
        ON subscription_plans (display_order) 
        WHERE is_active = TRUE;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_platform_features_active 
        ON platform_features (feature_code) 
        WHERE is_active = TRUE;
    """))

    # 3. Add hot queue partial indexes
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_review_tasks_pending 
        ON human_review_tasks (assigned_admin_id, created_at) 
        WHERE review_status = 'PENDING_REVIEW';
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_retention_due_reviews 
        ON user_concept_retention (user_id, next_scheduled_review);
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_user_subs_active_period 
        ON user_subscriptions (user_id, current_period_end) 
        WHERE status = 'ACTIVE';
    """))

    # 4. Add supporting indexes on bookmarks and missing FKs
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'question_bookmarks') THEN
                CREATE INDEX IF NOT EXISTS ix_question_bookmarks_user ON question_bookmarks (user_id);
                CREATE INDEX IF NOT EXISTS ix_question_bookmarks_q ON question_bookmarks (question_id);
                CREATE UNIQUE INDEX IF NOT EXISTS ix_question_bookmarks_user_q ON question_bookmarks (user_id, question_id);
            END IF;
        END $$;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET lock_timeout = '2000ms';"))

    conn.execute(sa.text("DROP INDEX IF EXISTS ix_eq_responses_marked_review;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_eq_responses_switched;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_review_tasks_flagged_val;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_study_tasks_uncompleted;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_study_tasks_ai_recommended;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_subscription_plans_active;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_platform_features_active;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_review_tasks_pending;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_retention_due_reviews;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_user_subs_active_period;"))
