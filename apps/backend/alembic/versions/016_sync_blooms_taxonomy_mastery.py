"""016_sync_blooms_taxonomy_mastery

Revision ID: 016_blooms_taxonomy_mastery
Revises: 015_question_integrity_cols
Create Date: 2026-08-26 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '016_blooms_taxonomy_mastery'
down_revision = '015_question_integrity_cols'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 0. Ensure CREATE enum value exists in postgresql bloomslevel enum
    try:
        op.execute("ALTER TYPE bloomslevel ADD VALUE IF NOT EXISTS 'CREATE';")
    except Exception:
        pass

    # 1. Ensure index on exam_question_reports.blooms_level
    if 'exam_question_reports' in tables:
        indexes = [i['name'] for i in insp.get_indexes('exam_question_reports')]
        if 'ix_eq_reports_blooms' not in indexes:
            op.create_index(
                'ix_eq_reports_blooms',
                'exam_question_reports',
                ['blooms_level'],
                unique=False,
            )

    # 2. Ensure index on user_taxonomy_mastery(user_id, taxonomy_type, taxonomy_id_code)
    if 'user_taxonomy_mastery' in tables:
        indexes = [i['name'] for i in insp.get_indexes('user_taxonomy_mastery')]
        if 'ix_tax_mastery_user_code' not in indexes:
            op.create_index(
                'ix_tax_mastery_user_code',
                'user_taxonomy_mastery',
                ['user_id', 'taxonomy_type', 'taxonomy_id_code'],
                unique=True,
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'exam_question_reports' in tables:
        indexes = [i['name'] for i in insp.get_indexes('exam_question_reports')]
        if 'ix_eq_reports_blooms' in indexes:
            op.drop_index('ix_eq_reports_blooms', table_name='exam_question_reports')

    if 'user_taxonomy_mastery' in tables:
        indexes = [i['name'] for i in insp.get_indexes('user_taxonomy_mastery')]
        if 'ix_tax_mastery_user_code' in indexes:
            op.drop_index('ix_tax_mastery_user_code', table_name='user_taxonomy_mastery')
