import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config.settings import settings
from app.db.session import async_init_db
from app.core.exceptions import BaseAppException
from app.config.logger import setup_logger

logger = setup_logger("FastAPIServer")


from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.admin import router as admin_router
from app.routers.exams import router as exams_router
from app.routers.questions import router as questions_router
from app.routers.answer_keys import router as answer_keys_router
from app.routers.analytics import router as analytics_router
from app.routers.review import router as review_router
from app.routers.webhooks import router as webhooks_router
from app.routers.explanations import router as explanations_router
from app.routers.pipeline import router as pipeline_router
from app.routers.study_plan import router as study_plan_router
from app.routers.attempts import router as attempts_router
from app.routers.search import router as search_router
from app.routers.syllabus import router as syllabus_router
from app.routers.notifications import router as notifications_router
from app.routers.testimonials import router as testimonials_router
from app.routers.roles import router as roles_router
from app.routers.teacher import teacher_router, admin_teacher_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    await async_init_db()

    # Detect and mark interrupted pipeline runs on server startup
    try:
        from app.db.session import async_session_factory
        from app.db.models.pipeline_run import PipelineRun
        from sqlmodel import select
        async with async_session_factory() as session:
            stuck_stmt = select(PipelineRun).where(
                PipelineRun.status.in_(["RUNNING", "INITIALIZING", "PROCESSING"])
            )
            stuck_runs = (await session.exec(stuck_stmt)).all()
            if stuck_runs:
                logger.warning(
                    f"⚠️ Detected {len(stuck_runs)} interrupted pipeline run(s) from previous server session. Marking as INTERRUPTED for admin review/resume."
                )
                for run in stuck_runs:
                    run.status = "INTERRUPTED"
                    run.current_step = "INTERRUPTED_BY_SERVER_RELOAD"
                    session.add(run)
                await session.commit()
    except Exception as err:
        logger.warning(f"Could not check interrupted pipeline runs on startup: {err}")

    try:
        from app.services.daily_scheduler_service import start_daily_midnight_scheduler
        start_daily_midnight_scheduler()
    except Exception as err:
        logger.warning(f"Could not start daily midnight scheduler: {err}")

    try:
        yield
    finally:
        try:
            from app.services.daily_scheduler_service import stop_daily_midnight_scheduler
            stop_daily_midnight_scheduler()
        except Exception:
            pass

        logger.info("🧹 Server shutdown initiated. Cleaning up temporary upload directories and PDF cache...")
        from pathlib import Path
        import shutil

        temp_roots = [
            Path("./temp_uploads").resolve(),
            Path("./temp_pdf_cache").resolve(),
            Path("./temp_answer_keys").resolve(),
        ]
        for folder in temp_roots:
            if folder.exists() and folder.is_dir():
                for item in folder.iterdir():
                    try:
                        if item.is_file() or item.is_symlink():
                            item.unlink()
                        elif item.is_dir():
                            shutil.rmtree(item, ignore_errors=True)
                    except Exception as e:
                        logger.warning(f"Could not clean up temporary item '{item}': {e}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
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
        content={"detail": exc.detail, "error_type": exc.__class__.__name__},
    )


# Global Fallback Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled internal server error on {request.url.path}: {exc}", exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "error": str(exc)},
    )


# Mount uploads directory for static access
upload_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=upload_dir), name="uploads")


# Register API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(exams_router, prefix=settings.API_V1_STR)
app.include_router(questions_router, prefix=settings.API_V1_STR)
app.include_router(answer_keys_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(review_router, prefix=settings.API_V1_STR)
app.include_router(webhooks_router, prefix=settings.API_V1_STR)
app.include_router(explanations_router, prefix=settings.API_V1_STR)
app.include_router(pipeline_router, prefix=settings.API_V1_STR)
app.include_router(study_plan_router, prefix=settings.API_V1_STR)
app.include_router(attempts_router, prefix=settings.API_V1_STR)
app.include_router(search_router, prefix=settings.API_V1_STR)
app.include_router(syllabus_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(testimonials_router, prefix=settings.API_V1_STR)
app.include_router(roles_router, prefix=settings.API_V1_STR)
app.include_router(teacher_router, prefix=settings.API_V1_STR)
app.include_router(admin_teacher_router, prefix=settings.API_V1_STR)



@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "redoc": "/redoc",
    }
