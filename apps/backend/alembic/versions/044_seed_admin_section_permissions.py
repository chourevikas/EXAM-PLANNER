"""044_seed_admin_section_permissions

Revision ID: 044_admin_section_perms
Revises: 043_add_user_phone
Create Date: 2026-09-19 00:00:00.000000

Seeds one permission per admin-panel section. A super admin grants these to an
admin through a custom role (Roles & Permissions tab); admins with no custom
role keep full access.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '044_admin_section_perms'
down_revision: Union[str, None] = '043_add_user_phone'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSIONS = [
    ('admin.upload', 'Upload & Exam Pipeline', 'Upload question papers and manage the extraction pipeline.'),
    ('admin.exam_types', 'Exam Types', 'Create, edit and delete exam types.'),
    ('admin.review', 'Question & Solution QA', 'Review, edit, approve and delete questions and solutions.'),
    ('admin.question_bank', 'Question Bank Catalog', 'Browse the question bank catalog.'),
    ('admin.reported_questions', 'Reported Questions', 'Review questions reported by students; edit, reject, unpublish or delete them.'),
    ('admin.users', 'Users', 'View and manage candidate accounts.'),
    ('admin.teacher_rewards', 'Teacher Rewards', 'View the teacher leaderboard and grant rewards.'),
    ('admin.current_affairs', 'Current Affairs', 'Create, edit and delete current affairs.'),
    ('admin.notifications', 'Notifications', 'Create and publish broadcast notifications.'),
    ('admin.testimonials', 'Testimonial Approvals', 'Approve, reject and delete student testimonials.'),
    ('admin.analytics', 'Reports & Analytics', 'View platform reports and analytics.'),
    ('admin.theme', 'Theme', 'Change the site colour theme.'),
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
