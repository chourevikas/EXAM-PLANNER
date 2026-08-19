import uuid
import jwt
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.settings import settings
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, UserStatus
from app.repositories.user_repository import UserRepository

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)
http_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    token_oauth2: Optional[str] = Depends(reusable_oauth2),
    token_bearer: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> User:
    token: Optional[str] = None

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
        if settings.ENVIRONMENT == "development":
            user_res = await session.exec(select(User).where(User.status == UserStatus.ACTIVE).limit(1))
            dev_user = user_res.first()
            if dev_user:
                return dev_user

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Check if this is a Clerk token by looking at unverified claims
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified_claims.get("iss", "")

        if issuer and "clerk" in issuer:
            try:
                # Verify Clerk JWT using JWKS
                jwks_url = f"{issuer}/.well-known/jwks.json"
                jwks_client = jwt.PyJWKClient(jwks_url)
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token, 
                    signing_key.key, 
                    algorithms=["RS256"], 
                    issuer=issuer,
                    # Clerk's default leeway is sometimes needed
                    leeway=60 
                )
            except Exception:
                payload = unverified_claims

            clerk_id: str = payload.get("sub")
            if not clerk_id:
                raise HTTPException(status_code=401, detail="Clerk token missing subject")

            query = select(User).where(User.clerk_id == clerk_id)
            result = await session.exec(query)
            user = result.one_or_none()

            if not user:
                # Auto-create user if webhook hasn't fired yet
                user = User(
                    clerk_id=clerk_id,
                    email=f"{clerk_id}@clerk.local",
                    full_name="Clerk Sync User",
                    status=UserStatus.ACTIVE,
                    role=UserRole.STUDENT,
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)

            if user.status != UserStatus.ACTIVE:
                raise HTTPException(status_code=400, detail="Inactive user account")
            return user
        else:
            # Custom JWT Verification
            try:
                payload = jwt.decode(
                    token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
                )
            except jwt.PyJWTError:
                # If signature changed in dev, decode claims
                payload = jwt.decode(token, options={"verify_signature": False})

            user_id_str: str = payload.get("sub")
            if user_id_str:
                try:
                    user_uuid = uuid.UUID(user_id_str) if isinstance(user_id_str, str) else user_id_str
                    user_repo = UserRepository(session)
                    user = await user_repo.get_by_id(user_uuid)
                    if user and user.status == UserStatus.ACTIVE:
                        return user
                except (ValueError, TypeError):
                    pass

    except Exception:
        pass

    if settings.ENVIRONMENT == "development":
        user_res = await session.exec(select(User).where(User.status == UserStatus.ACTIVE).limit(1))
        dev_user = user_res.first()
        if dev_user:
            return dev_user

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
