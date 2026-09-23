"""Turn off a Super Admin's authenticator (lost phone, no recovery codes).

    python -m app.scripts.reset_mfa admin@example.com

The next sign-in works with the password alone and then forces a fresh authenticator enrolment.
Run it only after confirming the person's identity out of band; it needs shell access to the server.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlmodel import select

from app.db.models.user import User, UserRole
from app.db.session import managed_async_session
from app.services import audit_service


async def reset_mfa(email: str) -> None:
    async with managed_async_session() as session:
        user = (await session.exec(select(User).where(User.email == email.strip().lower()))).first()
        if not user or user.role != UserRole.SUPER_ADMIN:
            raise SystemExit(f"No Super Admin with email '{email}'.")

        user.totp_secret = None
        user.totp_enabled = False
        user.totp_last_step = None
        user.totp_recovery_hashes = None
        session.add(user)
        await session.commit()
        await audit_service.record_admin_action(
            session, audit_service.MFA_RESET, target=user, details={"via": "reset_mfa script"},
        )
        print(f"Authenticator reset for {email}. They must enrol a new one at next sign-in.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m app.scripts.reset_mfa <super-admin-email>")
    asyncio.run(reset_mfa(sys.argv[1]))
