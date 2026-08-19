"""011_add_full_report_and_aggregate_columns

Revision ID: 011_full_report_and_aggregate
Revises: 010_diagnostic_report_models
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa


revision = '011_full_report_and_aggregate'
down_revision = '010_diagnostic_report_models'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 1. Table: exam_attempt_reports
    if 'exam_attempt_reports' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exam_attempt_reports')]
        with op.batch_alter_table('exam_attempt_reports') as batch_op:
            if 'full_report_json' not in existing_cols:
                batch_op.add_column(sa.Column('full_report_json', sa.JSON(), nullable=True))
            if 'markdown_audit_text' not in existing_cols:
                batch_op.add_column(sa.Column('markdown_audit_text', sa.Text(), nullable=True))

    # 2. Table: user_skill_profiles
    if 'user_skill_profiles' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('user_skill_profiles')]
        with op.batch_alter_table('user_skill_profiles') as batch_op:
            if 'cumulative_irt_theta' not in existing_cols:
                batch_op.add_column(sa.Column('cumulative_irt_theta', sa.Float(), nullable=False, server_default='0.0'))
            if 'cumulative_gti' not in existing_cols:
                batch_op.add_column(sa.Column('cumulative_gti', sa.Float(), nullable=False, server_default='0.20'))
            if 'cumulative_oeei' not in existing_cols:
                batch_op.add_column(sa.Column('cumulative_oeei', sa.Float(), nullable=False, server_default='0.70'))
            if 'cumulative_icrs' not in existing_cols:
                batch_op.add_column(sa.Column('cumulative_icrs', sa.Float(), nullable=False, server_default='65.0'))
            if 'cumulative_satoi' not in existing_cols:
                batch_op.add_column(sa.Column('cumulative_satoi', sa.Float(), nullable=False, server_default='85.0'))
            if 'total_tests_given' not in existing_cols:
                batch_op.add_column(sa.Column('total_tests_given', sa.Integer(), nullable=False, server_default='0'))
            if 'total_questions_answered' not in existing_cols:
                batch_op.add_column(sa.Column('total_questions_answered', sa.Integer(), nullable=False, server_default='0'))
            if 'aggregate_report_json' not in existing_cols:
                batch_op.add_column(sa.Column('aggregate_report_json', sa.JSON(), nullable=True))
            if 'aggregate_markdown_audit' not in existing_cols:
                batch_op.add_column(sa.Column('aggregate_markdown_audit', sa.Text(), nullable=True))
            if 'updated_at' not in existing_cols:
                batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))

    # 3. Table: exam_attempts
    if 'exam_attempts' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exam_attempts')]
        with op.batch_alter_table('exam_attempts') as batch_op:
            if 'pacing_status' not in existing_cols:
                batch_op.add_column(sa.Column('pacing_status', sa.String(length=100), nullable=False, server_default='BALANCED_PACING'))
            if 'gti_score' not in existing_cols:
                batch_op.add_column(sa.Column('gti_score', sa.Float(), nullable=False, server_default='0.0'))
            if 'irt_theta' not in existing_cols:
                batch_op.add_column(sa.Column('irt_theta', sa.Float(), nullable=False, server_default='0.0'))
            if 'percentile_rank' not in existing_cols:
                batch_op.add_column(sa.Column('percentile_rank', sa.Float(), nullable=False, server_default='50.0'))
            if 'oeei_score' not in existing_cols:
                batch_op.add_column(sa.Column('oeei_score', sa.Float(), nullable=False, server_default='0.0'))
            if 'satoi_score' not in existing_cols:
                batch_op.add_column(sa.Column('satoi_score', sa.Float(), nullable=False, server_default='100.0'))
            if 'icrs_score' not in existing_cols:
                batch_op.add_column(sa.Column('icrs_score', sa.Float(), nullable=False, server_default='50.0'))
            if 'report_metadata_json' not in existing_cols:
                batch_op.add_column(sa.Column('report_metadata_json', sa.JSON(), nullable=True))

    # 4. Table: exam_question_responses
    if 'exam_question_responses' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exam_question_responses')]
        with op.batch_alter_table('exam_question_responses') as batch_op:
            if 'closeness_score_awarded' not in existing_cols:
                batch_op.add_column(sa.Column('closeness_score_awarded', sa.Float(), nullable=False, server_default='0.0'))
            if 'final_score' not in existing_cols:
                batch_op.add_column(sa.Column('final_score', sa.Float(), nullable=False, server_default='0.0'))
            if 'candidate_accuracy_pct' not in existing_cols:
                batch_op.add_column(sa.Column('candidate_accuracy_pct', sa.Float(), nullable=True))
            if 'is_switched' not in existing_cols:
                batch_op.add_column(sa.Column('is_switched', sa.Boolean(), nullable=False, server_default='false'))
            if 'gti_item_score' not in existing_cols:
                batch_op.add_column(sa.Column('gti_item_score', sa.Float(), nullable=False, server_default='0.0'))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'exam_attempt_reports' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('exam_attempt_reports')]
        with op.batch_alter_table('exam_attempt_reports') as batch_op:
            if 'markdown_audit_text' in existing_cols:
                batch_op.drop_column('markdown_audit_text')
            if 'full_report_json' in existing_cols:
                batch_op.drop_column('full_report_json')

    if 'user_skill_profiles' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('user_skill_profiles')]
        with op.batch_alter_table('user_skill_profiles') as batch_op:
            if 'aggregate_markdown_audit' in existing_cols:
                batch_op.drop_column('aggregate_markdown_audit')
            if 'aggregate_report_json' in existing_cols:
                batch_op.drop_column('aggregate_report_json')
