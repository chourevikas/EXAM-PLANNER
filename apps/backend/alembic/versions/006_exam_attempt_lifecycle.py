"""006_exam_attempt_lifecycle

Revision ID: 006_exam_lifecycle
Revises: 005_convert_timestamptz
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import reflection

revision = '006_exam_lifecycle'
down_revision = '005_convert_timestamptz'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    insp = sa.inspect(bind)

    # 1. Enums for PostgreSQL
    if dialect == 'postgresql':
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attemptmode') THEN CREATE TYPE attemptmode AS ENUM ('EXAM', 'PRACTICE', 'REVISION'); END IF; END $$;")
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'questionresponsestatus') THEN CREATE TYPE questionresponsestatus AS ENUM ('UNVISITED', 'VISITED', 'ANSWERED', 'MARKED_FOR_REVIEW', 'ANSWERED_AND_MARKED'); END IF; END $$;")

    # 2. Add columns to exam_attempts
    existing_cols_attempts = [c['name'] for c in insp.get_columns('exam_attempts')] if 'exam_attempts' in insp.get_table_names() else []
    
    if 'exam_attempts' in insp.get_table_names():
        with op.batch_alter_table('exam_attempts') as batch_op:
            if 'status' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('status', sa.String(length=50), nullable=False, server_default='IN_PROGRESS'))
            if 'mode' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('mode', sa.String(length=50), nullable=False, server_default='EXAM'))
            if 'total_questions' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('total_questions', sa.Integer(), nullable=False, server_default='0'))
            if 'total_correct' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('total_correct', sa.Integer(), nullable=False, server_default='0'))
            if 'total_incorrect' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('total_incorrect', sa.Integer(), nullable=False, server_default='0'))
            if 'total_unattempted' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('total_unattempted', sa.Integer(), nullable=False, server_default='0'))
            if 'current_question_index' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('current_question_index', sa.Integer(), nullable=False, server_default='1'))
            if 'max_duration_seconds' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('max_duration_seconds', sa.Integer(), nullable=False, server_default='7200'))
            if 'started_at' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
            if 'submitted_at' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))
            if 'submission_reason' not in existing_cols_attempts:
                batch_op.add_column(sa.Column('submission_reason', sa.String(length=100), nullable=True))

    # 3. Add columns to exam_question_responses
    existing_cols_responses = [c['name'] for c in insp.get_columns('exam_question_responses')] if 'exam_question_responses' in insp.get_table_names() else []
    
    if 'exam_question_responses' in insp.get_table_names():
        with op.batch_alter_table('exam_question_responses') as batch_op:
            if 'question_status' not in existing_cols_responses:
                batch_op.add_column(sa.Column('question_status', sa.String(length=50), nullable=False, server_default='UNVISITED'))
            if 'is_marked_for_review' not in existing_cols_responses:
                batch_op.add_column(sa.Column('is_marked_for_review', sa.Boolean(), nullable=False, server_default='false'))
            if 'option_switch_count' not in existing_cols_responses:
                batch_op.add_column(sa.Column('option_switch_count', sa.Integer(), nullable=False, server_default='0'))
            if 'visited_count' not in existing_cols_responses:
                batch_op.add_column(sa.Column('visited_count', sa.Integer(), nullable=False, server_default='0'))
            if 'answer_revealed' not in existing_cols_responses:
                batch_op.add_column(sa.Column('answer_revealed', sa.Boolean(), nullable=False, server_default='false'))

    # 4. Add JSON path columns to exams
    existing_cols_exams = [c['name'] for c in insp.get_columns('exams')] if 'exams' in insp.get_table_names() else []
    if 'exams' in insp.get_table_names():
        with op.batch_alter_table('exams') as batch_op:
            if 'questions_json_path' not in existing_cols_exams:
                batch_op.add_column(sa.Column('questions_json_path', sa.String(length=500), nullable=True))
            if 'solutions_json_path' not in existing_cols_exams:
                batch_op.add_column(sa.Column('solutions_json_path', sa.String(length=500), nullable=True))

    # 5. Add FK columns & mode to telemetry tables for consolidation
    if 'user_test_attempts' in insp.get_table_names():
        existing_cols_uta = [c['name'] for c in insp.get_columns('user_test_attempts')]
        with op.batch_alter_table('user_test_attempts') as batch_op:
            if 'exam_attempt_id' not in existing_cols_uta:
                batch_op.add_column(sa.Column('exam_attempt_id', sa.UUID(), nullable=True))
            if 'mode' not in existing_cols_uta:
                batch_op.add_column(sa.Column('mode', sa.String(length=50), nullable=False, server_default='EXAM'))


    if 'user_question_responses' in insp.get_table_names():
        existing_cols_uqr = [c['name'] for c in insp.get_columns('user_question_responses')]
        if 'exam_response_id' not in existing_cols_uqr:
            with op.batch_alter_table('user_question_responses') as batch_op:
                batch_op.add_column(sa.Column('exam_response_id', sa.UUID(), nullable=True))

    if 'question_switch_logs' in insp.get_table_names():
        existing_cols_qsl = [c['name'] for c in insp.get_columns('question_switch_logs')]
        if 'exam_response_id' not in existing_cols_qsl:
            with op.batch_alter_table('question_switch_logs') as batch_op:
                batch_op.add_column(sa.Column('exam_response_id', sa.UUID(), nullable=True))


def downgrade() -> None:
    pass
