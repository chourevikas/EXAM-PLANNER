import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base, SessionLocal
import app.models  # Ensures all ORM models are registered with Base metadata
from app.models.user import User, UserRole, UserStatus
from app.core.security import get_password_hash
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.admin import router as admin_router
from app.routers.upload import router as upload_router
from app.core.exceptions import BaseAppException
from app.core.logging import logger

app = FastAPI(
  title=settings.PROJECT_NAME,
  openapi_url=f"{settings.API_V1_STR}/openapi.json",
  docs_url="/docs",
  redoc_url="/redoc"
)

# Comprehensive CORS Configuration
app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "*",
  ],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Custom App Exception Handler
@app.exception_handler(BaseAppException)
async def custom_app_exception_handler(request: Request, exc: BaseAppException):
  logger.warning(f"Domain exception on {request.url.path}: {exc.detail}")
  return JSONResponse(
    status_code=exc.status_code,
    content={"detail": exc.detail, "error_type": exc.__class__.__name__}
  )

# Global Fallback Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
  logger.error(f"Unhandled internal server error on {request.url.path}: {exc}", exc_info=True)
  return JSONResponse(
    status_code=500,
    content={"detail": "An internal server error occurred.", "error": str(exc)}
  )

# Mount uploads directory for static access
upload_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=upload_dir), name="uploads")

# Seed Super Admin Account on Startup
@app.on_event("startup")
def seed_super_admin():
  db = SessionLocal()
  try:
    super_admin_email = "superadmin@examplanner.com"
    existing = db.query(User).filter(User.email == super_admin_email).first()
    if not existing:
      super_admin = User(
        email=super_admin_email,
        full_name="Super Admin",
        password_hash=get_password_hash("SuperAdmin#2026"),
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        is_verified=True,
      )
      db.add(super_admin)
      db.commit()
      logger.info("Successfully seeded default Super Admin user: superadmin@examplanner.com")
  except Exception as e:
    logger.error(f"Failed to seed Super Admin: {e}")
  finally:
    db.close()

# Register API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(upload_router)  # Includes /upload, /api/v1/upload, /api/v1/admin/upload-paper

@app.get("/")
def root():
  return {
    "project": settings.PROJECT_NAME,
    "status": "online",
    "docs": "/docs"
  }
