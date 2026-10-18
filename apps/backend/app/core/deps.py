from typing import Optional
import asyncio
import uuid
import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.settings import settings
from app.db.session import get_async_session, async_session_factory
from app.db.models.user import User, UserRole, UserStatus, SubscriptionTier
from app.repositories.user_repository import UserRepository

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)
http_bearer = HTTPBearer(auto_error=False)

# Clerk is used only for "Sign in with Google". Its tokens are accepted solely by the one-time
# POST /auth/clerk-exchange handshake; get_current_user never accepts them.
#
# The signing keys come from Clerk's Backend API, authenticated with our CLERK_SECRET_KEY, so only
# tokens minted by OUR Clerk instance verify. (Never take the JWKS URL from the token's own `iss`
# claim: an attacker can point it at keys they control.)
CLERK_API_URL = "https://api.clerk.com/v1"
_GOOGLE_PROVIDERS = ("oauth_google", "google")
_jwks_client: Optional[jwt.PyJWKClient] = None


def _clerk_secret_key() -> str:
    secret = settings.CLERK_SECRET_KEY
    if not secret:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on the server.")
    return secret


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(
            f"{CLERK_API_URL}/jwks",
            cache_keys=True,
            lifespan=3600,
            # Clerk's edge rejects urllib's default "Python-urllib" User-Agent with 403.
            headers={"Authorization": f"Bearer {_clerk_secret_key()}", "User-Agent": "examplanner-api"},
            timeout=10,
        )
    return _jwks_client


def _clerk_authorized_parties() -> list[str]:
    raw = settings.CLERK_AUTHORIZED_PARTIES or ""
    return [p.strip().rstrip("/") for p in raw.split(",") if p.strip()]


async def verify_clerk_token(token: str) -> dict:
    """Verifies a session JWT from our Clerk instance and returns its payload.

    Used only by the POST /auth/clerk-exchange handshake (see routers/auth.py).
    Any verification failure raises 401; an unreachable Clerk API raises 503.
    """
    _clerk_secret_key()
    try:
        signing_key = await asyncio.to_thread(_get_jwks_client().get_signing_key_from_jwt, token)
    except jwt.PyJWKClientConnectionError as e:
        raise HTTPException(status_code=503, detail="Could not reach the sign-in provider.") from e
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Clerk token") from e

    try:
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"require": ["exp", "iat", "sub"]},
            # Clerk's default leeway is sometimes needed
            leeway=60,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Clerk token") from e

    allowed = _clerk_authorized_parties()
    if allowed and str(payload.get("azp", "")).rstrip("/") not in allowed:
        raise HTTPException(status_code=401, detail="Clerk token issued for another origin")
    return payload


