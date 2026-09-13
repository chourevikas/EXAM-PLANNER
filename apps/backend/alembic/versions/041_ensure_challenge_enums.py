"""041_ensure_challenge_enums

Revision ID: 041_ensure_challenge_enums
Revises: 040_add_user_notification_reads
Create Date: 2026-09-13 15:15:00.000000

Ensures all PostgreSQL custom ENUM types required by the challenges module exist:
- difficultylevel ('EASY', 'MEDIUM', 'HARD')
- challengevisibility ('INVITE_ONLY', 'PUBLIC')
- challengestatus ('ACTIVE', 'ARCHIVED')
- challengeinvitestatus ('PENDING', 'VIEWED')
- challengeattemptstatus ('IN_PROGRESS', 'SUBMITTED')
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '041_ensure_challenge_enums'
down_revision: Union[str, None] = '040_add_user_notification_reads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficultylevel') THEN CREATE TYPE difficultylevel AS ENUM ('EASY', 'MEDIUM', 'HARD'); END IF; END $$;")
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challengevisibility') THEN CREATE TYPE challengevisibility AS ENUM ('INVITE_ONLY', 'PUBLIC'); END IF; END $$;")
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challengestatus') THEN CREATE TYPE challengestatus AS ENUM ('ACTIVE', 'ARCHIVED'); END IF; END $$;")
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challengeinvitestatus') THEN CREATE TYPE challengeinvitestatus AS ENUM ('PENDING', 'VIEWED'); END IF; END $$;")
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challengeattemptstatus') THEN CREATE TYPE challengeattemptstatus AS ENUM ('IN_PROGRESS', 'SUBMITTED'); END IF; END $$;")


def downgrade() -> None:
    pass
