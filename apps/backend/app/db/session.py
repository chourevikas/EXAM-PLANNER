from typing import AsyncGenerator
from sqlmodel import SQLModel
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from app.config.settings import get_settings
from app.config.logger import setup_logger

logger = setup_logger("DatabaseSession")
settings = get_settings()

db_url = settings.DATABASE_URL

if db_url.startswith("sqlite"):
    engine_kwargs = {"echo": False}
    engine = create_async_engine(db_url, **engine_kwargs)

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA cache_size=-64000;")  # 64MB Cache
        cursor.execute("PRAGMA busy_timeout=30000;")
        cursor.close()
else:
    engine_kwargs = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    }
    engine = create_async_engine(db_url, **engine_kwargs)

async_session_factory = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


async def async_init_db():
    """Asynchronously creates all missing tables and columns in the database."""
    logger.info(
        f"Initializing database tables on engine: {engine.url.drivername} ({engine.url.database})..."
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        if not db_url.startswith("sqlite"):
            await conn.execute(
                text(
                    "ALTER TABLE syllabus_versions ADD COLUMN IF NOT EXISTS title VARCHAR(200);"
                )
            )
            await conn.execute(
                text(
                    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code VARCHAR(50) DEFAULT 'DEFAULT';"
                )
            )
            await conn.execute(
                text(
                    "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_optional_subject BOOLEAN DEFAULT FALSE;"
                )
            )
            await conn.execute(
                text(
                    "ALTER TABLE subjects ALTER COLUMN is_optional_subject SET DEFAULT FALSE;"
                )
            )
            await conn.execute(
                text(
                    "ALTER TABLE topics ADD COLUMN IF NOT EXISTS code VARCHAR(50) DEFAULT 'DEFAULT';"
                )
            )
            await conn.execute(
                text(
                    "ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS code VARCHAR(50) DEFAULT 'DEFAULT';"
                )
            )
    logger.info("Database initialization complete.")


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator for FastAPI routes."""
    async with async_session_factory() as session:
        yield session


# Alias for backward compatibility
get_db = get_async_session
