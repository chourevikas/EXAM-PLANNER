"""066_milestones_translations_permissions

Revision ID: 066_ms_translation_perms
Revises: 065_attempt_language
Create Date: 2026-10-17 00:00:00.000000

Permissions for two admin-panel sections, so a super admin can grant them through a custom role:
- admin.milestones (the Milestones section from 064 had no permission row, so custom roles couldn't get it)
- admin.translations (translation coverage per language, and running the translation jobs)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '066_ms_translation_perms'
down_revision: Union[str, None] = '065_attempt_language'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSIONS = [
    ('admin.milestones', 'Milestones', 'Create, edit, switch off and delete milestones.'),
    ('admin.translations', 'Translations', 'See translation coverage per language and run the translation jobs.'),
]


def upgrade() -> None:
    bind = op.get_bind()
    permissions = sa.table(
        'permissions',
        sa.column('key', sa.String),
        sa.column('label', sa.String),
        sa.column('description', sa.String),
        sa.column('created_at', sa.DateTime(timezone=True)),
    )
    existing = {row[0] for row in bind.execute(sa.select(permissions.c.key))}
    for key, label, description in PERMISSIONS:
        if key not in existing:
            bind.execute(
                permissions.insert().values(key=key, label=label, description=description, created_at=sa.func.now())
            )


def downgrade() -> None:
    bind = op.get_bind()
    keys = [k for k, _, _ in PERMISSIONS]
    bind.execute(
        sa.text("DELETE FROM permissions WHERE key = ANY(:keys)").bindparams(keys=keys)
        if bind.dialect.name == 'postgresql'
        else sa.text("DELETE FROM permissions WHERE key IN ({})".format(",".join(f"'{k}'" for k in keys)))
    )
