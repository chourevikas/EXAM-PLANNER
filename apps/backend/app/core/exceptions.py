from fastapi import HTTPException, status

class BaseAppException(HTTPException):
  def __init__(self, status_code: int, detail: str):
    super().__init__(status_code=status_code, detail=detail)

class UserAlreadyExistsException(BaseAppException):
  def __init__(self, email: str):
    super().__init__(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=f"A user with email '{email}' already exists."
    )

class InvalidCredentialsException(BaseAppException):
  def __init__(self):
    super().__init__(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Incorrect email or password."
    )

class RoleMismatchException(BaseAppException):
  def __init__(self, actual_role: str, requested_role: str):
    super().__init__(
      status_code=status.HTTP_403_FORBIDDEN,
      detail=f"Account is registered as '{actual_role}', not '{requested_role}'."
    )

class InactiveUserException(BaseAppException):
  def __init__(self):
    super().__init__(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Inactive or suspended user account."
    )

class AdminPendingApprovalException(BaseAppException):
  def __init__(self):
    super().__init__(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Your admin account registration is pending Super Admin approval."
    )

class AdminRejectedException(BaseAppException):
  def __init__(self, reason: str = None):
    detail_msg = f"Your admin account application was rejected. Reason: {reason}" if reason else "Your admin account application was rejected by Super Admin."
    super().__init__(
      status_code=status.HTTP_403_FORBIDDEN,
      detail=detail_msg
    )
