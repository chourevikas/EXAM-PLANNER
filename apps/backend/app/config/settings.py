import os
from pathlib import Path
from typing import Optional, Dict, Any, Type, Union
from pydantic import Field, model_validator, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict
from app.config.secret_loaders import get_secret_loader
from app.config.secret_loaders.env_loader import find_env_files

from app.config.logger import setup_logger

logger = setup_logger("SettingsFactory")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FOUND_ENV_FILES = [str(p) for p in find_env_files(Path(__file__).resolve())]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=FOUND_ENV_FILES if FOUND_ENV_FILES else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Deployment Platform & Secret Manager Configuration
    PLATFORM: Optional[str] = Field(
        default=None,
        description="Target cloud deployment platform: 'aws', 'gcp', 'vault', 'env' / 'local'",
    )
    CLOUD_PROVIDER: Optional[str] = Field(default=None)

    # Core Application Settings
    APP_NAME: str = Field(default="Exam Mentorship Platform")
    PROJECT_NAME: str = Field(default="Exam Planner AI API")
    API_V1_STR: str = Field(default="/api/v1")
    ENVIRONMENT: str = Field(
        default="development"
    )  # development, staging, production, testing
    LOG_LEVEL: str = Field(default="INFO")

    # AWS / Secret Manager Details
    AWS_SECRET_NAME: Optional[str] = Field(
        default=None, description="Name or ARN of AWS Secrets Manager secret"
    )

    # Security & Auth Settings
    SECRET_KEY: str = Field(default="secret-key-change-in-production-1234567890")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    FRONTEND_URL: str = Field(default="https://examplanner.in")
    SUPERADMIN_EMAIL: str = Field(default="admin@examplanner.com")
    SUPERADMIN_PASSWORD: str = Field(default="SuperAdmin#2026!")
    SUPERADMIN_NAME: str = Field(default="System Super Admin")

    # RBAC / Teacher Review Rewards
    REVIEW_POINTS_PER_ACTION: int = Field(
        default=10,
        description="Flat points awarded to a TEACHER-role user for each question review action (approve/reject).",
    )

    # Async Database Configuration (Supports SQLite and PostgreSQL: postgresql+asyncpg://...)
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///exam_platform.db")
    DB_MIGRATION: Union[bool, str] = Field(
        default="false",
        description="Alembic database migration mode: 'false' (disabled, create_all checkfirst), 'true' (safe sync & auto-stamp), or 'force' (forces execution of all alembic migrations).",
    )

    # Storage Abstraction Settings ('local' or 's3')
    STORAGE_TYPE: str = Field(default="local")
    LOCAL_STORAGE_PATH: str = Field(default=str(PROJECT_ROOT / "storage_data"))

    # AWS / Local S3 (MinIO / LocalStack) Configuration
    S3_BUCKET_NAME: Optional[str] = Field(default=None)
    AWS_REGION: str = Field(default="us-east-1")
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None)
    AWS_ENDPOINT_URL: Optional[str] = Field(
        default=None,
        description="Endpoint URL for MinIO (e.g. http://localhost:9000) or LocalStack",
    )
    S3_ENDPOINT_URL: Optional[str] = Field(default=None)
    AWS_SES_SENDER: str = Field(default="no-reply@examplanner.com")

    # SMTP Mail Settings (Hostinger / General SMTP)
    MAIL_USERNAME: Optional[str] = Field(default=None)
    MAIL_PASSWORD: Optional[str] = Field(default=None)
    MAIL_FROM: str = Field(default="support@examplanner.in")
    MAIL_PORT: int = Field(default=465)
    MAIL_SERVER: str = Field(default="smtp.hostinger.com")
    MAIL_STARTTLS: bool = Field(default=False)
    MAIL_SSL_TLS: bool = Field(default=True)

    # LLM Settings & Provider Credentials
    LLM_PROVIDER: str = Field(default="vertexai")  # vertexai, openai, bedrock
    GCP_PROJECT_ID: Optional[str] = Field(default=None)
    GCP_LOCATION: str = Field(default="us-central1")
    GEMINI_MODEL_NAME: str = Field(default="gemini-2.5-flash")
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = Field(
        default="gcp-service-account.json"
    )
    OPENAI_API_KEY: Optional[str] = Field(default=None)
    OPENAI_MODEL_NAME: str = Field(default="gpt-4.1")
    VISION_LLM_RATE_LIMIT_RPS: float = Field(default=0.5)

    # Post-submission report synthesis LLM call: distinct budget from bulk PDF/vision ingestion.
    # This call already has a deterministic fallback, so it should fail fast rather than retry for
    # minutes - a slow/degraded provider must not block a student waiting on their exam report.
    REPORT_LLM_TIMEOUT_SECONDS: int = Field(default=30)
    REPORT_LLM_MAX_RETRIES: int = Field(default=2)
    REPORT_LLM_RATE_LIMIT_RPS: float = Field(default=2.0)

    # Celery & Broker Settings
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/0")
    CELERY_TASK_ALWAYS_EAGER: bool = Field(
        default=False,
        description="If True, executes Celery tasks synchronously in-memory (useful when Redis is not running)",
    )

    # Caching Layer Settings
    CACHE_ENABLED: bool = Field(
        default=True,
        description="Master switch to enable or disable caching across the application.",
    )
    CACHE_TYPE: str = Field(
        default="auto",
        description="Cache engine type: 'redis', 'memory', 'none', or 'auto' (tries Redis, falls back to In-Memory).",
    )
    ENABLE_MEMORY_CACHE_FALLBACK: bool = Field(
        default=True,
        description="If True, falls back to bounded In-Memory LRU cache if Redis is unreachable. If False, bypasses caching on Redis failure.",
    )
    CACHE_IN_MEMORY_MAX_SIZE: int = Field(
        default=1000,
        description="Maximum number of items stored in bounded in-memory LRU cache to prevent RAM exhaustion.",
    )
    CACHE_DEFAULT_TTL_SECONDS: int = Field(
        default=1800,
        description="Default time-to-live (TTL) for cached items in seconds (30 minutes).",
    )
    REDIS_CACHE_URL: str = Field(
        default="redis://localhost:6379/1",
        description="Redis connection URL for caching layer (uses database 1).",
    )
    CACHE_KEY_PREFIX: str = Field(
        default="ep",
        description="Namespace prefix prepended to all cache keys.",
    )

    # Pipeline Execution & Batching Settings
    PIPELINE_BATCH_SIZE: int = Field(
        default=5,
        description="Configurable batch size for chunked DB commits across all pipelines",
    )
    MAX_VISION_CONCURRENCY: int = Field(
        default=5,
        description="Max concurrent page vision LLM calls (cuts PDF processing time by 3X-5X)",
    )

    # Output Artifact Path
    OUTPUT_ARTIFACTS_DIR: str = Field(default=str(PROJECT_ROOT / "output_artifacts"))

    @model_validator(mode="after")
    def validate_and_resolve_paths(self) -> "Settings":
        # Normalize PostgreSQL URL for asyncpg driver compatibility
        if self.DATABASE_URL.startswith("postgresql://"):
            self.DATABASE_URL = self.DATABASE_URL.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        elif self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace(
                "postgres://", "postgresql+asyncpg://", 1
            )

        if "asyncpg" in self.DATABASE_URL and "sslmode=" in self.DATABASE_URL:
            self.DATABASE_URL = self.DATABASE_URL.replace("sslmode=", "ssl=")

        # Resolve SQLite relative database path to absolute PROJECT_ROOT path
        if self.DATABASE_URL.startswith("sqlite"):
            if (
                ":///" in self.DATABASE_URL
                and not self.DATABASE_URL.startswith("sqlite+aiosqlite:////")
                and not self.DATABASE_URL.startswith("sqlite:////")
                and ":memory:" not in self.DATABASE_URL
            ):
                db_filename = self.DATABASE_URL.split(":///")[-1]
                abs_db_path = (PROJECT_ROOT / db_filename).resolve()
                self.DATABASE_URL = f"sqlite+aiosqlite:///{abs_db_path}"

        if not self.AWS_ENDPOINT_URL and self.S3_ENDPOINT_URL:
            self.AWS_ENDPOINT_URL = self.S3_ENDPOINT_URL

        if self.STORAGE_TYPE == "s3" and not self.S3_BUCKET_NAME:
            raise ValueError(
                "S3_BUCKET_NAME must be configured when STORAGE_TYPE is 's3'."
            )
        return self


