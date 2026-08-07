"""001_add_canonical_question_id_to_questions

Revision ID: 001_add_canonical_q_id
Revises: None
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '001_add_canonical_q_id'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # Safely alter questions table to add canonical_question_id if missing
    if 'questions' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('questions')]
        if 'canonical_question_id' not in columns:
            with op.batch_alter_table('questions') as batch_op:
                batch_op.add_column(sa.Column('canonical_question_id', sa.UUID(), nullable=True))
                batch_op.create_foreign_key(
                    'fk_questions_canonical_question_id',
                    'questions',
                    ['canonical_question_id'],
                    ['id'],
                    ondelete='SET NULL'
                )
                batch_op.create_index('ix_questions_canonical_question_id', ['canonical_question_id'])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'questions' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('questions')]
        if 'canonical_question_id' in columns:
            with op.batch_alter_table('questions') as batch_op:
                batch_op.drop_constraint('fk_questions_canonical_question_id', type_='foreignkey')
                batch_op.drop_index('ix_questions_canonical_question_id')
                batch_op.drop_column('canonical_question_id')
