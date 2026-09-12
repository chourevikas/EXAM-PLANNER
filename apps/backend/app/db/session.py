import asyncio
import random
import functools
from typing import AsyncGenerator, Callable, Any, Optional
from sqlmodel import SQLModel, select
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
    # Some read paths (e.g. QuestionService batch-preloading) fan a single
    # request out across several concurrent short-lived connections via
    # asyncio.gather, since one AsyncSession can't run overlapping queries.
    # pool_size needs enough headroom to cover that fan-out (plus the
    # request's own held connection) from the warm pool rather than falling
    # back to max_overflow's throwaway connections, which would each pay the
    # full cold-connect handshake cost against this high-latency RDS instance.
    pool_size = getattr(settings, "DB_POOL_SIZE", 10)
    max_overflow = getattr(settings, "DB_MAX_OVERFLOW", 10)
    logger.info(
        f"Initializing Database Engine (pool_size={pool_size}, max_overflow={max_overflow}, pool_recycle=1800, pool_pre_ping=True)..."
    )
    engine_kwargs = {
        "echo": False,
        "pool_size": pool_size,
        "max_overflow": max_overflow,
        "pool_timeout": 60,
        "pool_recycle": 1800,
        "pool_pre_ping": False,  # pre_ping pings ALL idle connections on first use — catastrophic with high-latency RDS
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
    """Asynchronously initializes database tables and synchronizes Alembic migrations.

    Supported DB_MIGRATION modes:
      - 'false' (disabled): runs SQLModel.metadata.create_all (checkfirst=True); skips Alembic.
      - 'true'  (safe sync): creates missing tables, auto-stamps if unversioned, applies pending migrations.
      - 'force' (forced): executes alembic upgrade head directly through Alembic's migration engine.
    """
    raw_mode = getattr(settings, "DB_MIGRATION", "false")
    mode = str(raw_mode).strip().lower()

    if mode == "force":
        logger.info(
            "DB_MIGRATION is set to 'force'. Forcing execution of all Alembic migrations (alembic upgrade head)..."
        )
        try:
            from alembic.config import Config
            from alembic import command
            from pathlib import Path

            alembic_ini_path = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
            if alembic_ini_path.exists():
                alembic_cfg = Config(str(alembic_ini_path))
                alembic_cfg.attributes["dont_mutate_logger"] = True
                alembic_dir = alembic_ini_path.parent / "alembic"
                alembic_cfg.set_main_option("script_location", str(alembic_dir))
                await asyncio.to_thread(command.upgrade, alembic_cfg, "head")
                logger.info("Alembic forced migrations completed successfully.")
            else:
                logger.warning(f"alembic.ini not found at {alembic_ini_path}.")
        except Exception as mig_err:
            logger.error(f"Forced Alembic migration encountered error: {mig_err}")
            raise mig_err
        return

    # 1. Guarantee that any missing tables defined in SQLModel are created safely (checkfirst=True)
    logger.info(
        f"Verifying/initializing database tables on engine: {engine.url.drivername} ({engine.url.database})..."
    )
    async with engine.begin() as conn:
        from sqlalchemy import text

        # In-memory SQLite only (e.g. unit tests without Alembic migrations)
        if engine.url.drivername.startswith("sqlite"):
            res = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
            )
            if not res.scalar():
                await conn.run_sync(SQLModel.metadata.create_all)
            else:
                # Ensure preferred_language column exists in existing SQLite table
                cols_res = await conn.execute(text("PRAGMA table_info(users);"))
                col_names = [row[1] for row in cols_res.fetchall()]
                if "preferred_language" not in col_names:
                    await conn.execute(
                        text("ALTER TABLE users ADD COLUMN preferred_language VARCHAR(20) DEFAULT 'en';")
                    )
                    logger.info("Added preferred_language column to users table in SQLite.")
        elif engine.url.drivername.startswith("postgresql"):
            try:
                await conn.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'en';")
                )
            except Exception as e:
                logger.debug(f"Postgres column ensure preferred_language: {e}")

            try:
                await conn.execute(
                    text("""
                        CREATE TABLE IF NOT EXISTS site_settings (
                            id BIGINT PRIMARY KEY,
                            theme_name VARCHAR(50) NOT NULL DEFAULT 'crimson',
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL
                        )
                    """)
                )
                await conn.execute(
                    text("INSERT INTO site_settings (id, theme_name) VALUES (1, 'crimson') ON CONFLICT (id) DO NOTHING")
                )
                logger.info("Successfully verified/created site_settings table in PostgreSQL.")
            except Exception as e:
                logger.debug(f"Postgres table ensure site_settings: {e}")


        # Ensure critical unique indices exist for translation tables, FSRS memory state and concept retention upserts
        try:
            if engine.url.drivername.startswith("postgresql"):
                # 1. Translation tables unique indices
                q_res = await conn.execute(text("SELECT to_regclass('public.ix_q_trans_unique');"))
                o_res = await conn.execute(text("SELECT to_regclass('public.ix_opt_trans_unique');"))
                p_res = await conn.execute(text("SELECT to_regclass('public.ix_passage_trans_unique');"))
                if q_res.scalar() is None or o_res.scalar() is None or p_res.scalar() is None:
                    await conn.execute(
                        text("""
                            DELETE FROM question_translations 
                            WHERE id NOT IN (
                                SELECT MAX(id) FROM question_translations GROUP BY question_id, language
                            );
                        """)
                    )
                    await conn.execute(
                        text("CREATE UNIQUE INDEX IF NOT EXISTS ix_q_trans_unique ON question_translations (question_id, language);")
                    )
                    await conn.execute(
                        text("""
                            DELETE FROM option_translations 
                            WHERE id NOT IN (
                                SELECT MAX(id) FROM option_translations GROUP BY option_id, language
                            );
                        """)
                    )
                    await conn.execute(
                        text("CREATE UNIQUE INDEX IF NOT EXISTS ix_opt_trans_unique ON option_translations (option_id, language);")
                    )
                    await conn.execute(
                        text("""
                            DELETE FROM passage_translations 
                            WHERE id NOT IN (
                                SELECT MAX(id) FROM passage_translations GROUP BY passage_id, language
                            );
                        """)
                    )
                    await conn.execute(
                        text("CREATE UNIQUE INDEX IF NOT EXISTS ix_passage_trans_unique ON passage_translations (passage_id, language);")
                    )
                    logger.info("Successfully ensured unique indices on question_translations, option_translations, and passage_translations.")

                # 2. Memory state and concept retention indices
                m_res = await conn.execute(text("SELECT to_regclass('public.ix_memory_user_question');"))
                r_res = await conn.execute(text("SELECT to_regclass('public.ix_retention_user_subtopic');"))
                has_indices = (m_res.scalar() is not None) and (r_res.scalar() is not None)

                if not has_indices:
                    # Deduplicate any pre-existing rows (keeping the latest record by ID) so PostgreSQL can create the unique index
                    await conn.execute(
                        text("""
                            DELETE FROM user_memory_states 
                            WHERE question_id IS NOT NULL 
                              AND id NOT IN (
                                SELECT MAX(id) FROM user_memory_states WHERE question_id IS NOT NULL GROUP BY user_id, question_id
                              );
                        """)
                    )
                    await conn.execute(
                        text("""
                            DELETE FROM user_concept_retention 
                            WHERE subtopic_id IS NOT NULL 
                              AND id NOT IN (
                                SELECT MAX(id) FROM user_concept_retention WHERE subtopic_id IS NOT NULL GROUP BY user_id, subtopic_id
                              );
                        """)
                    )
                    await conn.execute(
                        text("CREATE UNIQUE INDEX IF NOT EXISTS ix_memory_user_question ON user_memory_states (user_id, question_id);")
                    )
                    await conn.execute(
                        text("CREATE UNIQUE INDEX IF NOT EXISTS ix_retention_user_subtopic ON user_concept_retention (user_id, subtopic_id);")
                    )
                    logger.info("Successfully ensured unique indices on user_memory_states and user_concept_retention.")
        except Exception as idx_err:
            logger.warning(f"Could not auto-create unique indices on startup: {idx_err}")
    logger.info("SQLModel table check complete.")

    # 2. If DB_MIGRATION is 'true', synchronize Alembic migration state safely
    if mode in ("true", "1", "yes"):
        logger.info("DB_MIGRATION is set to 'true'. Synchronizing Alembic migration state...")
        try:
            from alembic.config import Config
            from alembic import command
            from alembic.script import ScriptDirectory
            from pathlib import Path
            from sqlalchemy import text

            alembic_ini_path = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
            if alembic_ini_path.exists():
                alembic_cfg = Config(str(alembic_ini_path))
                alembic_cfg.attributes["dont_mutate_logger"] = True
                alembic_dir = alembic_ini_path.parent / "alembic"
                alembic_cfg.set_main_option("script_location", str(alembic_dir))

                # Check if alembic_version table exists and get current revision
                async with engine.connect() as conn:
                    res = await conn.execute(text("SELECT to_regclass('public.alembic_version');"))
                    has_version = res.scalar() is not None
                    current_rev = None
                    if has_version:
                        v_res = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1;"))
                        current_rev = v_res.scalar()

                if not has_version:
                    logger.info("alembic_version table not found. Stamping database to head...")
                    await asyncio.to_thread(command.stamp, alembic_cfg, "head")
                    logger.info("Database stamped to head revision successfully.")
                else:
                    script_dir = ScriptDirectory.from_config(alembic_cfg)
                    head_rev = script_dir.get_current_head()
                    logger.info(f"Database revision: {current_rev} | Head revision: {head_rev}")
                    if current_rev == head_rev:
                        logger.info("Database schema is already at head revision. No migration needed.")
                    else:
                        logger.info(f"Applying pending Alembic migrations ({current_rev} -> {head_rev})...")
                        await asyncio.to_thread(command.upgrade, alembic_cfg, "head")
                        logger.info("Alembic database synchronization completed successfully.")
            else:
                logger.warning(f"alembic.ini not found at {alembic_ini_path}.")
        except Exception as mig_err:
            logger.error(f"Alembic synchronization encountered error: {mig_err}")


async def warm_connection_pool():
    """Opens `pool_size` connections concurrently against RDS up front, at
    server boot, so every one of them has already paid its TCP+TLS+auth
    handshake before the first real request arrives. Without this, that
    handshake cost (0.3-0.6s+ per connection against this remote,
    high-latency RDS instance) gets paid lazily by whichever requests
    happen to be the first to need a given pool slot — including well
    after startup, any time traffic briefly needs more concurrent
    connections than are currently open (e.g. pool_recycle=1800s cycling
    an idle connection back out). Doing it once here means steady-state
    requests only ever check out an already-warm connection."""
    if db_url.startswith("sqlite"):
        return
    try:
        async def _touch():
            async with async_session_factory() as s:
                await s.exec(select(1))

        await asyncio.gather(*(_touch() for _ in range(pool_size)))
        logger.info(f"Warmed {pool_size} database connections in the pool.")
    except Exception as warm_err:
        logger.warning(f"Could not fully warm database connection pool: {warm_err}")


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator for FastAPI routes."""
    async with async_session_factory() as session:
        yield session


# Alias for backward compatibility
get_db = get_async_session
