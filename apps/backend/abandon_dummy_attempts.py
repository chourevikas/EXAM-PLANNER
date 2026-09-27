import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config.settings import settings

async def run():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        result = await conn.execute(text("UPDATE exam_attempts SET status='ABANDONED' WHERE status='IN_PROGRESS' AND exam_id IN (SELECT id FROM exams WHERE is_mixed_bank=true)"))
        print(f"Updated {result.rowcount} attempts to ABANDONED")

if __name__ == '__main__':
    asyncio.run(run())
