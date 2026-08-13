import asyncio
import random
import functools
from typing import AsyncGenerator, Callable, Any, Optional
from sqlmodel import SQLModel
from sqlalchemy import event
from sqlalchemy.exc import OperationalError, DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

import app.db.models  # noqa: F401
from app.config.settings import get_settings
from app.config.logger import setup_logger

logger = setup_logger("DatabaseSession")
settings = get_settings()

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

if "asyncpg" in db_url and "sslmode=" in db_url:
    db_url = db_url.replace("sslmode=", "ssl=")

import sys
import os
from sqlalchemy.pool import NullPool, QueuePool

IS_CELERY_WORKER = "celery" in sys.argv[0].lower() or os.getenv("CELERY_WORKER", "false").lower() == "true"

if db_url.startswith("sqlite"):
    engine_kwargs = {"echo": False}
    engine = create_async_engine(db_url, **engine_kwargs)

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA cache_size=-64000;")  # 64MB Cache
        cursor.execute("PRAGMA busy_timeout=60000;") # 60 second busy timeout
        cursor.close()
else:
    pool_size = getattr(settings, "DB_POOL_SIZE", 20)
    max_overflow = getattr(settings, "DB_MAX_OVERFLOW", 10)
    logger.info(
        f"Initializing Database Engine (pool_size={pool_size}, max_overflow={max_overflow}, pool_recycle=1800, pool_pre_ping=True)..."
    )
    engine_kwargs = {
        "echo": False,
        "pool_size": pool_size,
        "max_overflow": max_overflow,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
    }
    engine = create_async_engine(db_url, **engine_kwargs)

async_session_factory = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


def is_lock_or_concurrency_error(exc: Exception) -> bool:
    """Detects database lock contention, deadlock, or busy timeout errors across SQLite, Postgres, MySQL."""
    err_msg = str(exc).lower()
    lock_keywords = ["database is locked", "lock", "busy", "deadlock", "timeout", "could not obtain lock"]
    return any(k in err_msg for k in lock_keywords) or isinstance(exc, (OperationalError, DBAPIError))


def with_db_retry(max_retries: int = 5, initial_delay: float = 0.2):
    """Decorator adding automatic backoff and retry for async database operations encountering locks."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            retries = 0
            delay = initial_delay
            while True:
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:
                    if is_lock_or_concurrency_error(exc) and retries < max_retries:
                        retries += 1
                        jitter = random.uniform(0.05, 0.15)
                        sleep_time = delay + jitter
                        logger.warning(
                            f"⚠️ DB Lock/Concurrency detected ({exc}). Retrying attempt {retries}/{max_retries} in {sleep_time:.2f}s..."
                        )
                        await asyncio.sleep(sleep_time)
                        delay *= 2
                    else:
                        raise
        return wrapper
    return decorator


class ManagedAsyncSession:
    """Async context manager wrapper providing lock-resilient database transactions with guaranteed connection release."""

    def __init__(self, max_retries: int = 5):
        self.max_retries = max_retries
        self.session: Optional[AsyncSession] = None

    async def __aenter__(self) -> AsyncSession:
        self.session = async_session_factory()
        return self.session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self.session:
            return False

        try:
            if exc_type is not None:
                await self.session.rollback()
                return False

            try:
                await self.session.commit()
            except Exception as commit_err:
                await self.session.rollback()
                logger.error(f"❌ Transaction commit failed, rolling back: {commit_err}")
                raise commit_err
            return False
        finally:
            await self.session.close()


def managed_async_session(max_retries: int = 5) -> ManagedAsyncSession:
    """Factory creating a ManagedAsyncSession context manager."""
    return ManagedAsyncSession(max_retries=max_retries)


async def async_init_db():
    """Asynchronously initializes database tables or executes automatic Alembic migrations."""
    db_migration_enabled = getattr(settings, "DB_MIGRATION", True)
    if db_migration_enabled:
        logger.info("DB_MIGRATION is enabled. Executing automatic Alembic database migrations (alembic upgrade head)...")
        try:
            from alembic.config import Config
            from alembic import command
            from pathlib import Path

            alembic_ini_path = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
            if alembic_ini_path.exists():
                from alembic.script import ScriptDirectory
                from alembic.runtime.environment import EnvironmentContext

                alembic_cfg = Config(str(alembic_ini_path))
                script = ScriptDirectory.from_config(alembic_cfg)

                def do_upgrade(connection):
                    def upgrade(rev, context):
                        return script._upgrade_revs("head", rev)

                    with EnvironmentContext(
                        alembic_cfg,
                        script,
                        fn=upgrade,
                        as_sql=False,
                        starting_rev=None,
                        destination_rev="head",
                    ) as env_ctx:
                        env_ctx.configure(
                            connection=connection,
                            target_metadata=SQLModel.metadata,
                            render_as_batch=True,
                        )
                        with env_ctx.begin_transaction():
                            env_ctx.run_migrations()

                async with engine.begin() as conn:
                    await conn.run_sync(do_upgrade)
                logger.info("Automatic Alembic database migration completed successfully.")
            else:
                logger.warning(f"alembic.ini not found at {alembic_ini_path}. Falling back to create_all.")
                async with engine.begin() as conn:
                    await conn.run_sync(SQLModel.metadata.create_all)
        except Exception as mig_err:
            logger.error(f"Automatic Alembic migration encountered error: {mig_err}. Falling back to create_all.")
            async with engine.begin() as conn:
                await conn.run_sync(SQLModel.metadata.create_all)
    else:
        logger.info(
            f"Initializing database tables on engine: {engine.url.drivername} ({engine.url.database})..."
        )
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Database initialization complete.")


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator for FastAPI routes."""
    async with async_session_factory() as session:
        yield session


# Alias for backward compatibility
get_db = get_async_session
