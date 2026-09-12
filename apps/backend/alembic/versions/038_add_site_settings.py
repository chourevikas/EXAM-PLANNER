"""038_add_site_settings

Revision ID: 038_add_site_settings
Revises: 037_reconcile_languagecode_enum
Create Date: 2026-09-12 00:00:00.000000

Creates:
- site_settings table (singleton row) storing the active site-wide color
  theme, seeded with the default 'crimson' theme so existing installs
  render unchanged until an admin picks a different preset.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '038_add_site_settings'
down_revision: Union[str, None] = '037_reconcile_languagecode'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'site_settings' not in tables:
        op.create_table(
            'site_settings',
            sa.Column('id', sa.BigInteger(), nullable=False),
            sa.Column('theme_name', sa.String(length=50), nullable=False, server_default='crimson'),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_by_id', sa.BigInteger(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        )

        site_settings = sa.table(
            'site_settings',
            sa.column('id', sa.BigInteger()),
            sa.column('theme_name', sa.String()),
        )
        op.bulk_insert(site_settings, [{'id': 1, 'theme_name': 'crimson'}])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'site_settings' in tables:
        op.drop_table('site_settings')
