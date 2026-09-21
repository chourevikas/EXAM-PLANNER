from datetime import datetime, timedelta, timezone
from typing import Any, Union

# pyrefly: ignore [missing-import]
import jwt

# pyrefly: ignore [missing-import]
import bcrypt
from app.config.settings import settings


def get_password_hash(password: str) -> str:
    # Truncate password to 72 bytes as required by bcrypt specification
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)


import hashlib

def get_token_hash(token: str) -> str:
    """Use a fast SHA-256 hash for high-entropy tokens (like refresh tokens) instead of slow bcrypt."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def verify_token_hash(plain_token: str, hashed_token: str) -> bool:
    return get_token_hash(plain_token) == hashed_token


def create_access_token(
    subject: Union[str, Any], role: str, expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Super Admin tokens are short-lived; their app refreshes silently.
        minutes = (
            settings.SUPERADMIN_ACCESS_TOKEN_EXPIRE_MINUTES
            if role == "SUPER_ADMIN"
            else settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)

    to_encode = {"exp": expire, "sub": str(subject), "role": role, "type": "access"}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any], role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode = {"exp": expire, "sub": str(subject), "role": role, "type": "refresh"}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt
