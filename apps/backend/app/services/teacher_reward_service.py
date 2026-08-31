from typing import List, Optional
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.teacher import TeacherReward


class TeacherRewardService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def grant_reward(
        self,
        teacher_id: int,
        admin_id: Optional[int],
        title: str,
        description: Optional[str] = None,
        points_value: Optional[int] = None,
    ) -> TeacherReward:
        reward = TeacherReward(
            teacher_id=teacher_id,
            admin_id=admin_id,
            title=title,
            description=description,
            points_value=points_value,
        )
        self.session.add(reward)
        await self.session.commit()
        await self.session.refresh(reward)
        return reward

    async def list_rewards_for_teacher(self, teacher_id: int) -> List[TeacherReward]:
        result = await self.session.exec(
            select(TeacherReward)
            .where(TeacherReward.teacher_id == teacher_id)
            .order_by(col(TeacherReward.created_at).desc())
        )
        return list(result.all())
