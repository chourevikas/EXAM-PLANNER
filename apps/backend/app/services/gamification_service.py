import uuid
from datetime import datetime, date, timedelta, timezone
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException

from app.db.models.user import StudentProfile, User
from app.db.models.gamification import XPLog, Badge, UserBadge
from app.db.models.study_plan import StudyTask

class GamificationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def check_and_update_daily_goal(self, user_id: int) -> dict:
        # Get today's date
        today = datetime.now(timezone.utc).date()
        
        # Check if there are any incomplete tasks for today
        stmt = select(StudyTask).where(
            StudyTask.user_id == user_id,
            StudyTask.scheduled_date == today,
            StudyTask.is_completed == False
        )
        result = await self.session.execute(stmt)
        incomplete_tasks = result.scalars().all()
        
        if len(incomplete_tasks) > 0:
            return {"daily_goal_met": False, "message": "More tasks remaining for today."}

        # Daily goal met! Now update Gamification stats
        stmt = select(StudentProfile).where(StudentProfile.user_id == user_id)
        result = await self.session.execute(stmt)
        profile = result.scalars().first()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Student profile not found")
        
        streak_updated = False
        new_xp_awarded = 0
        level_up = False
        
        # Streak Logic
        last_study_date = profile.last_study_date.date() if profile.last_study_date else None
        
        if last_study_date != today:
            if last_study_date == today - timedelta(days=1):
                profile.current_streak += 1
            else:
                profile.current_streak = 1 # Reset or first streak
            
            profile.last_study_date = datetime.now(timezone.utc)
            if profile.current_streak > profile.highest_streak:
                profile.highest_streak = profile.current_streak
                
            streak_updated = True
            
            # Award XP for hitting daily goal
            xp_amount = 50
            new_xp_awarded = xp_amount
            profile.total_xp += xp_amount
            
            xp_log = XPLog(
                user_id=user_id,
                amount=xp_amount,
                source="DAILY_GOAL",
                description=f"Completed daily study goal for {today}"
            )
            self.session.add(xp_log)
            
            # Level Up Logic (simple: level = total_xp // 500 + 1)
            new_level = (profile.total_xp // 500) + 1
            if new_level > profile.level:
                profile.level = new_level
                level_up = True
            
            await self.session.commit()
            
            
            # Check for Badges
            new_unlocked_badges = await self._check_and_award_badges(user_id, profile)
            
        return {
            "daily_goal_met": True,
            "streak_updated": streak_updated,
            "current_streak": profile.current_streak,
            "new_xp": new_xp_awarded,
            "level_up": level_up,
            "new_level": profile.level,
            "new_badges": new_unlocked_badges if 'new_unlocked_badges' in locals() else []
        }

    async def _check_and_award_badges(self, user_id: int, profile: StudentProfile) -> list[str]:
        # Get all badges
        stmt = select(Badge)
        badges = (await self.session.execute(stmt)).scalars().all()
        
        # Get user's unlocked badges
        stmt_ub = select(UserBadge).where(UserBadge.user_id == user_id)
        user_badges = (await self.session.execute(stmt_ub)).scalars().all()
        unlocked_badge_ids = {ub.badge_id for ub in user_badges}
        
        newly_unlocked = []
        for badge in badges:
            if badge.id in unlocked_badge_ids:
                continue
            
            # Badge unlock conditions
            unlocked = False
            if badge.name == "First Step" and profile.total_xp >= 50:
                unlocked = True
            elif badge.name == "Consistency Starter" and profile.current_streak >= 3:
                unlocked = True
            elif badge.name == "7-Day Warrior" and profile.current_streak >= 7:
                unlocked = True
            elif badge.name == "Level 5 Scholar" and profile.level >= 5:
                unlocked = True
            elif badge.required_xp and profile.total_xp >= badge.required_xp:
                unlocked = True
                
            if unlocked:
                ub = UserBadge(user_id=user_id, badge_id=badge.id)
                self.session.add(ub)
                newly_unlocked.append(badge.name)
                
        if newly_unlocked:
            await self.session.commit()
            
        return newly_unlocked
