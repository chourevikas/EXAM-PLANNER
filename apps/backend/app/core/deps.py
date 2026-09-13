import asyncio
import uuid
import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.settings import settings
from app.db.session import get_async_session, async_session_factory
from app.db.models.user import User, UserRole, UserStatus, SubscriptionTier
from app.repositories.user_repository import UserRepository

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)
http_bearer = HTTPBearer(auto_error=False)

# Cache PyJWKClient instances per issuer so Clerk's JWKS is fetched once and
# reused (cache_jwk_set/cache_keys) instead of being re-fetched over the
# network on every single request. Only used by verify_clerk_token, which
# backs the one-time POST /auth/clerk-exchange handshake — Clerk tokens are
# no longer accepted as ongoing bearer tokens by get_current_user.
_jwks_clients: dict[str, jwt.PyJWKClient] = {}


def _get_jwks_client(issuer: str) -> jwt.PyJWKClient:
    client = _jwks_clients.get(issuer)
    if client is None:
        jwks_url = f"{issuer}/.well-known/jwks.json"
        client = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        _jwks_clients[issuer] = client
    return client


async def verify_clerk_token(token: str) -> dict:
    """Verifies a Clerk-issued JWT via JWKS and returns its payload.

    Used only by the POST /auth/clerk-exchange handshake (see routers/auth.py)
    to mint our own session right after a Clerk OAuth login. Unlike the old
    inline verification this replaced, a verification failure always raises
    401 instead of silently falling back to trusting unverified claims.
    """
    try:
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
    except Exception as e:
        raise HTTPException(status_code=401, detail="Malformed Clerk token") from e

    issuer = unverified_claims.get("iss", "")
    if not issuer:
        raise HTTPException(status_code=401, detail="Clerk token missing issuer")

    try:
        jwks_client = _get_jwks_client(issuer)
        signing_key = await asyncio.to_thread(jwks_client.get_signing_key_from_jwt, token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            # Clerk's default leeway is sometimes needed
            leeway=60,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Clerk token") from e

    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Clerk token missing subject")
    return payload


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
            collision = (await session.exec(select(User).where(User.email == clerk_email, User.id != user.id))).first()
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
        query_email = select(User).where(User.email == clerk_email)
        res_email = await session.exec(query_email)
        user = res_email.one_or_none()
        if user:
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
            await session.exec(select(User).where(User.email == target_email))
        ).one_or_none()
        if existing_email_user:
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
        raise HTTPException(status_code=400, detail="Inactive user account")
    return user


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


FREE_CHALLENGE_LIMIT = 5


async def require_challenge_quota(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    """Gates challenge creation: PREMIUM users are unlimited, FREE/GUEST users
    are capped at FREE_CHALLENGE_LIMIT challenges created (lifetime)."""
    if current_user.subscription_tier == SubscriptionTier.PREMIUM:
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
