"""Rules about *where* and *how* a session may be used, beyond a valid token."""
from fastapi import Request

from app.config.settings import settings
from app.db.models.enums import UserRole

CLIENT_APP_HEADER = "x-client-app"
SUPERADMIN_APP = "superadmin"


def client_app(request: Request | None) -> str:
    """Which front-end the request came through. Set (overwritten) by that app's reverse proxy."""
    if request is None:
        return ""
    return request.headers.get(CLIENT_APP_HEADER, "").strip().lower()


def superadmin_app_allowed(request: Request | None) -> bool:
    """A Super Admin session is only usable from the Super Admin app when enforcement is on."""
    return (not settings.SUPERADMIN_APP_ENFORCED) or client_app(request) == SUPERADMIN_APP


def mfa_setup_required(user) -> bool:
    return (
        user.role == UserRole.SUPER_ADMIN
        and settings.SUPERADMIN_MFA_REQUIRED
        and not user.totp_enabled
    )