# Specialized Environment Configurations
class DevelopmentSettings(Settings):
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "DEBUG"


class ProductionSettings(Settings):
    ENVIRONMENT: str = "production"
    LOG_LEVEL: str = "INFO"


class TestingSettings(Settings):
    ENVIRONMENT: str = "testing"
    LOG_LEVEL: str = "WARNING"
    DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"
    CELERY_TASK_ALWAYS_EAGER: bool = True


class SettingsFactory:
    """
    Factory pattern for creating and managing environment-aware application settings.
    Dynamically delegates secret fetching to modular secret loaders based on platform configuration
    ('aws', 'env', 'local'), merging OS environment variables and defaults.
    """

    _cached_settings: Optional[Settings] = None

    @classmethod
    def create_settings(
        cls,
        env: Optional[str] = None,
        platform: Optional[str] = None,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> Settings:
        """
        Creates a new Settings instance.
        1. Uses get_secret_loader(platform) to fetch secrets from the target platform (e.g. AWS Secrets Manager when platform='aws').
        2. Falls back to OS env variables / .env file if no platform is provided.
        3. Merges defaults from specialized environment settings classes (Development, Production, Testing).
        """
        target_env = (
            env or os.getenv("ENVIRONMENT") or os.getenv("FASTAPI_ENV") or "development"
        ).lower()

        # 1. Resolve secret loader according to platform ('aws', 'gcp', 'vault', 'env')
        target_platform = (
            platform or os.getenv("PLATFORM") or os.getenv("CLOUD_PROVIDER")
        )
        secret_loader = get_secret_loader(platform=target_platform)
        loaded_secrets = secret_loader.load_secrets()

        # 2. Combine loaded secrets with explicit programmatic overrides
        init_kwargs = {**loaded_secrets, **(overrides or {})}

        # 3. Select environment-appropriate Settings class
        env_map: Dict[str, Type[Settings]] = {
            "development": DevelopmentSettings,
            "production": ProductionSettings,
            "staging": ProductionSettings,
            "testing": TestingSettings,
            "test": TestingSettings,
        }

        settings_cls = env_map.get(target_env, Settings)
        return settings_cls(**init_kwargs)

    @classmethod
    def get_settings(cls, force_reload: bool = False, **kwargs) -> Settings:
        """Returns the thread-safe cached settings singleton or creates a new one if forced."""
        if cls._cached_settings is None or force_reload or kwargs:
            cls._cached_settings = cls.create_settings(**kwargs)
        return cls._cached_settings


def get_settings(force_reload: bool = False) -> Settings:
    """Convenience getter function returning the active Settings instance from SettingsFactory."""
    return SettingsFactory.get_settings(force_reload=force_reload)


# Global singleton alias for backward compatibility across modules
settings = get_settings()
