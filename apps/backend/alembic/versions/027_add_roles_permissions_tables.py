"""027_add_roles_permissions_tables

Revision ID: 027_add_roles_permissions
Revises: 026_set_identity_by_default
Create Date: 2026-08-31 10:00:00.000000

Adds the dynamic role/permission layer (roles, permissions, role_permissions,
role_assignment_logs) plus a nullable users.custom_role_id FK. Purely additive:
the existing users.role enum column and every existing require_roles() check
are untouched.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '027_add_roles_permissions'
down_revision: Union[str, None] = '026_set_identity_by_default'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

USER_ROLE_ENUM = sa.Enum(
    'STUDENT', 'ADMIN', 'SUPER_ADMIN', 'TEACHER',
    name='userrole',
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'permissions' not in tables:
        op.create_table(
            'permissions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('key', sa.String(length=100), nullable=False),
            sa.Column('label', sa.String(length=255), nullable=False),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('key'),
        )
        op.create_index('ix_permissions_key', 'permissions', ['key'], unique=True)

    if 'roles' not in tables:
        op.create_table(
            'roles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('slug', sa.String(length=100), nullable=False),
            sa.Column('base_role_type', USER_ROLE_ENUM, nullable=False),
            sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('created_by_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name'),
            sa.UniqueConstraint('slug'),
        )
        op.create_index('ix_roles_name', 'roles', ['name'], unique=True)
        op.create_index('ix_roles_slug', 'roles', ['slug'], unique=True)

    if 'role_permissions' not in tables:
        op.create_table(
            'role_permissions',
            sa.Column('role_id', sa.Integer(), nullable=False),
            sa.Column('permission_id', sa.Integer(), nullable=False),
            sa.Column('granted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('role_id', 'permission_id'),
        )

    if 'role_assignment_logs' not in tables:
        op.create_table(
            'role_assignment_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('target_user_id', sa.Integer(), nullable=False),
            sa.Column('changed_by_admin_id', sa.Integer(), nullable=True),
            sa.Column('previous_role', USER_ROLE_ENUM, nullable=True),
            sa.Column('previous_custom_role_id', sa.Integer(), nullable=True),
            sa.Column('new_role', USER_ROLE_ENUM, nullable=False),
            sa.Column('new_custom_role_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['changed_by_admin_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_role_assignment_logs_target_user_id', 'role_assignment_logs', ['target_user_id'])

    if 'users' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('users')]
        if 'custom_role_id' not in existing_cols:
            op.add_column('users', sa.Column('custom_role_id', sa.Integer(), nullable=True))
            op.create_foreign_key(
                'fk_users_custom_role_id_roles',
                'users', 'roles',
                ['custom_role_id'], ['id'],
                ondelete='SET NULL',
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'users' in tables:
        existing_cols = [c['name'] for c in insp.get_columns('users')]
        if 'custom_role_id' in existing_cols:
            op.drop_constraint('fk_users_custom_role_id_roles', 'users', type_='foreignkey')
            op.drop_column('users', 'custom_role_id')

    if 'role_assignment_logs' in tables:
        op.drop_table('role_assignment_logs')
    if 'role_permissions' in tables:
        op.drop_table('role_permissions')
    if 'roles' in tables:
        op.drop_table('roles')
    if 'permissions' in tables:
        op.drop_table('permissions')
