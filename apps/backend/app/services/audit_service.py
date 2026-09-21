from typing import Any, Optional

from fastapi import Request
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models.user import AdminActionLog, User

logger = setup_logger("AuditService")

# Action names written to admin_action_logs.
STAFF_CREATED = "STAFF_CREATED"
STAFF_CREDENTIALS_RESENT = "STAFF_CREDENTIALS_RESENT"
ROLE_CHANGED = "ROLE_CHANGED"
USER_SUSPENDED = "USER_SUSPENDED"
USER_REACTIVATED = "USER_REACTIVATED"
USER_DELETED = "USER_DELETED"
SUPERADMIN_LOGIN = "SUPERADMIN_LOGIN"
SUPERADMIN_LOGIN_FAILED = "SUPERADMIN_LOGIN_FAILED"
LOGIN_LOCKED = "LOGIN_LOCKED"
MFA_ENABLED = "MFA_ENABLED"
MFA_RESET = "MFA_RESET"
MFA_RECOVERY_CODE_USED = "MFA_RECOVERY_CODE_USED"
PASSWORD_CHANGED = "PASSWORD_CHANGED"


def client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


async def record_admin_action(
    session: AsyncSession,
    action: str,
    *,
    actor: Optional[User] = None,
    actor_email: Optional[str] = None,
    target: Optional[User] = None,
    target_id: Optional[int] = None,
    target_email: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Append an audit row. Never raises: an audit failure must not block the action itself."""
    try:
        session.add(
            AdminActionLog(
                actor_id=actor.id if actor else None,
                actor_email=(actor.email if actor else actor_email),
                action=action,
                target_user_id=target.id if target else target_id,
                target_email=(target.email if target else target_email),
                details=details,
                ip_address=client_ip(request),
            )
        )
        await session.commit()
    except Exception as err:  # pragma: no cover - defensive
        logger.warning(f"Could not record admin action {action}: {err}")
        await session.rollback()
