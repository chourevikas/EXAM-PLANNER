import asyncio
from app.services.exam_session_service import ExamSessionService
from app.db.session import async_session_maker
from app.schemas.exam_attempt import StartExamRequest

async def main():
    async with async_session_maker() as session:
        service = ExamSessionService(session)
        req = StartExamRequest(exam_id=32)
        try:
            await service.start_exam(user_id=1, req=req)
        except Exception as e:
            import traceback
            traceback.print_exc()

asyncio.run(main())
