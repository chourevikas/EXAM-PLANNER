import asyncio
from app.db.session import get_session
from sqlmodel import select
from app.db.models import Exam

async def main():
    async for session in get_session():
        res = await session.exec(select(Exam).limit(1))
        exam = res.first()
        if exam:
            print(exam.code, exam.name)
        break

asyncio.run(main())
