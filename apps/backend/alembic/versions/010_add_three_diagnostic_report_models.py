"""010_add_three_diagnostic_report_models

Revision ID: 010_add_three_diagnostic_report_models
Revises: 009_add_answer_key_pdf_path
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '010_diagnostic_report_models'
down_revision = '009_add_answer_key_pdf_path'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 1. Table: exam_question_reports
    if 'exam_question_reports' not in tables:
        op.create_table(
            'exam_question_reports',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('attempt_id', sa.UUID(), nullable=False),
            sa.Column('question_id', sa.UUID(), nullable=False),
            sa.Column('question_number', sa.Integer(), nullable=False),
            sa.Column('is_correct', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('final_score', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('time_taken_seconds', sa.Float(), nullable=False, server_default='60.0'),
            sa.Column('expected_time_seconds', sa.Float(), nullable=False, server_default='60.0'),
            sa.Column('time_window', sa.String(length=50), nullable=False, server_default='OPTIMAL'),
            sa.Column('closeness_score', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('closeness_classification', sa.String(length=100), nullable=False, server_default='Neutral Distractor'),
            sa.Column('gti_item_score', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('is_option_switched', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('blooms_level', sa.String(length=50), nullable=False, server_default='ANALYZE'),
            sa.Column('explanation_json', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['attempt_id'], ['exam_attempts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_eq_reports_attempt_q', 'exam_question_reports', ['attempt_id', 'question_id'], unique=True)
        op.create_index('ix_eq_reports_attempt_num', 'exam_question_reports', ['attempt_id', 'question_number'])
        op.create_index('ix_exam_question_reports_attempt_id', 'exam_question_reports', ['attempt_id'])
        op.create_index('ix_exam_question_reports_question_id', 'exam_question_reports', ['question_id'])
        op.create_index('ix_exam_question_reports_question_number', 'exam_question_reports', ['question_number'])
        op.create_index('ix_exam_question_reports_is_correct', 'exam_question_reports', ['is_correct'])

    # 2. Table: exam_attempt_reports
    if 'exam_attempt_reports' not in tables:
        op.create_table(
            'exam_attempt_reports',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('attempt_id', sa.UUID(), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('exam_id', sa.UUID(), nullable=False),
            sa.Column('matrices_summary_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('taxonomy_breakdown_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('llm_insight_json', sa.JSON(), nullable=True),
            sa.Column('s3_report_url', sa.String(length=500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['attempt_id'], ['exam_attempts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('attempt_id'),
        )
        op.create_index('ix_exam_attempt_reports_attempt_id', 'exam_attempt_reports', ['attempt_id'])
        op.create_index('ix_exam_attempt_reports_user_id', 'exam_attempt_reports', ['user_id'])
        op.create_index('ix_exam_attempt_reports_exam_id', 'exam_attempt_reports', ['exam_id'])

    # 3. Table: user_skill_progression_reports
    if 'user_skill_progression_reports' not in tables:
        op.create_table(
            'user_skill_progression_reports',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('attempt_id', sa.UUID(), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('previous_metrics_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('updated_metrics_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('deltas_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('taxonomy_promotions_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('spaced_repetition_schedule_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['attempt_id'], ['exam_attempts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_skill_prog_user_created', 'user_skill_progression_reports', ['user_id', 'created_at'])
        op.create_index('ix_user_skill_progression_reports_attempt_id', 'user_skill_progression_reports', ['attempt_id'])
        op.create_index('ix_user_skill_progression_reports_user_id', 'user_skill_progression_reports', ['user_id'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'user_skill_progression_reports' in tables:
        op.drop_table('user_skill_progression_reports')
    if 'exam_attempt_reports' in tables:
        op.drop_table('exam_attempt_reports')
    if 'exam_question_reports' in tables:
        op.drop_table('exam_question_reports')
