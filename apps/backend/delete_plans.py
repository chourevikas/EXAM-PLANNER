import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Assuming the db url is this based on typical setups in this project
DATABASE_URL = "postgresql+asyncpg://examplanner:examplanner_pass@localhost/examplanner_db"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Delete test plans
        await session.execute(text("TRUNCATE TABLE subscription_plans CASCADE;"))
        await session.execute(text("TRUNCATE TABLE discount_offers CASCADE;"))
        await session.execute(text("TRUNCATE TABLE subscription_audit_logs CASCADE;"))
        await session.commit()
        print("Successfully cleared all test premium data.")

if __name__ == "__main__":
    asyncio.run(main())
