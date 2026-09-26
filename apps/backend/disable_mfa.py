import asyncio
from app.db.session import async_session_factory
from app.db.models.user import User
from sqlmodel import select

async def main():
    async with async_session_factory() as session:
        user = (await session.exec(select(User).where(User.email == "admin@examplanner.com"))).first()
        if user:
            user.totp_enabled = False
            session.add(user)
            await session.commit()
            print("Disabled MFA for superadmin")
        else:
            print("Superadmin not found")

if __name__ == "__main__":
    asyncio.run(main())
