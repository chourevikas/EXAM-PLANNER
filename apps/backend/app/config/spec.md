# Module Specification: Configuration & Secrets (`config/`)

## Overview
The `config` module provides centralized environment variable parsing, secret loading, and runtime credentials validation for the Exam Mentorship Platform using `pydantic-settings`.

## Settings Parameters (`settings.py`)
- **`APP_NAME`**: Name of the application (Default: `"Exam Mentorship Platform"`).
- **`ENVIRONMENT`**: Application environment (`development`, `staging`, `production`).
- **`DATABASE_URL`**: Async database connection string supporting SQLite (`sqlite+aiosqlite:///exam_platform.db`) and PostgreSQL (`postgresql+asyncpg://...`).
- **`STORAGE_TYPE`**: Storage provider selector (`local` vs `s3`).
- **`LOCAL_STORAGE_PATH`**: Directory path for filesystem uploads (Default: `./storage_data`).
- **`S3_BUCKET_NAME`**: Target AWS S3 bucket name.
- `CELERY_BROKER_URL`: Celery message broker URL (Default: `redis://localhost:6379/0`).
- `CELERY_RESULT_BACKEND`: Celery result store backend (Default: `redis://localhost:6379/0`).
- `CELERY_TASK_ALWAYS_EAGER`: If `True`, executes Celery tasks synchronously in-memory without requiring a Redis broker (ideal for local testing).

## Configurable Logger Provider (`config/logger.py`)
- **`setup_logger(name: str, log_level: Optional[str])`**: Returns a structured Logger Provider formatted with timestamps, log levels, file names, line numbers, and standard message formatting.
- **Log Level**: Dynamic log level derived from `LOG_LEVEL` environment configuration (`DEBUG`, `INFO`, `WARNING`, `ERROR`).
- **`OPENAI_API_KEY`**: OpenAI secret key for vision extraction.
- **`VISION_LLM_RATE_LIMIT_RPS`**: Global vision LLM rate limiter cap (Default: `0.5` req/sec = 30 req/min).

## Validation Laws
- When `STORAGE_TYPE == "s3"`, `S3_BUCKET_NAME` must be non-empty; otherwise a `ValueError` is raised during startup.
- When `LLM_PROVIDER == "openai"`, `OPENAI_API_KEY` must be populated from configuration or process environment.
