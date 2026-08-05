import asyncio
from sqlmodel import select
from app.db.session import async_session_factory, async_init_db
from app.db.models.user import User, UserRole, UserStatus
from app.core.security import get_password_hash
from app.config.settings import settings
from app.config.logger import setup_logger

logger = setup_logger("SuperAdminInit")


async def init_superadmin():
    """
    Idempotent script to initialize the default Super Admin user.
    Reads credentials from Settings / environment variables.
    """
    logger.info("Ensuring database tables are initialized...")
    await async_init_db()

    email = getattr(settings, "SUPERADMIN_EMAIL", "admin@examplanner.com").lower()
    password = getattr(settings, "SUPERADMIN_PASSWORD", "SuperAdmin#2026!")
    full_name = getattr(settings, "SUPERADMIN_NAME", "System Super Admin")

    async with async_session_factory() as session:
        # Check if super admin with role or email exists
        stmt = select(User).where(
            (User.role == UserRole.SUPER_ADMIN) | (User.email == email)
        )
        res = await session.exec(stmt)
        existing_admin = res.first()

        if existing_admin:
            logger.info(
                f"Super Admin user already exists (Email: '{existing_admin.email}', Role: '{existing_admin.role.value}'). Skipping creation."
            )
            return existing_admin

        logger.info(f"Creating default Super Admin user '{email}'...")
        hashed_password = get_password_hash(password)

        super_admin = User(
            email=email,
            full_name=full_name,
            password_hash=hashed_password,
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            is_verified=True,
        )
        session.add(super_admin)
        await session.commit()
        await session.refresh(super_admin)
        logger.info(f"Successfully created Super Admin '{email}' (ID: {super_admin.id}).")
        return super_admin


if __name__ == "__main__":
    asyncio.run(init_superadmin())
