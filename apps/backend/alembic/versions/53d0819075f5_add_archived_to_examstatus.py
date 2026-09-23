"""add_archived_to_examstatus

Revision ID: 53d0819075f5
Revises: 052_superadmin_mfa_action_log
Create Date: 2026-09-24 01:14:41.257246

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '53d0819075f5'
down_revision: Union[str, None] = '052_superadmin_mfa_action_log'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE examstatus ADD VALUE IF NOT EXISTS 'ARCHIVED'")


def downgrade() -> None:
    pass
