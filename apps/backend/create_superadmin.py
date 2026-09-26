import asyncio
from app.db.session import async_session_factory
from app.db.models.user import User, UserRole
from app.core.security import get_password_hash
from sqlmodel import select

async def main():
    async with async_session_factory() as session:
        result = await session.exec(select(User).where(User.email == "admin@examplanner.com"))
        user = result.first()
        if not user:
            print("Creating superadmin user...")
            new_user = User(
                email="admin@examplanner.com",
                password_hash=get_password_hash("SuperAdmin#2026!"),
                full_name="Super Admin",
                is_active=True,
                is_verified=True,
                role=UserRole.SUPERADMIN
            )
            session.add(new_user)
            await session.commit()
            print("Superadmin user created.")
        else:
            print("Superadmin user already exists.")
            user.password_hash = get_password_hash("SuperAdmin#2026!")
            session.add(user)
            await session.commit()
            print("Updated superadmin user password.")

if __name__ == "__main__":
    asyncio.run(main())
