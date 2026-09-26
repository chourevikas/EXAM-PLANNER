import asyncio
from sqlalchemy import select
from app.db.session import engine_kwargs, create_async_engine, async_sessionmaker, AsyncSession
from app.config.settings import get_settings
from app.db.models.subscription import SubscriptionPlan

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
        result = await session.execute(select(SubscriptionPlan))
        for p in result.scalars().all():
            print(f"ID: {p.id}, Code: {p.plan_code}, Interval: {p.billing_interval.value if hasattr(p.billing_interval, 'value') else p.billing_interval}, Active: {p.is_active}")

if __name__ == "__main__":
    asyncio.run(main())
