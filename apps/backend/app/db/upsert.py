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


async def bulk_insert_on_conflict_do_nothing(
    session: Any,
    model_cls: Any,
    records: list[Any],
    index_elements: list[str],
) -> int:
    """
    Performs dialect-aware bulk insert with ON CONFLICT DO NOTHING (PostgreSQL or SQLite).
    Accepts list of SQLModel/SQLAlchemy model instances or dicts.
    """
    if not records:
        return 0

    values_list = []
    for r in records:
        if isinstance(r, dict):
            values_list.append(r)
        elif hasattr(r, "model_dump"):
            dumped = r.model_dump(exclude_unset=False)
            if dumped.get("id") is None:
                dumped.pop("id", None)
            values_list.append(dumped)
        elif hasattr(r, "__dict__"):
            d = {k: v for k, v in r.__dict__.items() if not k.startswith("_")}
            if d.get("id") is None:
                d.pop("id", None)
            values_list.append(d)
        else:
            values_list.append(r)

    if not values_list:
        return 0

    insert_fn = get_upsert_insert(session)
    stmt = insert_fn(model_cls).values(values_list).on_conflict_do_nothing(index_elements=index_elements)
    if hasattr(session, "exec"):
        await session.exec(stmt)
    else:
        await session.execute(stmt)
    return len(values_list)


async def bulk_upsert_translations(
    session: Any,
    model_cls: Any,
    records: list[Any],
    index_elements: list[str],
    update_cols: list[str],
) -> int:
    """
    Performs dialect-aware bulk upsert with ON CONFLICT DO UPDATE for given columns.
    Use this instead of bulk_insert_on_conflict_do_nothing when you want to
    overwrite existing rows that may contain stale/incorrect data (e.g. English
    text accidentally stored in a Hindi/Marathi translation slot).
    """
    if not records:
        return 0

    values_list = []
    for r in records:
        if isinstance(r, dict):
            values_list.append(r)
        elif hasattr(r, "model_dump"):
            dumped = r.model_dump(exclude_unset=False)
            if dumped.get("id") is None:
                dumped.pop("id", None)
            values_list.append(dumped)
        elif hasattr(r, "__dict__"):
            d = {k: v for k, v in r.__dict__.items() if not k.startswith("_")}
            if d.get("id") is None:
                d.pop("id", None)
            values_list.append(d)
        else:
            values_list.append(r)

    if not values_list:
        return 0

    insert_fn = get_upsert_insert(session)
    # Build the SET clause referencing the EXCLUDED pseudo-table for each update column
    excluded_row = insert_fn(model_cls).excluded
    set_clause = {col: getattr(excluded_row, col) for col in update_cols}
    stmt = (
        insert_fn(model_cls)
        .values(values_list)
        .on_conflict_do_update(index_elements=index_elements, set_=set_clause)
    )
    if hasattr(session, "exec"):
        await session.exec(stmt)
    else:
        await session.execute(stmt)
    return len(values_list)
