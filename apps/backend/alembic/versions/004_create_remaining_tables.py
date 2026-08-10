"""004_create_remaining_tables

Revision ID: 004_create_remaining_tables
Revises: 003_relocate_acc_freq
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlmodel import SQLModel
from sqlalchemy import inspect
import app.db.models  # noqa: F401

revision = '004_create_remaining_tables'
down_revision = '003_relocate_acc_freq'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Create any missing SQLModel tables (pipeline_runs, question_assets, user_memory_states, etc.)
    SQLModel.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    pass
