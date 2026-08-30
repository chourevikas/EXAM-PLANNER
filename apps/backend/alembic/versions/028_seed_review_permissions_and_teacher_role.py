"""028_seed_review_permissions_and_teacher_role

Revision ID: 028_seed_review_perms
Revises: 027_add_roles_permissions
Create Date: 2026-08-31 10:05:00.000000

Data-only migration: seeds the initial permission catalog and the single
system "Teacher" role, granting it the two review permissions. No schema
changes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '028_seed_review_perms'
down_revision: Union[str, None] = '027_add_roles_permissions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSIONS = [
    ('questions.review', 'View Review Queue', 'View assigned/pending question review tasks and their detail.'),
    ('questions.review.manage', 'Approve/Reject Reviewed Questions', 'Approve, reject, edit explanations, or trigger re-extraction on a review task.'),
    ('rewards.manage', 'Manage Teacher Rewards', 'View the teacher points leaderboard and grant rewards to teachers.'),
]

TEACHER_ROLE = ('Teacher', 'teacher', 'TEACHER')


def upgrade() -> None:
    bind = op.get_bind()

    permissions = sa.table(
        'permissions',
        sa.column('id', sa.Integer),
        sa.column('key', sa.String),
        sa.column('label', sa.String),
        sa.column('description', sa.String),
    )
    roles = sa.table(
        'roles',
        sa.column('id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('slug', sa.String),
        sa.column('base_role_type', sa.String),
        sa.column('is_system', sa.Boolean),
    )
    role_permissions = sa.table(
        'role_permissions',
        sa.column('role_id', sa.Integer),
        sa.column('permission_id', sa.Integer),
    )

    existing_perm_keys = {
        row[0] for row in bind.execute(sa.select(permissions.c.key))
    }
    for key, label, description in PERMISSIONS:
        if key not in existing_perm_keys:
            bind.execute(
                permissions.insert().values(key=key, label=label, description=description)
            )

    name, slug, base_role_type = TEACHER_ROLE
    existing_role = bind.execute(
        sa.select(roles.c.id).where(roles.c.slug == slug)
    ).first()

    if existing_role is None:
        bind.execute(
            roles.insert().values(
                name=name, slug=slug, base_role_type=base_role_type, is_system=True,
            )
        )
        teacher_role_id = bind.execute(
            sa.select(roles.c.id).where(roles.c.slug == slug)
        ).scalar_one()
    else:
        teacher_role_id = existing_role[0]

    granted_permission_ids = {
        row[0]
        for row in bind.execute(
            sa.select(role_permissions.c.permission_id).where(
                role_permissions.c.role_id == teacher_role_id
            )
        )
    }
    teacher_permission_ids = bind.execute(
        sa.select(permissions.c.id).where(
            permissions.c.key.in_(['questions.review', 'questions.review.manage'])
        )
    ).scalars().all()
    for permission_id in teacher_permission_ids:
        if permission_id not in granted_permission_ids:
            bind.execute(
                role_permissions.insert().values(
                    role_id=teacher_role_id, permission_id=permission_id
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE slug = 'teacher')"
    ))
    bind.execute(sa.text("DELETE FROM roles WHERE slug = 'teacher'"))
    bind.execute(sa.text(
        "DELETE FROM permissions WHERE key IN ('questions.review', 'questions.review.manage', 'rewards.manage')"
    ))
