import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select
from app.config.settings import settings
from app.db.models import Exam

async def run():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(select(Exam).where(Exam.exam_type_id == None))
        for e in result.scalars().all():
            print(f"{e.id} {e.name} {e.is_mixed_bank}")

if __name__ == '__main__':
    asyncio.run(run())
