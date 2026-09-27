import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select, update
from app.config.settings import settings
from app.db.models import Exam

async def run():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        stmt = select(Exam).where(Exam.exam_type_id == None)
        result = await session.execute(stmt)
        exams = result.scalars().all()
        for e in exams:
            print(f"Setting is_mixed_bank=True for {e.name}")
            e.is_mixed_bank = True
            session.add(e)
        await session.commit()
    print("Done")

if __name__ == '__main__':
    asyncio.run(run())
