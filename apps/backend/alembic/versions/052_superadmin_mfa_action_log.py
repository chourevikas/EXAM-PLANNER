"""052_superadmin_mfa_action_log

Revision ID: 052_superadmin_mfa_action_log
Revises: 051_add_must_change_password
Create Date: 2026-09-21 00:00:00.000000

Super Admin TOTP columns on users, and an append-only admin_action_logs table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '052_superadmin_mfa_action_log'
down_revision: Union[str, None] = '051_add_must_change_password'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'users' in tables:
        existing = {c['name'] for c in insp.get_columns('users')}
        with op.batch_alter_table('users') as batch_op:
            if 'totp_secret' not in existing:
                batch_op.add_column(sa.Column('totp_secret', sa.String(), nullable=True))
            if 'totp_enabled' not in existing:
                batch_op.add_column(
                    sa.Column('totp_enabled', sa.Boolean(), nullable=False, server_default=sa.false())
                )
            if 'totp_last_step' not in existing:
                batch_op.add_column(sa.Column('totp_last_step', sa.BigInteger(), nullable=True))
            if 'totp_recovery_hashes' not in existing:
                batch_op.add_column(sa.Column('totp_recovery_hashes', sa.JSON(), nullable=True))

    if 'admin_action_logs' not in tables:
        op.create_table(
            'admin_action_logs',
            sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), primary_key=True, autoincrement=True),
            sa.Column('actor_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('actor_email', sa.String(255), nullable=True),
            sa.Column('action', sa.String(64), nullable=False),
            sa.Column('target_user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('target_email', sa.String(255), nullable=True),
            sa.Column('details', sa.JSON(), nullable=True),
            sa.Column('ip_address', sa.String(64), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_admin_action_logs_actor_id', 'admin_action_logs', ['actor_id'])
        op.create_index('ix_admin_action_logs_action', 'admin_action_logs', ['action'])
        op.create_index('ix_admin_action_logs_target_user_id', 'admin_action_logs', ['target_user_id'])
        op.create_index('ix_admin_action_logs_created_at', 'admin_action_logs', ['created_at'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'admin_action_logs' in insp.get_table_names():
        op.drop_table('admin_action_logs')
    if 'users' in insp.get_table_names():
        existing = {c['name'] for c in insp.get_columns('users')}
        with op.batch_alter_table('users') as batch_op:
            for col in ('totp_recovery_hashes', 'totp_last_step', 'totp_enabled', 'totp_secret'):
                if col in existing:
                    batch_op.drop_column(col)