async def fetch_clerk_google_identity(clerk_id: str) -> dict:
    """Looks the Clerk user up server-side and returns their Google-verified identity.

    Clerk is only used for Google sign-in, so a Clerk user without a verified Google account is
    refused. The email returned here is the only email ever trusted for linking accounts; nothing
    the browser sends is used for that.
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{CLERK_API_URL}/users/{clerk_id}",
                headers={"Authorization": f"Bearer {_clerk_secret_key()}"},
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail="Could not reach the sign-in provider.") from e
    if res.status_code == 404:
        raise HTTPException(status_code=401, detail="Unknown Clerk user")
    if res.status_code != 200:
        raise HTTPException(status_code=503, detail="Could not reach the sign-in provider.")
    data = res.json()

    email = None
    for acct in data.get("external_accounts") or []:
        verification = acct.get("verification") or {}
        if (
            acct.get("provider") in _GOOGLE_PROVIDERS
            and verification.get("status") == "verified"
            and acct.get("email_address")
        ):
            email = acct["email_address"]
            break
    if not email:
        # Older Clerk payloads mark the address itself as proven by Google.
        for addr in data.get("email_addresses") or []:
            verification = addr.get("verification") or {}
            if verification.get("status") == "verified" and verification.get("strategy") == "from_oauth_google":
                email = addr.get("email_address")
                break
    if not email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please sign in with Google.",
        )

    full_name = f"{data.get('first_name') or ''} {data.get('last_name') or ''}".strip() or None
    return {
        "email": email.strip().lower(),
        "full_name": full_name,
        "profile_image": data.get("image_url") or data.get("profile_image_url"),
    }


async def get_or_create_user_from_clerk(
    session: AsyncSession,
    clerk_id: str,
    clerk_email: str | None,
    name: str | None,
    profile_image: str | None = None,
) -> User:
    """Links or provisions a local User row for a verified Clerk identity.

    Lookup order: by clerk_id, then by email (backfilling clerk_id onto that
    row), then creates a new User. Used only by POST /auth/clerk-exchange.
    """
    # Rows made by the password flow store lowercase emails; Clerk may send mixed case. Compare lowercased
    # so a returning student links to their existing account instead of getting a duplicate one.
    clerk_email = clerk_email.strip().lower() if clerk_email else None

    query = select(User).where(User.clerk_id == clerk_id)
    result = await session.exec(query)
    user = result.one_or_none()

    placeholder_names = {"Clerk Sync User", "Clerk Account", "Aspirant", ""}

    if user:
        updated = False
        if name and (
            not user.full_name
            or user.full_name in placeholder_names
            or user.full_name.startswith("Candidate #")
            or user.full_name != name
        ):
            user.full_name = name
            updated = True
        if clerk_email and (not user.email or user.email.endswith("@clerk.local")):
            collision = (await session.exec(select(User).where(func.lower(User.email) == clerk_email, User.id != user.id))).first()
            if not collision:
                user.email = clerk_email
                updated = True
        if profile_image and (not user.profile_image or user.profile_image != profile_image):
            user.profile_image = profile_image
            updated = True
        if updated:
            session.add(user)
            await session.commit()
            await session.refresh(user)
            from app.cache import invalidate_user_cache, get_cache
            await invalidate_user_cache(str(user.id), user.clerk_id)
            cache = get_cache()
            await cache.delete_pattern("ep:users:list*")
            await cache.delete_pattern("users:list*")
            await cache.delete_pattern("ep:admin:*")

    if not user and clerk_email:
        query_email = select(User).where(func.lower(User.email) == clerk_email)
        res_email = await session.exec(query_email)
        user = res_email.first()
        if user:
            _refuse_staff_email_linking(user)
            user.clerk_id = clerk_id
            if name and (not user.full_name or user.full_name in placeholder_names):
                user.full_name = name
            if profile_image and not user.profile_image:
                user.profile_image = profile_image
            session.add(user)
            await session.commit()
            await session.refresh(user)
            from app.cache import invalidate_user_cache, get_cache
            await invalidate_user_cache(str(user.id), user.clerk_id)
            cache = get_cache()
            await cache.delete_pattern("ep:users:list*")
            await cache.delete_pattern("users:list*")
            await cache.delete_pattern("ep:admin:*")

    if not user:
        target_email = clerk_email or f"{clerk_id}@clerk.local"
        existing_email_user = (
            await session.exec(select(User).where(func.lower(User.email) == target_email.lower()))
        ).first()
        if existing_email_user:
            _refuse_staff_email_linking(existing_email_user)
            existing_email_user.clerk_id = clerk_id
            if name and (not existing_email_user.full_name or existing_email_user.full_name in placeholder_names):
                existing_email_user.full_name = name
            if profile_image and not existing_email_user.profile_image:
                existing_email_user.profile_image = profile_image
            session.add(existing_email_user)
            await session.commit()
            await session.refresh(existing_email_user)
            user = existing_email_user
        else:
            user = User(
                clerk_id=clerk_id,
                email=target_email,
                full_name=name or "Clerk Sync User",
                profile_image=profile_image,
                status=UserStatus.ACTIVE,
                role=UserRole.STUDENT,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        from app.cache import invalidate_user_cache, get_cache
        await invalidate_user_cache(str(user.id), user.clerk_id)
        cache = get_cache()
        await cache.delete_pattern("ep:users:list*")
        await cache.delete_pattern("users:list*")
        await cache.delete_pattern("ep:admin:*")

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is no longer active. Please contact support to restore access.",
        )
    return user


def _refuse_staff_email_linking(user: User) -> None:
    """A Clerk identity must never be attached to an existing staff account just because the email matches.

    Staff accounts sign in with email + password (and MFA for Super Admins). Linking by email would let
    anyone who can create a Clerk account with a staff address take that account over.
    """
    if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff accounts sign in with their email and password.",
        )


# A user still on an emailed temporary password may only reach these until they change it.
_PASSWORD_CHANGE_ALLOWED_SUFFIXES = ("/auth/me", "/auth/change-password", "/auth/logout")
# A Super Admin who has not enrolled an authenticator yet may only enrol it.
_MFA_SETUP_ALLOWED_SUFFIXES = _PASSWORD_CHANGE_ALLOWED_SUFFIXES + ("/auth/mfa/setup", "/auth/mfa/verify")


def _enforce_session_policy(request: Request, user: User) -> None:
    """Extra conditions on an otherwise valid token (temp password, app separation, MFA enrolment)."""
    from app.core.session_policy import mfa_setup_required, superadmin_app_allowed

    path = request.url.path.rstrip("/")

    if getattr(user, "must_change_password", False) and not path.endswith(_PASSWORD_CHANGE_ALLOWED_SUFFIXES):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PASSWORD_CHANGE_REQUIRED")

    if user.role == UserRole.SUPER_ADMIN:
        if not superadmin_app_allowed(request):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SUPERADMIN_APP_REQUIRED")
        if mfa_setup_required(user) and not path.endswith(_MFA_SETUP_ALLOWED_SUFFIXES):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="MFA_SETUP_REQUIRED")


async def get_current_user(
    request: Request,
    token_oauth2: str | None = Depends(reusable_oauth2),
    token_bearer: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    db_session: AsyncSession | None = Depends(get_async_session),
) -> User:
    token: str | None = None

    if token_bearer and token_bearer.credentials:
        token = token_bearer.credentials
    elif token_oauth2:
        token = token_oauth2

    # Fallback to direct HTTP Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            if auth_header.lower().startswith("bearer "):
                token = auth_header[7:].strip()
            else:
                token = auth_header.strip()

    # Fallback to cookie
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.cache import get_cache
    from fastapi.encoders import jsonable_encoder
    cache = get_cache()

    session_ctx = None
    if isinstance(db_session, AsyncSession):
        session = db_session
    else:
        session_ctx = async_session_factory()
        session = await session_ctx.__aenter__()

    try:
        # Custom JWT verification only — Clerk tokens are no longer accepted
        # here. A Clerk OAuth login is exchanged for one of these via
        # POST /auth/clerk-exchange (see routers/auth.py), so every request
        # that reaches this dependency carries a backend-issued JWT.
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user_id_str: str = payload.get("sub")
        if user_id_str:
            cache_key = f"ep:user:id:{user_id_str}"
            cached_user = await cache.get(cache_key)
            if cached_user and isinstance(cached_user, dict):
                user = User.model_validate(cached_user)
                if user.status == UserStatus.ACTIVE:
                    _enforce_session_policy(request, user)
                    return user


            try:
                user_id_val = int(user_id_str) if str(user_id_str).isdigit() else user_id_str
                user_repo = UserRepository(session)
                user = await user_repo.get_by_id(user_id_val)
                if user and user.status == UserStatus.ACTIVE:
                    user_dict = jsonable_encoder(user.model_dump())
                    await cache.set(cache_key, user_dict, ttl_seconds=300)
                    if user.clerk_id:
                        await cache.set(f"ep:user:clerk:{user.clerk_id}", user_dict, ttl_seconds=300)
                    _enforce_session_policy(request, user)
                    return user
            except (ValueError, TypeError):
                pass

    except HTTPException:
        raise
    except Exception:
        pass
    finally:
        if session_ctx is not None:
            await session_ctx.__aexit__(None, None, None)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )





def require_roles(allowed_roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{current_user.role}' is not authorized for this resource",
            )
        return current_user

    return role_checker


async def _user_has_permission(
    session: AsyncSession, current_user: User, permission_key: str
) -> bool:
    """Resolves the user's effective custom-role permissions with Redis caching.

    A user's fine-grained permissions come from `custom_role_id` when set. A
    TEACHER-role user with no custom_role_id (e.g. promoted via the legacy
    PUT /admin/users/{id}/role endpoint) falls back to the single seeded
    system "Teacher" role, so plain role promotion still grants the Teacher
    permission set without requiring the admin to also assign a custom role.
    """
    from app.db.models.roles import Role, RolePermission, Permission
    from app.cache import get_cache
    from app.config.settings import get_settings

    cache = get_cache()
    prefix = get_settings().CACHE_KEY_PREFIX or "ep"

    effective_role_id = current_user.custom_role_id
    if effective_role_id is None and current_user.role == UserRole.TEACHER:
        teacher_role_cache_key = f"{prefix}:role:slug:teacher"
        cached_teacher_id = await cache.get(teacher_role_cache_key)
        if cached_teacher_id is not None:
            effective_role_id = int(cached_teacher_id)
        else:
            result = await session.exec(select(Role.id).where(Role.slug == "teacher"))
            effective_role_id = result.first()
            if effective_role_id is not None:
                await cache.set(teacher_role_cache_key, effective_role_id, ttl_seconds=3600)

    if effective_role_id is None:
        return False

    role_perms_key = f"{prefix}:role:{effective_role_id}:permissions"
    cached_perms = await cache.get(role_perms_key)
    if cached_perms is not None and isinstance(cached_perms, (list, set)):
        return permission_key in cached_perms

    query = (
        select(Permission.key)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .where(RolePermission.role_id == effective_role_id)
    )
    result = await session.exec(query)
    perms = list(result.all())
    await cache.set(role_perms_key, perms, ttl_seconds=1800)
    return permission_key in perms


def require_permission(permission_key: str):
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_async_session),
    ) -> User:
        if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return current_user
        if await _user_has_permission(session, current_user, permission_key):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing required permission '{permission_key}'",
        )

    return permission_checker


def require_roles_or_permission(allowed_roles: list[UserRole], permission_key: str):
    async def checker(
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_async_session),
    ) -> User:
        if current_user.role in allowed_roles:
            return current_user
        if await _user_has_permission(session, current_user, permission_key):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"User role '{current_user.role}' is not authorized for this "
                f"resource and lacks permission '{permission_key}'"
            ),
        )

    return checker


# ── Student-facing question visibility ──────────────────────────────────────
# Students (and anonymous visitors) are only served PUBLISHED questions. Staff (admins, teachers)
# still see drafts, pending-review and unpublished questions so they can review and fix them.
STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)


async def get_optional_user(
    request: Request,
    token_oauth2: str | None = Depends(reusable_oauth2),
    token_bearer: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    db_session: AsyncSession | None = Depends(get_async_session),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising when there is no valid login."""
    try:
        return await get_current_user(request, token_oauth2, token_bearer, db_session)
    except HTTPException:
        return None


