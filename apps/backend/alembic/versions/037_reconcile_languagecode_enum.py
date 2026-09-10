"""037_reconcile_languagecode

Revision ID: 037_reconcile_languagecode
Revises: 036_add_challenges
Create Date: 2026-09-10 19:30:00.000000

Reconciles PostgreSQL 'languagecode' enum with the Python LanguageCode enum
by adding all missing official languages via ALTER TYPE ... ADD VALUE IF NOT EXISTS.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '037_reconcile_languagecode'
down_revision: Union[str, None] = '036_add_challenges'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_LANGUAGE_ENUM_VALUES = [
    "TELUGU",
    "BENGALI",
    "GUJARATI",
    "KANNADA",
    "MALAYALAM",
    "PUNJABI",
    "ODIA",
    "ASSAMESE",
    "URDU",
    "SANSKRIT",
    "MAITHILI",
    "KONKANI",
    "KASHMIRI",
    "NEPALI",
    "SINDHI",
    "DOGRI",
    "MANIPURI",
    "BODO",
    "SANTALI",
]


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if dialect_name == 'postgresql':
        for val in NEW_LANGUAGE_ENUM_VALUES:
            op.execute(sa.text(f"ALTER TYPE languagecode ADD VALUE IF NOT EXISTS '{val}';"))


def downgrade() -> None:
    # PostgreSQL does not support dropping individual enum values without recreating the type.
    pass
