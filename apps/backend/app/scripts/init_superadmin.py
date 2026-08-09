import sys
import asyncio
from pathlib import Path

# Add project root (apps/backend) to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlmodel import select
from app.db.session import managed_async_session, async_init_db
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

    async with managed_async_session() as session:
        # Search for super admin by email or role
        stmt = select(User).where(User.email == email)
        res = await session.exec(stmt)
        existing_admin = res.first()

        hashed_password = get_password_hash(password)

        if existing_admin:
            logger.info(
                f"Super Admin user '{email}' found. Updating password hash..."
            )
            existing_admin.password_hash = hashed_password
            existing_admin.status = UserStatus.ACTIVE
            existing_admin.is_verified = True
            session.add(existing_admin)
            await session.commit()
            logger.info(f"Successfully updated Super Admin '{email}' credentials.")
            return existing_admin

        logger.info(f"Creating default Super Admin user '{email}'...")

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
