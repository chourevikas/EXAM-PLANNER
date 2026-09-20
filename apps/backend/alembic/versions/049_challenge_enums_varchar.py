"""049_challenge_enums_varchar

Revision ID: 049_challenge_enums_varchar
Revises: 048_add_challenge_exam_years
Create Date: 2026-09-20 00:00:00.000000

Migration 036 created the challenge visibility/status columns as native Postgres ENUMs, but the
models declare them as plain strings (AutoString). On databases built from the migrations every
challenge INSERT therefore fails with "column is of type challengevisibility but expression is of
type character varying". Convert the columns to VARCHAR; a no-op where they already are.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '049_challenge_enums_varchar'
down_revision: Union[str, None] = '048_add_challenge_exam_years'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ('challenges', 'visibility'),
    ('challenges', 'status'),
    ('challenge_invites', 'status'),
    ('challenge_attempts', 'status'),
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    for table, column in COLUMNS:
        row = bind.execute(
            sa.text(
                "SELECT data_type, column_default FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
        if row is None or row[0] != 'USER-DEFINED':
            continue
        default = row[1]
        op.execute(f'ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT')
        op.execute(f'ALTER TABLE {table} ALTER COLUMN {column} TYPE VARCHAR(50) USING {column}::text')
        if default:
            literal = default.split('::')[0]
            op.execute(f'ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT {literal}')


def downgrade() -> None:
    # Intentionally left as VARCHAR: the models expect plain strings.
    pass
