from fastapi import APIRouter, Depends, Response, status, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.schemas.auth import (
    UserRegister, UserLogin, TokenResponse, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest
)
from app.services.auth_service import AuthService
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, response: Response, session: AsyncSession = Depends(get_async_session)):
    auth_service = AuthService(session)
    token_response, refresh_token = await auth_service.register_user(user_in)
    
    if refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            samesite="lax",
            secure=False,
        )
    return token_response


@router.post("/login", response_model=TokenResponse)
async def login(user_in: UserLogin, response: Response, session: AsyncSession = Depends(get_async_session)):
    auth_service = AuthService(session)
    token_response, refresh_token = await auth_service.authenticate_user(user_in)
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return token_response


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_async_session)):
    auth_service = AuthService(session)
    await auth_service.logout_user(current_user.id)
    response.delete_cookie("refresh_token")
    return {"message": "Successfully logged out"}


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(req: VerifyEmailRequest, session: AsyncSession = Depends(get_async_session)):
    auth_service = AuthService(session)
    success = await auth_service.verify_email(req.token)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    return {"message": "Email verified successfully"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(req: ForgotPasswordRequest, session: AsyncSession = Depends(get_async_session)):
    auth_service = AuthService(session)
    await auth_service.forgot_password(req.email)
    return {"message": "If that email is registered, a password reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(req: ResetPasswordRequest, session: AsyncSession = Depends(get_async_session)):
    auth_service = AuthService(session)
    success = await auth_service.reset_password(req.token, req.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserOut)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/admin-only", response_model=dict)
async def admin_dashboard_access(current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    return {"message": f"Welcome Admin {current_user.full_name}", "role": current_user.role}


@router.get("/super-admin-only", response_model=dict)
async def super_admin_access(current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    return {"message": f"Welcome Super Admin {current_user.full_name}", "role": current_user.role}
