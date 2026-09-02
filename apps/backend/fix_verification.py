import asyncio
from sqlmodel import select
from app.db.session import get_async_session
from app.db.models.user import User

async def main():
    async for session in get_async_session():
        users = (await session.exec(select(User))).all()
        for user in users:
            user.is_verified = True
            session.add(user)
        await session.commit()
        print(f"Updated {len(users)} users to is_verified=True")
        break

if __name__ == "__main__":
    asyncio.run(main())
