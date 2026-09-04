"""
Database dialect-aware upsert utilities for SQLite and PostgreSQL.
"""

from typing import Any


def get_upsert_insert(session: Any = None):
    """
    Returns dialect-specific insert statement (PostgreSQL or SQLite) supporting on_conflict_do_update.
    """
    dialect_name = "postgresql"
    if session is not None:
        bind = getattr(session, "bind", None)
        if bind is None and hasattr(session, "get_bind"):
            try:
                bind = session.get_bind()
            except Exception:
                pass
        if bind is not None and hasattr(bind, "dialect"):
            dialect_name = getattr(bind.dialect, "name", "postgresql")

    if dialect_name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        return sqlite_insert
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    return pg_insert
