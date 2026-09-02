"""031_testimonials_timestamptz

Revision ID: 031_testimonials_timestamptz
Revises: 030_add_current_affairs_table
Create Date: 2026-09-02 20:40:00.000000

Ensures testimonials created_at and updated_at are TIMESTAMPTZ.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic (max 32 chars).
revision: str = '031_testimonials_timestamptz'
down_revision: Union[str, None] = '030_add_current_affairs_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'testimonials' in tables:
        cols = {c['name']: c for c in insp.get_columns('testimonials')}
        created_col = cols.get('created_at')
        if created_col and hasattr(created_col.get('type'), 'timezone') and not created_col['type'].timezone:
            op.execute(sa.text("ALTER TABLE testimonials ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'"))

        updated_col = cols.get('updated_at')
        if updated_col and hasattr(updated_col.get('type'), 'timezone') and not updated_col['type'].timezone:
            op.execute(sa.text("ALTER TABLE testimonials ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'"))


def downgrade() -> None:
    pass
