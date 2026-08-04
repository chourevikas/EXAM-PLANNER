import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole

reusable_oauth2 = OAuth2PasswordBearer(
  tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

def get_current_user(
  db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
  try:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    user_id: str = payload.get("sub")
    if user_id is None:
      raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
      )
  except jwt.PyJWTError:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Could not validate credentials",
    )
  
  user = db.query(User).filter(User.id == user_id).first()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  if user.status != "ACTIVE":
    raise HTTPException(status_code=400, detail="Inactive user account")
  return user

def require_roles(allowed_roles: list[UserRole]):
  def role_checker(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in allowed_roles:
      raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"User role '{current_user.role}' is not authorized for this resource"
      )
    return current_user
  return role_checker