def can_see_unpublished(user: Optional[User]) -> bool:
    return user is not None and user.role in STAFF_ROLES


async def require_question_visible(
    question_id: str,
    session: AsyncSession = Depends(get_async_session),
    user: Optional[User] = Depends(get_optional_user),
) -> None:
    """Route dependency for /questions/{question_id}/...: 404 unless the question is published (staff exempt)."""
    if can_see_unpublished(user):
        return
    from app.db.models.question import Question
    from app.db.models.enums import QuestionStatus

    not_found = HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
    try:
        qid = int(question_id)
    except (TypeError, ValueError):
        raise not_found
    current = (await session.exec(select(Question.status).where(Question.id == qid))).first()
    if current != QuestionStatus.PUBLISHED:
        raise not_found


async def require_exam_question_visible(
    exam_id: str,
    question_number: int,
    session: AsyncSession = Depends(get_async_session),
    user: Optional[User] = Depends(get_optional_user),
) -> None:
    """Route dependency for /exams/{exam_id}/...-{artifact|db}/{question_number}."""
    if can_see_unpublished(user):
        return
    from app.db.models.question import Question
    from app.db.models.enums import QuestionStatus

    not_found = HTTPException(status_code=404, detail="Question not found.")
    try:
        eid = int(exam_id)
    except (TypeError, ValueError):
        raise not_found
    current = (
        await session.exec(
            select(Question.status).where(Question.exam_id == eid, Question.question_number_in_paper == question_number)
        )
    ).first()
    if current != QuestionStatus.PUBLISHED:
        raise not_found


