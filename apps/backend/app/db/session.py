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
    engine_kwargs = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_size": 20,
        "max_overflow": 30,
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
    """Async context manager wrapper providing lock-resilient database transactions."""

    def __init__(self, max_retries: int = 5):
        self.max_retries = max_retries
        self.session: Optional[AsyncSession] = None

    async def __aenter__(self) -> AsyncSession:
        self.session = async_session_factory()
        return self.session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self.session:
            return False

        if exc_type is not None:
            await self.session.rollback()
            await self.session.close()
            return False

        retries = 0
        delay = 0.2
        while True:
            try:
                await self.session.commit()
                break
            except Exception as exc:
                await self.session.rollback()
                if is_lock_or_concurrency_error(exc) and retries < self.max_retries:
                    retries += 1
                    sleep_time = delay + random.uniform(0.05, 0.15)
                    logger.warning(
                        f"⚠️ DB Commit Lock contention ({exc}). Retrying commit attempt {retries}/{self.max_retries} in {sleep_time:.2f}s..."
                    )
                    await asyncio.sleep(sleep_time)
                    delay *= 2
                else:
                    await self.session.close()
                    raise

        await self.session.close()
        return False


def managed_async_session(max_retries: int = 5) -> ManagedAsyncSession:
    """Factory creating a ManagedAsyncSession context manager."""
    return ManagedAsyncSession(max_retries=max_retries)


async def async_init_db():
    """Asynchronously creates all missing tables in the database."""
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
