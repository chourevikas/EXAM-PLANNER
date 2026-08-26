import asyncio
import uuid
from datetime import datetime, timezone
from sqlmodel import select
from app.db.session import get_async_session
from app.db.models.user import User, StudentProfile
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, AttemptStatus
from app.db.models.telemetry import UserTestAttempt, UserQuestionResponse
from app.db.models.study_plan import StudyActivity

async def check():
    async for session in get_async_session():
        stmt = select(User).where(User.email == "nicknpdp@gmail.com")
        res = await session.exec(stmt)
        user = res.first()
        if not user:
            print("User nicknpdp@gmail.com not found")
            return
        
        print(f"User ID: {user.id}")
        print(f"User Email: {user.email}")
        
        # Student profile
        stmt_prof = select(StudentProfile).where(StudentProfile.user_id == user.id)
        res_prof = await session.exec(stmt_prof)
        prof = res_prof.first()
        if prof:
            print(f"Profile found: streak={prof.current_streak}, highest={prof.highest_streak}, xp={prof.total_xp}, level={prof.level}, last_study={prof.last_study_date}")
        else:
            print("No StudentProfile record found for user!")

        # Exam Attempts
        stmt_att = select(ExamAttempt).where(ExamAttempt.user_id == user.id)
        res_att = await session.exec(stmt_att)
        attempts = res_att.all()
        print(f"Total Exam Attempts count: {len(attempts)}")
        for a in attempts:
            print(f"  Attempt ID: {a.id}, status: {a.status}, correct: {a.total_correct}, incorrect: {a.total_incorrect}, total: {a.total_questions}, submitted_at: {a.submitted_at}, created_at: {a.created_at}")

        # Telemetry attempts
        stmt_uatt = select(UserTestAttempt).where(UserTestAttempt.user_id == user.id)
        res_uatt = await session.exec(stmt_uatt)
        uattempts = res_uatt.all()
        print(f"Total Telemetry UserTestAttempts count: {len(uattempts)}")
        for ua in uattempts:
            print(f"  Telemetry Attempt ID: {ua.id}, status: {ua.status}, score: {ua.score}, ended_at: {ua.ended_at}, started_at: {ua.started_at}")

        # Study Activities
        stmt_act = select(StudyActivity).where(StudyActivity.user_id == user.id)
        res_act = await session.exec(stmt_act)
        activities = res_act.all()
        print(f"Total Study Activities count: {len(activities)}")
        for act in activities:
            print(f"  Activity ID: {act.id}, type: {act.activity_type}, questions: {act.questions_attempted}, date: {act.date}")

if __name__ == "__main__":
    asyncio.run(check())