# ── Admin section permissions ────────────────────────────────────────────────
# Each admin-panel section has one permission key. SUPER_ADMIN always passes. An ADMIN with no
# custom role is unrestricted (existing admins keep full access); an ADMIN with a custom role is
# limited to the permissions that role was granted.
ADMIN_SECTION_PERMISSIONS = {
    "admin.upload": "Upload & Exam Pipeline",
    "admin.exam_types": "Exam Types",
    "admin.review": "Question & Solution QA",
    "admin.question_bank": "Question Bank Catalog",
    "admin.reported_questions": "Reported Questions",
    "admin.users": "Users",
    "admin.teacher_rewards": "Teacher Rewards",
    "admin.current_affairs": "Current Affairs",
    "admin.notifications": "Notifications",
    "admin.milestones": "Milestones",
    "admin.translations": "Translations",
    "admin.testimonials": "Testimonial Approvals",
    "admin.analytics": "Reports & Analytics",
    "admin.theme": "Theme",
}


async def admin_section_access(
    session: AsyncSession, current_user: User, section_key: str
) -> bool:
    if current_user.role == UserRole.SUPER_ADMIN:
        return True
    if current_user.role != UserRole.ADMIN:
        return False
    if current_user.custom_role_id is None:
        return True
    return await _user_has_permission(session, current_user, section_key)


