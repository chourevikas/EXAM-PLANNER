import asyncio
from sqlmodel import select, func, case
from app.db.session import async_session_factory
from app.db.models.challenge import ChallengeAttempt, ChallengeAttemptStatus

async def test():
    async with async_session_factory() as session:
        # test list my challenges query
        try:
            stats_stmt = (
                select(
                    ChallengeAttempt.challenge_id,
                    func.count().label("attempt_count"),
                    func.max(case((ChallengeAttempt.user_id == 1, ChallengeAttempt.total_score), else_=None)).label("my_best"),
                )
                .where(
                    ChallengeAttempt.challenge_id.in_([1,2,3]),
                    ChallengeAttempt.status == ChallengeAttemptStatus.SUBMITTED,
                )
                .group_by(ChallengeAttempt.challenge_id)
            )
            res = await session.exec(stats_stmt)
            print("Query 1 success")
        except Exception as e:
            print("Query 1 failed:", e)
            await session.rollback()

        # test get challenge summary query
        try:
            my_best = (await session.exec(
                select(func.max(ChallengeAttempt.total_score)).where(
                    ChallengeAttempt.challenge_id == 1,
                    ChallengeAttempt.user_id == 1,
                    ChallengeAttempt.status == ChallengeAttemptStatus.SUBMITTED,
                )
            )).first()
            print("Query 2 success")
        except Exception as e:
            print("Query 2 failed:", e)
            await session.rollback()
            
        try:
            from app.services.challenge_service import ChallengeService
            service = ChallengeService(session)
            class MockUser:
                id = 1
                full_name = "test"
            await service.list_my_challenges(MockUser())
            print("list_my_challenges success")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print("list_my_challenges failed:", e)

asyncio.run(test())
