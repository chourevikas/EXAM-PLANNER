from datetime import datetime, timedelta, timezone
from typing import Any, Union
# pyrefly: ignore [missing-import]
import jwt
# pyrefly: ignore [missing-import]
import bcrypt
from app.config import settings

def get_password_hash(password: str) -> str:
  # Truncate password to 72 bytes as required by bcrypt specification
  pwd_bytes = password.encode('utf-8')[:72]
  salt = bcrypt.gensalt()
  hashed = bcrypt.hashpw(pwd_bytes, salt)
  return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
  pwd_bytes = plain_password.encode('utf-8')[:72]
  hashed_bytes = hashed_password.encode('utf-8')
  return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def create_access_token(subject: Union[str, Any], role: str, expires_delta: timedelta = None) -> str:
  if expires_delta:
    expire = datetime.now(timezone.utc) + expires_delta
  else:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
  
  to_encode = {
    "exp": expire,
    "sub": str(subject),
    "role": role,
    "type": "access"
  }
  encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
  return encoded_jwt

def create_refresh_token(subject: Union[str, Any], role: str) -> str:
  expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
  to_encode = {
    "exp": expire,
    "sub": str(subject),
    "role": role,
    "type": "refresh"
  }
  encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
  return encoded_jwt