async def effective_admin_permissions(
    session: AsyncSession, current_user: User
) -> Optional[list[str]]:
    """None = unrestricted; otherwise the admin section keys this user may use."""
    if current_user.role != UserRole.ADMIN or current_user.custom_role_id is None:
        return None
    return [
        key
        for key in ADMIN_SECTION_PERMISSIONS
        if await _user_has_permission(session, current_user, key)
    ]


def require_admin_section(*section_keys: str):
    """Allow if the user may use ANY of the given admin sections (some endpoints serve two screens)."""

    async def checker(
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_async_session),
    ) -> User:
        for key in section_keys:
            if await admin_section_access(session, current_user, key):
                return current_user
        names = ", ".join(ADMIN_SECTION_PERMISSIONS.get(k, k) for k in section_keys)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have access to this section ({names}).",
        )

    return checker


def require_admin_section_or_permission(section_key: str, permission_key: str):
    """Admins go through their section grant; other roles (e.g. teachers) use a fine-grained permission."""

    async def checker(
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_async_session),
    ) -> User:
        if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            if await admin_section_access(session, current_user, section_key):
                return current_user
        elif await _user_has_permission(session, current_user, permission_key):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this resource.",
        )

    return checker


FREE_CHALLENGE_LIMIT = 5


async def require_challenge_quota(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    """Gates challenge creation: PREMIUM users are unlimited, FREE/GUEST users
    are capped at FREE_CHALLENGE_LIMIT challenges created (lifetime)."""
    from app.services.user_service import get_subscription_tier
    if await get_subscription_tier(session, current_user.id) == SubscriptionTier.PREMIUM.value:
        return current_user

    from sqlalchemy import func
    from app.db.models.challenge import Challenge

    count = (await session.exec(
        select(func.count()).select_from(Challenge).where(Challenge.creator_id == current_user.id)
    )).one()
    if (count or 0) >= FREE_CHALLENGE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "CHALLENGE_LIMIT_REACHED",
                "message": f"Free plan is limited to {FREE_CHALLENGE_LIMIT} challenges. Upgrade to Pro to create more.",
                "limit": FREE_CHALLENGE_LIMIT,
            },
        )
    return current_user
