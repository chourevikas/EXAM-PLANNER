# Module Specification: Database Schemas & Session (`db/`)

## Overview
The `db` module encapsulates the asynchronous SQLModel / SQLAlchemy ORM models, database session manager, portable JSON/JSONB field definitions, composite B-Tree indexes, subscription engine, psychometrics, and HITL quality control tasks.

For a comprehensive beginner-friendly guide with Mermaid ER diagrams, field-by-field breakdowns, sample values, and indexing explanations, refer to [`db/schema_reference.md`](file:///home/asingh/.gemini/antigravity/scratch/exam_mentorship_platform/db/schema_reference.md).

## Database Session Lifecycle (`db/session.py`)
- **Async Engine**: `create_async_engine(DATABASE_URL, echo=False)`.
- **Dialect Configuration**:
  - **SQLite**: Automatic WAL mode enabled via `@event.listens_for(engine.sync_engine, "connect")` (`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=30000;`).
  - **PostgreSQL**: Configured with `pool_pre_ping=True`, `pool_size=10`, `max_overflow=20`.
- **Startup Table Creation**: `async_init_db()` asynchronously runs `SQLModel.metadata.create_all` on app startup.
- **Dependency Injection**: `get_async_session()` yields `AsyncSession` instances for FastAPI routes.

## Cross-Database Engine Portability (`db/models/types.py`)
- **`PortableJSON`**: Defined as `JSON().with_variant(JSONB, "postgresql")`.
  - Uses native binary `JSONB` on PostgreSQL (allowing GIN indexing).
  - Falls back to standard `JSON` text on SQLite/MySQL for seamless local testing.

## Model Schemas Summary (`db/models/`)
1. **User Access (`user.py`)**: `User` table with role (`STUDENT`, `ADMIN`, `SUPER_ADMIN`) and status.
2. **Subscriptions (`subscription.py`)**: `SubscriptionPlan`, `PlatformFeature`, `PlanFeatureLink`, and `UserSubscription`.
3. **Academic Hierarchy (`hierarchy.py`)**: `Exam`, `SyllabusVersion`, `Subject`, `Topic`, `Subtopic`.
4. **Reading Context & Passages (`passage.py`)**: `Passage` (stores `page_numbers_json` and linked `question_ids_json`), `PassageTranslation`.
5. **Questions & Options (`question.py`)**: `Question`, `QuestionTranslation`, `QuestionOption`, `OptionTranslation`, `QuestionAsset` (diagram images with `bounding_box_json`).
6. **Psychometrics & Telemetry (`metadata.py`, `telemetry.py`, `review.py`)**: `QuestionMetadata` (IRT $a, b, c$ parameters), `UserConceptRetention` (FSRS-6 spaced repetition decay), `HumanReviewTask` (HITL verification queue).

## Database Migrations (`alembic/`)
Configured with `alembic.ini` and `alembic/env.py` to generate and apply async schema migrations (`alembic revision --autogenerate` and `alembic upgrade head`) without dropping existing database tables.
