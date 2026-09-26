import asyncio
from app.db.session import engine_kwargs, create_async_engine, async_sessionmaker, AsyncSession
from app.config.settings import get_settings
from sqlalchemy import text

async def main():
    settings = get_settings()
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    if "asyncpg" in db_url and "sslmode=" in db_url:
        db_url = db_url.replace("sslmode=", "ssl=")
        
    engine = create_async_engine(db_url, **engine_kwargs)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with session_maker() as session:
        await session.execute(text("TRUNCATE TABLE subscription_plans CASCADE;"))
        await session.execute(text("TRUNCATE TABLE discount_offers CASCADE;"))
        await session.execute(text("TRUNCATE TABLE subscription_audit_logs CASCADE;"))
        await session.commit()
        print("Successfully truncated tables!")

if __name__ == "__main__":
    asyncio.run(main())
