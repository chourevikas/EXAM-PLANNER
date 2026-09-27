import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select
from app.config.settings import settings
from app.db.models import Exam, ExamAttempt

async def run():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        # Find all attempts that are IN_PROGRESS and linked to an exam with is_mixed_bank=True
        stmt = select(ExamAttempt).join(Exam).where(ExamAttempt.status == 'IN_PROGRESS', Exam.is_mixed_bank == True)
        result = await session.execute(stmt)
        attempts = result.scalars().all()
        for attempt in attempts:
            print(f"Deleting attempt {attempt.id} for exam {attempt.exam_id}")
            await session.delete(attempt)
        await session.commit()

if __name__ == '__main__':
    asyncio.run(run())
