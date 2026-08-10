import asyncio
import uuid
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.db.session import async_init_db, engine
from app.db.models.gamification import Badge

# Default badges
BADGES = [
    {"name": "First Step", "description": "Started your preparation journey.", "required_xp": 50, "icon_url": "🌱"},
    {"name": "Consistency Starter", "description": "Maintained a 3-day study streak.", "required_xp": 150, "icon_url": "🔥"},
    {"name": "Level 5 Scholar", "description": "Reached Level 5 in total XP.", "required_xp": 2500, "icon_url": "🎓"},
    {"name": "7-Day Warrior", "description": "Maintained a 7-day study streak.", "required_xp": 500, "icon_url": "⚔️"},
    {"name": "Mock Master", "description": "Completed your first mock test.", "required_xp": 200, "icon_url": "🎯"},
]

async def seed_badges():
    print("Starting badge seeding...")
    async with AsyncSession(engine) as session:
        for b_data in BADGES:
            # Check if exists
            stmt = select(Badge).where(Badge.name == b_data["name"])
            res = await session.execute(stmt)
            if not res.scalars().first():
                new_badge = Badge(**b_data)
                session.add(new_badge)
                print(f"Added badge: {b_data['name']}")
        
        await session.commit()
    print("Badge seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_badges())
