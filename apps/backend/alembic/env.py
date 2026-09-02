import asyncio
from logging.config import fileConfig
import sqlalchemy as sa
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

from alembic import context
from app.config.settings import get_settings
import app.db.models  # noqa: F401

config = context.config

if config.config_file_name is not None and not config.attributes.get("dont_mutate_logger", False):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = SQLModel.metadata

settings = get_settings()
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

if "asyncpg" in db_url and "sslmode=" in db_url:
    db_url = db_url.replace("sslmode=", "ssl=")

config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))


def my_compare_type(context, inspected_column, metadata_column, inspected_type, metadata_type):
    """Custom comparator to prevent false-positive alterations during autogenerate."""
    # If DB has BIGINT (Postgres identity) and metadata has Integer/BigInteger, ignore difference
    if isinstance(inspected_type, (sa.BigInteger, sa.INTEGER)) and isinstance(metadata_type, (sa.BigInteger, sa.INTEGER)):
        return False
    # Ignore TimestampTZ vs DateTime nuances
    if "TIMESTAMP" in str(inspected_type).upper() and "DATETIME" in str(metadata_type).upper():
        return False
    return None


def my_include_object(object, name, type_, reflected, compare_to):
    """Filter to prevent autogenerate from dropping partial or filtered indexes."""
    if type_ == "index":
        # If the reflected index has a postgresql_where clause (partial index), do not drop or modify it
        if reflected and getattr(object, "dialect_options", {}).get("postgresql", {}).get("where") is not None:
            return False
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    is_sqlite = bool(url and url.startswith("sqlite"))
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=is_sqlite,
        compare_type=my_compare_type,
        include_object=my_include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    is_sqlite = connection.dialect.name == "sqlite"
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=is_sqlite,
        compare_type=my_compare_type,
        include_object=my_include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In online mode, create an AsyncEngine and associate a connection with the context."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
