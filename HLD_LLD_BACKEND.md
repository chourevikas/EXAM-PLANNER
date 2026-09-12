# 🏛️ High-Level Design (HLD) & Low-Level Design (LLD)
## Backend Architecture Specification & Technical Blueprint

**Project Name:** Exam Planner / RankEdge Mentorship Platform  
**Target Audience:** Senior Backend Engineers, AI Autonomous Agents, Technical Architects  
**Author:** Senior Backend Architect  
**Specification Version:** 2.0 (Post-Deterministic Pipeline Architecture)  
**Date:** September 2026  
**Document Status:** Complete & Exhaustive Reference  

---

## 📑 Table of Contents

- [🏛️ High-Level Design (HLD) & Low-Level Design (LLD)](#️-high-level-design-hld--low-level-design-lld)
  - [📑 Table of Contents](#-table-of-contents)
  - [PART A: HIGH-LEVEL DESIGN (HLD)](#part-a-high-level-design-hld)
    - [1. System Overview](#1-system-overview)
    - [2. Architectural Layers & System Component Diagram](#2-architectural-layers--system-component-diagram)
    - [3. Complete Technology Stack & Version Matrix](#3-complete-technology-stack--version-matrix)
    - [4. End-to-End Data Flows](#4-end-to-end-data-flows)
    - [5. External Dependencies, Integrations & Failure Strategies](#5-external-dependencies-integrations--failure-strategies)
    - [6. Deployment, Runtime & Concurrency Topology](#6-deployment-runtime--concurrency-topology)
    - [7. Cross-Cutting Architectural Concerns](#7-cross-cutting-architectural-concerns)
  - [PART B: LOW-LEVEL DESIGN (LLD) — DOMAIN SPECIFICATIONS](#part-b-low-level-design-lld--domain-specifications)
    - [Domain 1: Core Framework, Server Lifecycle & Configuration](#domain-1-core-framework-server-lifecycle--configuration)
    - [Domain 2: Authentication & Authorization](#domain-2-authentication--authorization)
    - [Domain 3: Users, Profiles & Bookmarks](#domain-3-users-profiles--bookmarks)
    - [Domain 4: Dynamic RBAC, Custom Roles & Fine-Grained Permissions](#domain-4-dynamic-rbac-custom-roles--fine-grained-permissions)
    - [Domain 5: Exam Types & Configurations](#domain-5-exam-types--configurations)
    - [Domain 6: Exams, Syllabus & Taxonomy Hierarchy](#domain-6-exams-syllabus--taxonomy-hierarchy)
    - [Domain 7: Questions, Assets, Options & Passages](#domain-7-questions-assets-options--passages)
    - [Domain 8: Deterministic Document Extraction Pipeline](#domain-8-deterministic-document-extraction-pipeline)
    - [Domain 9: Human-in-the-Loop (HITL) Review & Auditing](#domain-9-human-in-the-loop-hitl-review--auditing)
    - [Domain 10: Exam Taking, Telemetry & Session Management](#domain-10-exam-taking-telemetry--session-management)
    - [Domain 11: Psychometrics & Analytics Engine (12 Cognitive Matrices)](#domain-11-psychometrics--analytics-engine-12-cognitive-matrices)
    - [Domain 12: Study Planning, Gamification & Scheduler](#domain-12-study-planning-gamification--scheduler)
    - [Domain 13: Peer Challenges & Quota Limiting](#domain-13-peer-challenges--quota-limiting)
    - [Domain 14: Teacher Profiles & Review Rewards](#domain-14-teacher-profiles--review-rewards)
    - [Domain 15: Notifications & Broadcast Announcements](#domain-15-notifications--broadcast-announcements)
    - [Domain 16: Testimonials Moderation](#domain-16-testimonials-moderation)
    - [Domain 17: Current Affairs](#domain-17-current-affairs)
    - [Domain 18: Site Settings & Dynamic Theming](#domain-18-site-settings--dynamic-theming)
    - [Domain 19: Monetization, Feature Flags & Subscription Management](#domain-19-monetization-feature-flags--subscription-management)
    - [Domain 20: Global Search](#domain-20-global-search)
    - [Domain 21: Storage Abstraction Layer (S3 / Local)](#domain-21-storage-abstraction-layer-s3--local)
    - [Domain 22: Multi-Tier Caching Layer](#domain-22-multi-tier-caching-layer)
    - [Domain 23: LLM Provider Abstraction Layer](#domain-23-llm-provider-abstraction-layer)
    - [Domain 24: Multi-Language Translation (22 Scheduled Indian Languages)](#domain-24-multi-language-translation-22-scheduled-indian-languages)
    - [Domain 25: Asynchronous Task Workers & Celery Queue](#domain-25-asynchronous-task-workers--celery-queue)
    - [Domain 26: Webhooks & External Event Ingress](#domain-26-webhooks--external-event-ingress)
    - [Domain 27: Administrative Operations & System Diagnostics](#domain-27-administrative-operations--system-diagnostics)
  - [PART C: CONVENTIONS, ARCHITECTURAL PATTERNS & GUARDRAILS](#part-c-conventions-architectural-patterns--guardrails)
  - [PART D: AMBIGUITIES, ARCHITECTURAL DEBT & ITEMS REQUIRING VERIFICATION](#part-d-ambiguities-architectural-debt--items-requiring-verification)

---

# PART A: HIGH-LEVEL DESIGN (HLD)

## 1. System Overview

**RankEdge (Exam Mentorship Platform)** is an advanced, high-performance EdTech and Psychometric Analytics backend built primarily for aspirants preparing for high-stakes Indian competitive examinations, including the **UPSC Civil Services Examination (CSE)**, State Public Service Commissions (e.g., MPSC, BPSC, MPPSC, UPPCS), and related standardized examinations.

In plain language, the platform fulfills three primary missions:

1. **Automated Ingestion of Complex Exam Papers:** Converts rasterized, scanned, and print-to-PDF examination papers into structured, machine-actionable questions, multi-part mathematical expressions, diagrams, passages, and structured answer keys without manual data entry.
2. **Realistic Exam Simulation & Real-Time Telemetry:** Provides students with a realistic, low-latency testing environment across three distinct operational modes:
   - `EXAM`: Strict timed simulation. Answer keys and explanations are completely masked until final submission.
   - `PRACTICE`: Timed study mode. Allows per-question instant answer reveal after the student commits an option.
   - `REVISION`: Spaced-repetition mode. Questions are presented based on the student's forgetting curve (FSRS), testing retention decay.
   During the test, high-resolution behavioral telemetry is captured: question dwell times, option selection sequences, option switch counts (from Option A to Option B), visited status, review flagging, and time-stamped heartbeat pings.
3. **Advanced Psychometric & Cognitive Diagnosis:** Rather than returning a crude percentage score, the platform subjects every completed exam attempt to a **12-dimensional psychometric and cognitive analytics engine**. This includes Item Response Theory (IRT 3PL) latent trait calculation, Guessing Tendency Index (GTI), Speed-Accuracy Trade-Off Index (SATOI), Option Elimination Efficiency Index (OEEI), Option Switch Regret Index (OSRI), Distractor Closeness classification, Bloom's Taxonomy mastery breakdown, Macro-Pacing status, and Free Spaced Repetition Scheduler (FSRS) concept stability decay.
   A dual-phase post-submission architecture computes all mathematical matrices in <2 seconds, followed by an asynchronous AI mentorship synthesizer that generates human-sounding, empathetic, non-jargon feedback and assigns prioritized study tasks directly to the candidate's weekly study calendar.

Additional sub-systems include:
- **Peer Challenges:** Students create custom quizzes with specific time limits and difficulty, sharing invite links to challenge peers and view live leaderboards.
- **Teacher Monetization & HITL Review:** Educators and subject matter experts review AI-extracted questions, earning redeemable review points that convert to cash rewards.
- **Multilingual Support:** Live translation into all 22 official scheduled Indian languages + English via Google Cloud Translation, with mathematical formula and Markdown syntax protection.
- **Dynamic Theming & Gamification:** Custom UI themes (e.g., crimson), study streaks, XP logs, level progression, and achievement badges.

---

## 2. Architectural Layers & System Component Diagram

The system is designed following a **Clean / Layered Architecture** with strict separation between Presentation, Domain/Service, Persistence, Caching, Asynchronous Task Execution, and External Integration layers.

```
+-----------------------------------------------------------------------------------------------+
|                                      CLIENT LAYER                                             |
|        Next.js / Vite Web Frontend, Admin Dashboard, Mobile Web (React/TypeScript)            |
+-----------------------------------------------------------------------------------------------+
                                                │ (HTTPS / REST / JSON)
                                                ▼
+-----------------------------------------------------------------------------------------------+
|                                    GATEWAY & ROUTING LAYER                                    |
|   Reverse Proxy (Nginx / CloudFront) -> Uvicorn ASGI Server (Port 8000)                       |
|   - Lifespan Manager (DB Init, Connection Pool Warming, Interrupted Task Sweep, Scheduler)    |
|   - CORSMiddleware (Configurable origin whitelists)                                           |
|   - StaticFiles Mount (/static/uploads -> ./uploads)                                          |
|   - CustomAppException Handler (BaseAppException -> RFC 7807 JSON)                            |
|   - Global Unhandled Exception Fallback Handler (HTTP 500 JSON)                              |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
|                                 FASTAPI CONTROLLERS / ROUTERS                                 |
|  22 APIRouter Modules mounted under /api/v1 prefix:                                          |
|  [auth] [users] [admin] [exams] [questions] [analytics] [review] [webhooks] [pipeline]       |
|  [study_plan] [attempts] [search] [syllabus] [notifications] [testimonials] [roles]           |
|  [teacher] [current_affairs] [exam_types] [admin_notifications] [challenges] [site_settings]  |
+-----------------------------------------------------------------------------------------------+
        │                                       │                                       │
        ▼ (Dependency Injection)                ▼ (Security & RBAC)                     ▼
+-----------------------+     +-----------------------------------+     +-----------------------+
|  DATABASE SESSION     |     |   AUTHENTICATION & AUTHORIZATION  |     |  SYSTEM SETTINGS &    |
|  get_async_session    |     |   get_current_user (JWT / Clerk)  |     |  SECRET LOADERS       |
|  async_session_factory|     |   require_roles(allowed_roles)    |     |  SettingsFactory      |
|  managed_async_session|     |   require_permission(key)         |     |  AWSSecretsManager /  |
|  @with_db_retry       |     |   require_challenge_quota         |     |  EnvSecretLoader      |
+-----------------------+     +-----------------------------------+     +-----------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
|                                    BUSINESS LOGIC & SERVICES                                  |
|  24 Domain Services orchestrating business rules, caching, and background jobs:               |
|  - AuthService, UserService, AdminService, RoleService, ExamTypeService, ExamService          |
|  - QuestionService, SyllabusService, ExamJsonBuilder, ExamExportService, ExamSessionService   |
|  - AnalyticsService, ChallengeService, GamificationService, DailySchedulerService            |
|  - TeacherRewardService, ReviewPointsService, AppEmailService, SiteSettingsService            |
|  - QuestionTranslationService, GoogleTranslationService, S3Service, TaskRegistry              |
|  - PipelineManagementService, HumanReviewService (HITL)                                       |
+-----------------------------------------------------------------------------------------------+
        │                                       │                                       │
        ▼ (Deterministic OCR & NLP)             ▼ (Psychometrics)                       ▼ (Async)
+-----------------------+     +-----------------------------------+     +-----------------------+
|  DOCUMENT EXTRACTION  |     |  PSYCHOMETRIC & COGNITIVE ENGINE  |     |  CELERY TASK WORKERS  |
|  PIPELINE (LangGraph) |     |  - MatrixOrchestrator (12 models) |     |  Celery App + Beat    |
|  - DoclingOcrExtractor|     |  - PostSubmissionPipeline (2-ph)  |     |  - process_exam_pdf   |
|  - RapidOCR Engine    |     |  - CumulativeAnalyticsAggregator  |     |  - sync_exam_s3       |
|  - RegexQuestionParser|     |  - ReportAISynthesizer (LLM/Rule) |     |  - translate_exam     |
|  - BatchRegistrar     |     |  - FSRSEngine & Decay Modeler     |     |  - midnight_reconcile |
+-----------------------+     +-----------------------------------+     +-----------------------+
        │                                       │                                       │
        ▼                                       ▼                                       ▼
+-----------------------------------------------------------------------------------------------+
|                                   DATA ACCESS & REPOSITORIES                                  |
|  SQLModel / SQLAlchemy 2.0 Async Repositories:                                                |
|  - UserRepository, ExamRepository, ExamTypeRepository, QuestionRepository                     |
|  - ExplanationRepository, AnswerKeyRepository                                                 |
|  - Dialect-aware Upsert Utilities (bulk_insert_on_conflict_do_nothing, bulk_upsert_trans)      |
+-----------------------------------------------------------------------------------------------+
        │                                       │                                       │
        ▼                                       ▼                                       ▼
+-----------------------+     +-----------------------------------+     +-----------------------+
|  PRIMARY DATABASE     |     |  TWO-TIERED CACHING LAYER         |     |  STORAGE ABSTRACTION  |
|  PostgreSQL 16        |     |  Primary: Redis 7 (DB 1)          |     |  BaseStorageProvider  |
|  (AWS RDS / Local)    |     |  Fallback: In-Memory Bounded LRU  |     |  - S3StorageProvider  |
|  Driver: asyncpg      |     |  Decorator: @cached(prefix, ttl)  |     |    (AWS S3 / MinIO)   |
|  Pool: 10 pre-warmed  |     |  Keys: ep:<prefix>:<hash>         |     |  - LocalStorageProv   |
|  Dialect fallback:    |     |  Cascade Invalidation Helpers     |     |    (./storage_data)   |
|  aiosqlite for tests  |     |                                   |     |  Presigned URLs       |
+-----------------------+     +-----------------------------------+     +-----------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
|                                EXTERNAL THIRD-PARTY INTEGRATIONS                              |
|  - Authentication: Clerk Auth (JWKS cache with threadpool decoding + Svix Webhooks)           |
|  - AI / LLM Providers: Google Vertex AI / Gemini 2.5 Flash, OpenAI GPT-4                      |
|  - Cloud Object Storage: AWS S3 Bucket (exam-paper-storage) / MinIO S3 API                    |
|  - Email Dispatch: AWS Simple Email Service (SES) + SMTP (Hostinger / FastMail fallback)     |
|  - Machine Translation: Google Cloud Translation API v3 (22 Indian Scheduled Languages)      |
|  - Secrets Management: AWS Secrets Manager (ARN/SecretName fallback to .env)                  |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. Complete Technology Stack & Version Matrix

| Category | Component / Library | Active Version | Architectural Purpose & Rationale |
|---|---|---|---|
| **Runtime Environment** | Python | `>= 3.12` (tested up to `3.14`) | Core language platform; leverages Python 3.12+ improved asyncio performance and generic type parameters. |
| **Package Management** | `uv` / `pyproject.toml` | `>= 0.4.0` | Ultra-fast Rust-based package resolver, virtual environment manager, and lockfile generator (`uv.lock`). |
| **Web Framework** | FastAPI | `>= 0.141.1` | High-performance asynchronous REST API framework with Pydantic v2 data validation and auto-generated OpenAPI 3.1 specs. |
| **ASGI Web Server** | Uvicorn | `>= 0.52.1` | Lightning-fast ASGI web server implementation using uvloop and httptools. |
| **ORM & Schema Modeling** | SQLModel / SQLAlchemy | SQLModel `>= 0.0.39`, SQLAlchemy `>= 2.0.51` | Unified Pydantic v2 validation + SQLAlchemy 2.0 Core/ORM models. Enables async query execution and dialect polymorphism. |
| **Relational Database** | PostgreSQL | `16-alpine` | Primary production database deployed on AWS RDS. ACID-compliant transactional persistence, JSONB support, and sequence generators. |
| **Local Dev / Test DB** | SQLite (`aiosqlite`) | `aiosqlite >= 0.22.1` | Non-blocking async SQLite driver used for local development, rapid mocking, and in-memory unit testing (`:memory:`). |
| **Database Migrations** | Alembic | `>= 1.19.0` | Declarative schema migration tool tracking 39 versioned revisions; auto-stamps head on initialization when `DB_MIGRATION=true`. |
| **Caching Engine** | Redis | `7-alpine` (`redis >= 8.1.0`) | Distributed in-memory data store used for API caching (Database 1), rate limiting, and session status storage. |
| **In-Memory Cache** | Custom LRU Cache | Python in-memory | Bounded Least-Recently-Used (LRU) fallback cache (default: 1000 items) ensuring zero downtime if Redis is unavailable. |
| **Distributed Queue** | Celery | `>= 5.6.3` | Asynchronous task queue handling heavy OCR extraction, batch translations, S3 uploads, and scheduled cron maintenance. |
| **Message Broker** | Redis | `7-alpine` | Message transport broker for Celery queues (Database 0). |
| **Object Storage** | AWS S3 / MinIO | AWS S3 API / MinIO `latest` | S3-compatible cloud storage holding original exam PDFs, cropped diagrams, per-question JSON cards, and master solutions. |
| **OCR & Document Parsing** | Docling / RapidOCR / ONNX | Docling `>= 2.125.0`, ONNXRuntime `>= 1.29.0` | Extracts rich layout, tables, and bounding boxes from image-only rasterized PDFs without requiring embedded font layers. |
| **PDF Rendering & Images** | PyPDFium2, PyPDF, Pillow, pdf2image | `pypdfium2 >= 5.12.0`, `pillow >= 12.3.0` | Native C-backed PDF rendering, page-to-image rasterization, diagram bounding box cropping, and file validation. |
| **AI Agent Orchestration** | LangGraph / LangChain-Core | LangGraph `>= 1.2.10`, LangChain-Core `>= 1.5.3` | State-graph orchestrator managing deterministic document extraction, state transitions, and audit checkpoints. |
| **LLM Inference** | Google Vertex AI / Gemini | `langchain-google-genai >= 4.3.2` | Primary LLM engine using Gemini 2.5 Flash for non-hallucinatory cognitive diagnostic insights and task generation. |
| **LLM Fallback** | OpenAI GPT-4 | `langchain-openai >= 1.4.1` | Optional secondary provider fallback if Vertex AI credentials or quotas are degraded. |
| **Translation Engine** | Google Cloud Translate | `google-cloud-translate >= 3.15.0` | Enterprise neural machine translation supporting the 22 official scheduled Indian languages + English. |
| **Authentication & Tokens** | PyJWT, Bcrypt, Passlib | `pyjwt >= 2.13.0`, `bcrypt >= 5.0.0` | SHA-256 token hashing, Bcrypt 72-byte password hashing, and HS256 JWT access/refresh token generation. |
| **Managed Auth & Webhooks** | Clerk / Svix | `svix >= 1.24.0` | Third-party identity provider with RS256 JWKS public key verification and cryptographically signed webhook ingress. |
| **Email Delivery** | Boto3 SES / FastAPI-Mail | `boto3 >= 1.34.0`, `fastapi-mail >= 1.4.1` | Transactional email dispatch via AWS Simple Email Service (SES) with fallback to SMTP (SSL/TLS port 465). |
| **Rate Limiting** | LangChain RateLimiter | `InMemoryRateLimiter` | Token bucket rate limiting (default: 0.5 RPS for Vision, 2.0 RPS for reports) preventing API 429 quota exhaustion. |
| **Testing Suite** | Pytest / Pytest-Asyncio | `pytest >= 9.1.1` | Comprehensive test suite containing 35 test modules validating psychometrics, pipeline execution, caching, and RBAC. |

---

## 4. End-to-End Data Flows

### 4.1 Standard API Request/Response Lifecycle

```
[Client Request] (e.g. GET /api/v1/exams)
       │
       ▼
[1. ASGI / Uvicorn Server]
       │
       ▼
[2. Lifespan & Middleware Layer]
       │- Checks CORS origin whitelist
       │- Intercepts uncaught exceptions via BaseAppException / Global handlers
       ▼
[3. FastAPI Dependency Injection Chain]
       │- get_async_session(): Checks out AsyncSession from SQLAlchemy pool
       │- get_current_user(): Parses Authorization: Bearer <token>
       │    ├── If Clerk token: Verifies RS256 via cached JWKS; syncs or fetches User
       │    └── If Custom JWT: Verifies HS256 via SECRET_KEY; loads User from DB
       │- require_roles([ADMIN, SUPER_ADMIN]): Evaluates role authorization
       │- require_permission("exams:read"): Evaluates fine-grained custom role permissions
       ▼
[4. Controller / Router Endpoint] (e.g. app/routers/exams.py:list_exams)
       │- Validates query params via Pydantic schema
       │- Checks @cached decorator (prefix: "ep:exams:list:<hash>")
       │    ├── Cache Hit (0-2ms): Returns cached JSON response directly
       │    └── Cache Miss: Proceeds to service layer
       ▼
[5. Service Layer] (e.g. app/services/exam_service.py:ExamService)
       │- Executes domain business logic and filter sanitization
       ▼
[6. Repository / Data Access Layer] (e.g. app/repositories/exam_repository.py)
       │- Builds SQLModel select(Exam) statement with joins and indexes
       │- Executes query against PostgreSQL using asyncpg driver
       ▼
[7. Cache Update & Serialization]
       │- Saves query result into Redis / In-Memory cache with configured TTL
       │- Serializes ORM entity to Pydantic Response Model
       ▼
[8. Client HTTP Response] (HTTP 200 OK + JSON Payload)
```

### 4.2 Deterministic PDF Ingestion & Extraction Flow

```
[Admin uploads Question Paper PDF] -> POST /api/v1/exams/upload
       │
       ▼
[1. File Sanitization & Filename Parser]
       │- Saves PDF to ./temp_uploads/
       │- parse_question_paper_filename(): Extracts exam_name, stage, subject, year, set_code
       │- Constructs lowercase canonical code (e.g., upsc-prelims-gs1-2024-set_a)
       ▼
[2. DB Registration & Lock-Resilient Commit]
       │- Inserts or updates Exam record in DB (status=PENDING_HUMAN_REVIEW)
       │- Registers PipelineRun record (type=DOCUMENT_EXTRACTION, status=PENDING)
       ▼
[3. Worker Dispatch]
       │- Checks has_active_celery_workers()
       │    ├── If Celery active: Dispatches Celery task process_exam_pdf_task.delay()
       │    └── If Celery offline: Enqueues FastAPI BackgroundTasks async_process_exam_pdf()
       ▼
[4. LangGraph Execution Engine] (app/pipeline/graph.py)
       │
       ├── Node 1: node_ocr_convert
       │     └── DoclingOcrExtractor runs RapidOCR on page images, extracts tables & bboxes
       │
       ├── Node 2: node_regex_parse_and_stitch
       │     ├── detect_format(): Identifies EXPLAINED_QA vs RAW_EXAM format
       │     ├── split_into_question_blocks(): Chunks text on Q<N> headers across page breaks
       │     ├── parse_question_block(): Extracts stems, options (A-D), verified answers,
       │     │     explanations, common mistakes, and reverse logic reasoning
       │     └── BatchQuestionRegistrar: Commits questions, options, translations, and
       │           reasoning in chunks of 10 to prevent long DB write locks
       │
       ├── Node 3: node_mcq_validator_and_hitl
       │     └── Validates option counts and correctness; flags incomplete items to
       │           HumanReviewTask with review_status=PENDING_REVIEW
       │
       └── Node 4: node_export_artifacts
             └── Emits completion logs and transitions PipelineRun status to COMPLETED
```

### 4.3 Student Exam-Taking, Telemetry & Heartbeat Flow

```
[Student starts exam] -> POST /api/v1/attempts/start {exam_id, mode: "EXAM"|"PRACTICE"|"REVISION"}
       │
       ▼
[1. Session Initialization] (ExamSessionService:start_exam)
       │- Creates ExamAttempt record in DB (status=IN_PROGRESS)
       │- Preloads exam questions from Redis cache or loads directly from database
       │- In EXAM mode, is_correct, explanations, and distractor scores are completely stripped
       │- Returns first question, total count, duration (e.g. 7200s), and initial palette
       ▼
[2. In-Exam Live Interaction Loop]
       │
       ├── Navigation: GET /api/v1/attempts/{id}/questions/{num}
       │     └── Fetches specific question, updates visited_count, returns current response state
       │
       ├── Response Commits: POST /api/v1/attempts/{id}/responses
       │     ├── Records selected_option_id, time_spent_seconds, option_switch_count
       │     ├── If option was switched: logs QuestionSwitchLog (from_option -> to_option)
       │     └── Updates question palette status (UNVISITED -> ANSWERED / MARKED_FOR_REVIEW)
       │
       ├── Periodic Heartbeat: POST /api/v1/attempts/{id}/heartbeat
       │     └── Syncs remaining_time_seconds and active_question_id; detects client disconnects
       │
       └── Answer Reveal: POST /api/v1/attempts/{id}/reveal/{question_id}
             ├── If mode == EXAM: BLOCKED with HTTP 403 (REVEAL_BLOCKED_IN_EXAM_MODE)
             └── If mode in (PRACTICE, REVISION): Returns correct option, explanation, distractor analysis
```

### 4.4 Post-Submission Dual-Phase Analytics Pipeline

```
[Student submits exam] -> POST /api/v1/attempts/{id}/submit
       │
       ▼
[1. Submission Finalization]
       │- Sets ExamAttempt.status = SUBMITTED, records submitted_at timestamp
       │- Immediately responds to student with attempt summary acknowledgment
       ▼
[2. Asynchronous Execution: run_post_submission_pipeline(attempt_id)]
       │
       ├── PHASE 1: Mathematical Matrix Computation (Execution time: ~1.5 seconds)
       │     │
       │     ├── load_exam_solutions_data(): Resolves full answer keys, IRT params, distractor scores
       │     │
       │     ├── MatrixOrchestrator.compute_full_report():
       │     │     ├── IRT 3PL Ability: Computes latent ability theta via Newton-Raphson / Fisher scoring
       │     │     ├── Guessing Tendency (GTI): Computes item & attempt guessing index (0.0 to 1.0)
       │     │     ├── Distractor Closeness: Maps option selections to 7 closeness tiers
       │     │     ├── Speed-Accuracy (SATOI): Quantifies accuracy degradation under time pressure
       │     │     ├── Option Elimination (OEEI): Evaluates student's ability to discard incorrect options
       │     │     ├── Switch Regret (OSRI): Measures whether changing answers helped or harmed score
       │     │     ├── Macro-Pacing: Classifies pacing (BALANCED_PACING, RUSHED, STALLED, CRUNCH_TIME)
       │     │     ├── Time-Tiered Scoring: Rewards fast precision; penalizes rushed incorrect guesses
       │     │     ├── Bloom's Mastery: Calculates accuracy across REMEMBER, UNDERSTAND, APPLY, ANALYZE
       │     │     ├── FSRS Retention: Calculates stability, difficulty, and next review date per subtopic
       │     │     └── Integrated Readiness (ICRS): Generates composite readiness score (0 - 100)
       │     │
       │     └── Persistence:
       │           ├── Inserts 100 ExamQuestionReport records
       │           ├── Upserts UserMemoryState and UserConceptRetention records
       │           ├── Updates UserTaxonomyMastery per Subject/Topic/Subtopic
       │           └── Creates ExamAttemptReport with matrices_summary_json
       │
       └── PHASE 2: AI Mentorship Synthesis (Non-blocking background LLM call)
             │
             ├── ReportAISynthesizer.generate_diagnostic_insight():
             │     ├── Passes pre-computed mathematical matrices to Gemini 2.5 Flash
             │     ├── System prompt enforces ZERO mathematical recalculation and ZERO jargon
             │     │   (e.g. translates IRT theta -> "Knowledge Depth", GTI -> "Guessing Risk")
             │     ├── Generates 11 dimension insights + EXACTLY 4 actionable study tasks
             │     └── Fallback: If LLM is offline, synthesizes deterministic expert template
             │
             ├── Updates ExamAttemptReport with llm_insight_json and full_report_json
             ├── Sets ExamAttempt.status = EVALUATED
             │
             └── Cumulative Analytics Update (CumulativeAnalyticsAggregator):
                   ├── Recalculates longitudinal rolling skill profile (UserSkillProfile)
                   └── Generates UserSkillProgressionReport comparing delta with previous attempts
```

---

## 5. External Dependencies, Integrations & Failure Strategies

The platform interacts with multiple cloud services and external third-party APIs. To preserve high availability and prevent cascading system failures, explicit resilience, circuit-breaking, and graceful degradation patterns are implemented across every integration boundary.

| External System | Integration Purpose | SDK / Driver Used | Potential Failure Modes | Architectural Mitigation & Fallback Strategy |
|---|---|---|---|---|
| **Clerk Authentication** | Managed OAuth2 & user identity provider | `pyjwt`, `httpx` (JWKS fetch) | Network timeouts reaching `https://<issuer>/.well-known/jwks.json`, rate limits, invalid public keys. | **JWKS Per-Issuer Memory Cache:** `_jwks_clients` caches `PyJWKClient` instances per issuer with `lifespan=3600s`. JWKS network requests are offloaded to Python's threadpool (`asyncio.to_thread`) to avoid stalling the ASGI event loop. If JWKS verification fails during local dev, unverified claims are parsed and cross-referenced with DB users by `clerk_id` or `email`. |
| **AWS S3 / MinIO** | Cloud object storage for PDFs, cropped diagrams, master solutions, and JSON cards | `aioboto3 >= 15.5.0`, `boto3 >= 1.34.0` | S3 bucket unreachable, invalid IAM credentials, network latency spikes, permission denied (403). | **Storage Factory & Local Fallback:** `STORAGE_TYPE` switch routes requests between `S3StorageProvider` and `LocalStorageProvider`. `ensure_local_pdf()` downloads files to local cache (`./temp_pdf_cache/`) with file-level concurrency locks (`_download_locks`) preventing redundant concurrent S3 GET requests. Master solutions are cached in Redis so S3 is bypassed during live tests. |
| **Google Vertex AI / Gemini** | LLM vision extraction and post-submission cognitive report synthesis | `langchain-google-genai >= 4.3.2`, Google ADC | API quota exhaustion (429), Google Cloud downtime, network read timeouts. | **Rate Limiter & Deterministic Fallback:** `InMemoryRateLimiter(VISION_LLM_RATE_LIMIT_RPS=0.5)` throttles requests. For report synthesis, `REPORT_LLM_TIMEOUT_SECONDS=30` and `REPORT_LLM_MAX_RETRIES=2` enforce fast failure. If Gemini fails, `ReportAISynthesizer` falls back to a deterministic rule-based mentorship template, guaranteeing students receive reports immediately. |
| **OpenAI API** | Secondary / backup LLM provider | `langchain-openai >= 1.4.1` | Account balance exhausted, rate limits, invalid API keys. | Provider abstraction via `app.llm.factory.get_vision_llm()` allows seamless runtime swapping via `LLM_PROVIDER="openai"`. Rate limiters and structured output parsers are shared across providers. |
| **Google Cloud Translation** | Translates questions, options, and explanations into 22 Indian scheduled languages | `google-cloud-translate >= 3.15.0` | Daily quota exceeded, malformed LaTeX / Markdown rendering, translation API timeouts. | **Text Protection & Batch Processing:** `TextProtectionHandler` uses cryptographic placeholder tokens (e.g. `__CODE_BLOCK_0__`, `__MATH_0__`) to protect formulas and Markdown formatting before calling Google Translate. Batch commits (`bulk_upsert_translations`) use `ON CONFLICT DO UPDATE`. Celery Beat runs midnight reconciliation to retry missing translations. |
| **AWS Secrets Manager** | Centralized production credential and secret storage | `boto3` (`secretsmanager`) | Service unreachable, AWS credential missing, IAM policy restricted. | **Modular Secret Loaders:** `get_secret_loader(platform)` defaults to `AWSSecretManagerLoader` when `PLATFORM="aws"`. If AWS fails or `PLATFORM="env"`, it seamlessly falls back to `EnvSecretLoader` which parses `.env`, `.env.production`, or OS environment variables. |
| **AWS SES & Hostinger SMTP** | Transactional emails (password reset, email verification, daily digests) | `boto3` (SES), `fastapi-mail` (SMTP) | SES sandbox restrictions, unverified domain, SMTP connection timeout (port 465 SSL/TLS). | **Dual Provider Architecture:** `AppEmailService` attempts native AWS SES API (`_send_via_aws_ses`) using `boto3`. If AWS SES fails or credentials are absent, it falls back to SMTP server (`smtp.hostinger.com:465`) using `fastapi-mail`. |
| **Clerk Webhooks** | Real-time user lifecycle sync (`user.created`, `user.updated`, `user.deleted`) | `svix >= 1.24.0` | Replay attacks, unsigned webhooks, out-of-order delivery. | **Svix Cryptographic Verification:** All incoming webhook payloads at `/api/v1/webhooks/clerk` are verified using `CLERK_WEBHOOK_SECRET` via Svix Webhook headers (`svix-id`, `svix-timestamp`, `svix-signature`). |

---

## 6. Deployment, Runtime & Concurrency Topology

### 6.1 Container & Service Architecture

The system is containerized using Docker and Docker Compose, with separate orchestration manifests for development (`docker-compose.dev.yml`) and production (`docker-compose.prod.yml`).

```
+---------------------------------------------------------------------------------------------------------+
|                                        DOCKER COMPOSE TOPOLOGY                                          |
|                                                                                                         |
|  +---------------------------+       +---------------------------+       +---------------------------+  |
|  |     exam_postgres         |       |        exam_redis         |       |        exam_minio         |  |
|  |     PostgreSQL 16         |       |        Redis 7            |       |     MinIO S3 Storage      |  |
|  |     Port: 5432            |       |     Ports: 6379           |       |   Ports: 9000 (API)       |  |
|  |  Volume: postgres_data    |       |    Volume: redis_data     |       |          9001 (Console)   |  |
|  +---------------------------+       +---------------------------+       +---------------------------+  |
|               ▲                                   ▲                                   ▲                 |
|               │                                   │                                   │                 |
|               └─────────────────┬─────────────────┴───────────────────────────────────┘                 |
|                                 │                                                                       |
|  +------------------------------┴────────────────────────────+   +------------------------------------+ |
|  |                   api (FastAPI / Uvicorn)                 |   |           celery_worker            | |
|  |                   Container Port: 8000                    |   |        worker.py (Entrypoint)      | |
|  |         Command: uvicorn app.fastapi_server:app           |   |   Command: celery -A app.tasks     | |
|  |         Workers: Async Event Loop + Threadpool            |   |   worker --loglevel=info -E        | |
|  +-----------------------------------------------------------+   +------------------------------------+ |
|                                                                                                         |
|  +---------------------------+       +---------------------------+       +---------------------------+  |
|  |       exam_flower         |       |   exam_redis_commander    |       |     exam_redisinsight     |  |
|  |  Flower Celery Dashboard  |       |    Redis Web Dashboard    |       |    Redis Ltd Web Studio   |  |
|  |       Port: 5555          |       |        Port: 8081         |       |        Port: 5540         |  |
|  +---------------------------+       +---------------------------+       +---------------------------+  |
+---------------------------------------------------------------------------------------------------------+
```

### 6.2 Database Connection Pool Architecture

In high-concurrency production deployments (e.g. against AWS RDS PostgreSQL in remote regions like `ap-southeast-2` with cross-region network latency), connection handshakes pay a substantial TCP + TLS + authentication cost (300-600ms per cold connection).

To eliminate this latency during live exam attempts and API bursts:
1. **Connection Headroom:** `pool_size=10`, `max_overflow=10`, `pool_recycle=1800s`. Headroom accommodates fan-out queries (e.g. `QuestionService` and `ExamJsonBuilder` preloading question cards concurrently via `asyncio.gather`).
2. **Boot-Time Connection Pool Warming (`warm_connection_pool()`):** On Uvicorn server startup, the `lifespan` manager opens `pool_size` connections concurrently against RDS executing `SELECT 1`. All subsequent client requests check out pre-warmed, active connections in <1ms.
3. **Disabling `pool_pre_ping`:** `pool_pre_ping=False` is explicitly set because pre-ping pings all idle pool connections sequentially on check-out, which produces severe latency penalties against remote cloud RDS instances.

### 6.3 Background Processing Dual-Engine Strategy

Background execution uses an adaptive fallback mechanism:
- **Celery Worker Mode (Distributed):** When active Celery workers are listening on Redis (`has_active_celery_workers() == True`), long-running tasks (`process_exam_pdf_task`, `sync_exam_s3_task`, `translate_exam_questions_task`) are dispatched to the Redis queue.
- **FastAPI BackgroundTasks Mode (Embedded Fallback):** If Celery workers are stopped or Redis is in maintenance mode, the system automatically falls back to FastAPI in-process `BackgroundTasks`. The identical coroutine (`async_process_exam_pdf`, `async_sync_exam_s3`) executes within an async task, ensuring pipeline jobs never drop silently.
- **Celery Beat & Daily Midnight Scheduler:**
  - Celery Beat schedule runs `reconcile_missing_translations_task` daily at midnight UTC (`crontab(hour=0, minute=0)`).
  - In addition, `daily_scheduler_service.py` runs an internal asyncio background timer loop (`_daily_midnight_scheduler_loop`) started on FastAPI lifespan boot, guaranteeing midnight email dispatch and translation reconciliation even in single-container environments without Celery Beat.

---

## 7. Cross-Cutting Architectural Concerns

### 7.1 Authentication & Authorization Model

The application enforces a dual-stack authentication mechanism:

```
                  Authorization: Bearer <token> or Cookie: access_token
                                             │
                                             ▼
                             Decode unverified JWT Header & Claims
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
               Issuer contains "clerk"                     Custom Local JWT
                       │                                           │
         Verify RS256 via Cached JWKS               Verify HS256 via SECRET_KEY
                       │                                           │
         Extract clerk_id (sub)                     Extract user_id (sub)
                       │                                           │
         Lookup User in DB by clerk_id              Lookup User in DB by id
                       │                                           │
         User not found? Auto-provision             User not found? Return 401
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             ▼
                               Check Account Status & Suspensions
                                             │
                       ├── status == "SUSPENDED" -> Check Cooling Period (7 days)
                       ├── status == "PENDING"   -> Check Admin Approval (AdminPendingApprovalException)
                       └── status == "ACTIVE"    -> Return Authenticated User
```

#### Authorization Guards & Role Evaluation
1. **Static Role-Based Access Control (`require_roles`):**
   - Compares `current_user.role` against allowed `UserRole` enums (`STUDENT`, `TEACHER`, `ADMIN`, `SUPER_ADMIN`).
   - If unauthorized, raises HTTP 403 Forbidden (`RoleMismatchException` or detail string).
2. **Fine-Grained Custom Role Permissions (`require_permission`):**
   - Administrators and Super Admins automatically bypass permission checks.
   - For other users, queries the junction table `role_permissions` linked to `current_user.custom_role_id`.
   - If a `TEACHER` user has no `custom_role_id`, falls back to the system role `slug="teacher"`.
3. **Combined Hybrid Guard (`require_roles_or_permission`):**
   - Grants access if the user holds an allowed role OR possesses the specific permission key.
4. **Subscription Quota Guard (`require_challenge_quota`):**
   - Gates Peer Challenge creation: Users on `SubscriptionTier.PREMIUM` enjoy unlimited challenges.
   - Users on `FREE` or `GUEST` tiers are capped at `FREE_CHALLENGE_LIMIT = 5` lifetime challenges. Exceeding the quota returns HTTP 403 with `CHALLENGE_LIMIT_REACHED`.

### 7.2 Concurrency & Database Lock Contention Strategy

Because SQLite (during dev/tests) and high-concurrency PostgreSQL transactions can encounter transient deadlocks or lock contention under batch commits:
- **`is_lock_or_concurrency_error(exc)`:** Detects lock contention, deadlock, busy timeouts, or operational DBAPI errors.
- **`@with_db_retry(max_retries=5, initial_delay=0.2)`:** Wraps transactional database operations in an exponential backoff loop with randomized jitter (`delay + random.uniform(0.05, 0.15)`).
- **`ManagedAsyncSession` (`managed_async_session()`):** Async context manager wrapper that guarantees automatic `rollback()` on exceptions, `commit()` on clean exit, and guaranteed session closure in `finally`.
- **Dialect-Aware Upserts (`app/db/upsert.py`):** Dynamically emits `ON CONFLICT DO NOTHING` or `ON CONFLICT (id) DO UPDATE SET ...` matching PostgreSQL native syntax or SQLite 3.24+ syntax.

### 7.3 Multi-Tier Caching Architecture

Caching is implemented as an active performance layer reducing database load by over 80%:
1. **Cache Hierarchy:**
   - **Primary Engine:** Redis 7 (DB 1) accessed via async `redis.asyncio`.
   - **Fallback Engine:** Thread-safe, bounded In-Memory LRU Cache (`InMemoryCache`) with `max_size=1000` items and sliding time-to-live.
   - **Fallback Controller (`FallbackCache`):** Catches Redis connection errors, automatically logging warnings and serving/populating the In-Memory cache without dropping requests.
2. **Standardized Namespaced Cache Keys:**
   - Format: `ep:<domain>:<action>:<id>:<param_hash>`
   - Query parameter dictionaries are sorted, stripped of volatile session objects, and hashed to 12-character MD5 tokens via `generate_filter_hash(params)`.
3. **Declarative Decorator (`@cached`):**
   - Applied directly to asynchronous router endpoints or service methods.
   - Automatically filters out internal dependencies (`session`, `current_user`, `request`) from key generation.
4. **Cascade Invalidation Helpers (`app/cache/helpers.py`):**
   - `invalidate_exam_cache(exam_id)`: Flushes exam details, manifests, listings, syllabus trees, and review queues.
   - `invalidate_question_cache(question_id, exam_id)`: Flushes question cards, markdown/yaml exports, and exam review sets.
   - `invalidate_user_cache(user_id)`: Flushes bookmarks, profile summaries, attempt histories, and psychometric profiles.
   - `invalidate_attempt_cache(attempt_id, user_id)`: Flushes test telemetry, matrices, question reports, and deltas.

### 7.4 Logging, Observability & Error Handling Strategy

1. **Structured Context Logging (`app/config/logger.py`):**
   - Standard format: `%(asctime)s [%(levelname)s] [%(name)s] [TaskID: %(task_id)s] (%(filename)s:%(lineno)d): %(message)s`
   - `TaskLoggerAdapter` dynamically injects `task_id` or `attempt_id` into all logs emitted by background workers, LangGraph pipeline nodes, and Celery tasks.
2. **Domain Exception Hierarchy (`app/core/exceptions.py`):**
   - `BaseAppException(HTTPException)`: Base domain exception captured by FastAPI's custom exception handler (`custom_app_exception_handler`), returning standard RFC-compliant JSON (`{"detail": "...", "error_type": "..."}`).
   - Derived exceptions: `UserAlreadyExistsException` (400), `InvalidCredentialsException` (401), `RoleMismatchException` (403), `InactiveUserException` (400), `AdminPendingApprovalException` (403), `AdminRejectedException` (403).
3. **Global Uncaught Exception Handler:**
   - Any uncaught runtime exception is intercepted by `global_exception_handler`, logging a full stack trace (`exc_info=True`) and returning HTTP 500 JSON without exposing internal database paths to end users.
4. **Temporary Directory Safety Guard (`app/core/cleanup.py`):**
   - `is_safe_temporary_path(path)`: Protects against accidental deletion of persistent assets. Prevents `cleanup_file` or `cleanup_directory` from deleting anything inside `storage_data`, `uploads`, or parent system directories. Whitelists only approved temporary patterns (`temp_uploads`, `temp_pdf_cache`, `temp_answer_keys`).

---

# PART B: LOW-LEVEL DESIGN (LLD) — DOMAIN SPECIFICATIONS

---

## Domain 1: Core Framework, Server Lifecycle & Configuration

### 1.1 File, Class & Method Catalog

| File Path | Class / Interface | Function / Method | Architectural Responsibility (One-Line Description) |
|---|---|---|---|
| `app/fastapi_server.py` | `FastAPI` (App Instance) | `lifespan(app)` | Manages boot sequence (DB init, connection pool warming, interrupted task sweep, midnight scheduler) and shutdown cleanup. |
| `app/fastapi_server.py` | - | `custom_app_exception_handler(request, exc)` | Intercepts all `BaseAppException` domain exceptions and serializes them to RFC-compliant JSON responses. |
| `app/fastapi_server.py` | - | `global_exception_handler(request, exc)` | Intercepts uncaught runtime exceptions, logs full stack trace, and returns HTTP 500 JSON without exposing internal paths. |
| `app/fastapi_server.py` | - | `root()` | Root health probe endpoint returning application name, status, and OpenAPI documentation paths. |
| `app/config/settings.py` | `Settings` | `validate_and_resolve_paths()` | Pydantic validator normalizing database connection strings (PostgreSQL/asyncpg, SQLite) and validating S3 bucket configs. |
| `app/config/settings.py` | `SettingsFactory` | `create_settings(...)` | Dynamically delegates secret loading to platform-specific secret loaders and returns environment-tailored Settings. |
| `app/config/settings.py` | `SettingsFactory` | `get_settings(...)` | Thread-safe singleton getter returning the active application `Settings` instance. |
| `app/config/secret_loaders/factory.py` | - | `get_secret_loader(platform)` | Factory resolving the appropriate `BaseSecretLoader` (`AWSSecretManagerLoader` vs `EnvSecretLoader`) based on target platform. |
| `app/config/secret_loaders/aws_loader.py` | `AWSSecretManagerLoader` | `load_secrets()` | Fetches and deserializes secret key-value pairs from AWS Secrets Manager using Boto3 client. |
| `app/config/secret_loaders/env_loader.py` | `EnvSecretLoader` | `load_secrets()` | Discovers and parses local `.env`, `.env.production`, or OS environment variables into configuration dictionary. |
| `app/config/filename_parser.py` | - | `parse_question_paper_filename(...)` | Parses question paper filename/code into standardized tokens and guarantees all-lowercase canonical code. |
| `app/config/filename_parser.py` | - | `parse_answer_key_filename(...)` | Parses answer key PDF filename/code into standardized tokens and guarantees all-lowercase canonical code. |
| `app/config/logger.py` | - | `setup_logger(name)` | Configures standardized structured Python logger with timestamp, severity, caller line, and message format. |
| `app/config/logger.py` | `TaskLoggerAdapter` | `process(msg, kwargs)` | Logger adapter dynamically injecting contextual `task_id` into all log output for distributed tracing. |
| `app/core/cleanup.py` | - | `is_safe_temporary_path(path)` | Security guard verifying path belongs strictly to whitelisted temporary folders before deletion. |
| `app/core/cleanup.py` | - | `cleanup_file(path)` | Removes a single temporary file if safety guard passes; logs deletion or warning. |
| `app/core/cleanup.py` | - | `cleanup_directory(path)` | Removes temporary directory tree while protecting shared root cache directories from accidental wipeout. |
| `app/core/languages.py` | `LanguageInfo` | `to_dict()` | Data container mapping ISO language codes, DB enum names, native scripts, and Google Translate codes. |
| `app/core/languages.py` | - | `normalize_language(lang_input)` | Standardizes any language input (name, alias, or enum string) into normalized `(iso_code, enum_name)` tuple. |
| `app/db/session.py` | - | `async_init_db()` | Initializes database schema, creates missing SQLModel tables, and applies Alembic migrations if `DB_MIGRATION=true`. |
| `app/db/session.py` | - | `warm_connection_pool()` | Opens concurrent connections against database engine up front at boot to eliminate remote RDS TLS handshake latency. |
| `app/db/session.py` | `ManagedAsyncSession` | `__aenter__()` / `__aexit__()` | Transaction context manager providing automatic commit, rollback on error, and guaranteed connection release. |
| `app/db/session.py` | - | `with_db_retry(...)` | Decorator adding exponential backoff and randomized jitter retry for operations encountering DB lock contention. |
| `app/db/upsert.py` | - | `bulk_insert_on_conflict_do_nothing(...)` | Performs dialect-aware bulk inserts with `ON CONFLICT DO NOTHING` for PostgreSQL and SQLite. |
| `app/db/upsert.py` | - | `bulk_upsert_translations(...)` | Performs dialect-aware bulk upserts with `ON CONFLICT DO UPDATE` to overwrite stale translations safely. |

### 1.2 Endpoints Table
*Core Framework does not expose domain business endpoints; it mounts the system root health probe:*

| HTTP Method | Route Path | Request Schema | Response Model | Auth & Permissions | Status Codes | Internal Services Called |
|---|---|---|---|---|---|---|
| `GET` | `/` | None | `dict` | Public (None) | 200 | Returns system status, project name, and OpenAPI documentation links. |

### 1.3 Database Schema
*Core Framework configures database session engines and portable types (`PortableJSON`, `DateTimeTZ`, `BigIntPK`); see individual domain tables for schemas.*

### 1.4 Existing Caching Usage
- `SettingsFactory` maintains an in-memory cached instance `_cached_settings` to prevent repeated disk/env re-reads.
- `pdf_utils.py` maintains `_pdf_bytes_cache` and `_download_locks` to prevent duplicate concurrent downloads of identical PDFs.

### 1.5 Async / Background Processing
- Startup lifespan launches `start_daily_midnight_scheduler()` background task loop.
- Shutdown lifespan executes temporary directory cleanup (`temp_uploads`, `temp_pdf_cache`, `temp_answer_keys`) and terminates Loky/multiprocessing executors.

---

## Domain 2: Authentication & Authorization

### 2.1 File, Class & Method Catalog

| File Path | Class / Interface | Function / Method | Architectural Responsibility (One-Line Description) |
|---|---|---|---|
| `app/routers/auth.py` | `APIRouter` | `register_user(...)` | Registers new candidate account (`STUDENT` or `ADMIN`); hashes password and returns user profile. |
| `app/routers/auth.py` | `APIRouter` | `login_user(...)` | Authenticates user via email/password; generates HS256 access and refresh tokens with device tracking. |
| `app/routers/auth.py` | `APIRouter` | `refresh_token(...)` | Validates high-entropy refresh token hash from cookie/header and issues rotated access token. |
| `app/routers/auth.py` | `APIRouter` | `logout_user(...)` | Revokes active refresh token and clears client session cookies. |
| `app/routers/auth.py` | `APIRouter` | `verify_email(...)` | Verifies account activation token and activates user account. |
| `app/routers/auth.py` | `APIRouter` | `forgot_password(...)` | Issues password reset token and dispatches reset link via AWS SES / SMTP email. |
| `app/routers/auth.py` | `APIRouter` | `reset_password(...)` | Validates reset token and commits newly hashed password to database. |
| `app/routers/auth.py` | `APIRouter` | `get_current_user_profile(...)` | Returns currently authenticated user entity along with student or admin profile. |
| `app/routers/auth.py` | `APIRouter` | `get_role_redirect(...)` | Returns role-specific dashboard navigation URL (`/admin/overview`, `/teacher/dashboard`, `/study-plan`). |
| `app/services/auth_service.py` | `AuthService` | `authenticate_user(...)` | Validates credentials against DB; enforces password verification and account active status checks. |
| `app/services/auth_service.py` | `AuthService` | `register_user(...)` | Creates User entity, hashes password, attaches Student/Admin profile, and triggers verification email. |
| `app/core/security.py` | - | `get_password_hash(pwd)` | Encodes password to UTF-8 (truncated to 72 bytes) and generates Bcrypt hashed string. |
| `app/core/security.py` | - | `verify_password(plain, hashed)` | Verifies plain candidate password against stored Bcrypt hash using constant-time comparison. |
| `app/core/security.py` | - | `get_token_hash(token)` | Generates SHA-256 digest of high-entropy refresh tokens for fast, collision-resistant DB storage. |
| `app/core/security.py` | - | `create_access_token(sub, role)` | Encodes JWT access token containing subject, role, and expiration (default: 15 minutes). |
| `app/core/security.py` | - | `create_refresh_token(sub, role)` | Encodes JWT refresh token with extended validity (default: 7 days). |
| `app/core/deps.py` | - | `get_current_user(...)` | Primary FastAPI dependency extracting, decoding, verifying (Clerk RS256 / Local HS256), and returning active User. |
| `app/core/deps.py` | - | `require_roles(roles)` | Dependency factory verifying current user role against allowed role whitelist. |
| `app/core/deps.py` | - | `require_permission(key)` | Dependency factory resolving dynamic custom role permissions and enforcing access gates. |

### 2.2 Endpoints Table
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/auth/register` | `None` | `TokenResponse` | Public (None) | 201, 500 | `AuthService` |
| `POST` | `/auth/login` | `None` | `TokenResponse` | Public (None) | 200, 500 | `AuthService` |
| `POST` | `/auth/logout` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `AuthService` |
| `POST` | `/auth/verify-email` | `None` | `Any` | Public (None) | 200, 500 | `AuthService` |
| `POST` | `/auth/forgot-password` | `None` | `Any` | Public (None) | 200, 500 | `AuthService` |
| `POST` | `/auth/reset-password` | `None` | `Any` | Public (None) | 200, 500 | `AuthService` |
| `GET` | `/auth/me` | `None` | `UserOut` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `PATCH` | `/auth/me` | `None` | `UserOut` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/auth/admin-only` | `None` | `dict` | `role_checker` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/auth/super-admin-only` | `None` | `dict` | `role_checker` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/auth/languages` | `None` | `Any` | Public (None) | 200, 500 | `Direct DB / Session` |

### 2.3 Database Schema

##### Table: `users`

**Read/Write Callers:** AuthService:create, update; UserRepository:get_by_email, get_by_id, update_role

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `full_name` | `VARCHAR(255)` | NO | `-` | - | - |
| `email` | `VARCHAR(255)` | NO | `-` | - | - |
| `clerk_id` | `VARCHAR(255)` | YES | `-` | - | Foreign key linkage |
| `password_hash` | `VARCHAR` | YES | `-` | - | - |
| `role` | `VARCHAR(11)` | NO | `UserRole.STUDENT` | - | Standardized string enum |
| `custom_role_id` | `INTEGER` | YES | `-` | FK -> `roles.id` | Foreign key linkage |
| `status` | `VARCHAR(9)` | NO | `UserStatus.ACTIVE` | - | Standardized string enum |
| `is_verified` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `profile_image` | `VARCHAR` | YES | `-` | - | - |
| `timezone` | `VARCHAR(100)` | NO | `Asia/Kolkata` | - | - |
| `preferred_language` | `VARCHAR(20)` | NO | `en` | - | - |
| `last_login` | `DATETIME` | YES | `-` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `created_at` | `DATETIME` | NO | `<function User.<lambda> at 0x7951330f28d0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `suspended_at` | `DATETIME` | YES | `-` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function User.<lambda> at 0x7951330f2980>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_users_clerk_id` | `clerk_id` | YES |
| `ix_users_preferred_language` | `preferred_language` | NO |
| `ix_users_email` | `email` | YES |
##### Table: `refresh_tokens`

**Read/Write Callers:** AuthService:save_refresh_token, revoke_user_refresh_tokens; UserRepository

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `token_hash` | `VARCHAR` | NO | `-` | - | - |
| `device_name` | `VARCHAR(255)` | YES | `-` | - | - |
| `ip_address` | `VARCHAR(45)` | YES | `-` | - | - |
| `expires_at` | `DATETIME` | NO | `-` | - | - |
| `revoked_at` | `DATETIME` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function RefreshToken.<lambda> at 0x795132f71010>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_refresh_tokens_user_id` | `user_id` | NO |

### 2.4 Existing Caching Usage
- `_jwks_clients`: In-memory dictionary caching Clerk PyJWKClient instances per issuer (`lifespan=3600s`).
- JWT verification runs locally using cached symmetric secret (`SECRET_KEY`).
- Token invalidation cascades call `invalidate_user_cache(user_id)`.

### 2.5 Async / Background Processing
- `send_verification_email` and `send_password_reset_email` are enqueued to background email dispatchers.
- `UserRepository.cleanup_old_refresh_tokens()` cleans expired refresh tokens on login housekeeping.

---

## Domain 3: Users, Profiles & Bookmarks

### 3.1 File, Class & Method Catalog

| File Path | Class / Interface | Function / Method | Architectural Responsibility (One-Line Description) |
|---|---|---|---|
| `app/routers/users.py` | `APIRouter` | `list_users(...)` | Paginated listing of platform users with role, status, and search filters. |
| `app/routers/users.py` | `APIRouter` | `create_user(...)` | Administrative endpoint to provision user accounts directly. |
| `app/routers/users.py` | `APIRouter` | `get_user(...)` | Fetches complete user details by unique numeric identifier. |
| `app/routers/users.py` | `APIRouter` | `update_user(...)` | Updates user details, full name, timezone, or preferred language. |
| `app/routers/users.py` | `APIRouter` | `delete_user(...)` | Hard-deletes or archives user account and cascades dependent records. |
| `app/routers/users.py` | `APIRouter` | `lookup_user_by_email(...)` | Rapid lookup endpoint matching users by email for challenge invitations. |
| `app/routers/users.py` | `APIRouter` | `list_bookmarks(...)` | Lists all questions bookmarked by the authenticated candidate with notes. |
| `app/routers/users.py` | `APIRouter` | `add_bookmark(...)` | Bookmarks a question for the user with optional custom revision notes. |
| `app/routers/users.py` | `APIRouter` | `remove_bookmark(...)` | Removes a question bookmark for the authenticated user. |
| `app/services/user_service.py` | `UserService` | `list_users(...)` | Executes filtered database queries across users and profile tables. |
| `app/repositories/user_repository.py` | `UserRepository` | `get_by_email_for_auth(...)` | Lean login-path lookup fetching only the User row without eager relationship loading. |
| `app/repositories/user_repository.py` | `UserRepository` | `get_by_id(...)` | Loads user with joined student and admin profiles. |
| `app/repositories/user_repository.py` | `UserRepository` | `suspend_admin(...)` | Sets user status to SUSPENDED, recording `suspended_at` for 7-day cooling period enforcement. |

### 3.2 Endpoints Table
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/users/me/bookmarks` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `get_cache` |
| `POST` | `/users/me/bookmarks/{question_id}` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `invalidate_` |
| `DELETE` | `/users/me/bookmarks/{question_id}` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `invalidate_` |
| `GET` | `/users` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `get_cache`, `UserService` |
| `POST` | `/users` | `None` | `UserRead` | `role_checker` | 201, 401, 403, 500 | `invalidate_`, `UserService` |
| `GET` | `/users/lookup` | `None` | `Union` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/users/{user_id}` | `None` | `UserRead` | `get_current_user` | 200, 401, 403, 404, 500 | `get_cache`, `UserService` |
| `PUT` | `/users/{user_id}` | `None` | `UserRead` | `role_checker` | 200, 401, 403, 404, 500 | `invalidate_`, `UserService` |
| `DELETE` | `/users/{user_id}` | `None` | `Any` | `role_checker` | 204, 401, 403, 404, 500 | `invalidate_`, `UserService` |

### 3.3 Database Schema

##### Table: `student_profiles`

**Read/Write Callers:** UserService, AuthService, UserRepository; stores XP, streak, tier

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `user_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `users.id` | Foreign key linkage |
| `subscription_tier` | `VARCHAR(7)` | NO | `SubscriptionTier.FREE` | - | - |
| `free_questions_attempted` | `INTEGER` | NO | `0` | - | - |
| `current_streak` | `INTEGER` | NO | `0` | - | - |
| `highest_streak` | `INTEGER` | NO | `0` | - | - |
| `total_xp` | `INTEGER` | NO | `0` | - | - |
| `level` | `INTEGER` | NO | `1` | - | - |
| `last_study_date` | `DATETIME` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function StudentProfile.<lambda> at 0x7951330f37f0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_student_profiles_user_id` | `user_id` | NO |
##### Table: `admin_profiles`

**Read/Write Callers:** AdminService, AuthService; stores organization, approval state, rejection reason

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `user_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `users.id` | Foreign key linkage |
| `organization_name` | `VARCHAR(255)` | YES | `-` | - | - |
| `department` | `VARCHAR(255)` | YES | `-` | - | - |
| `approved_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `approved_at` | `DATETIME` | YES | `-` | - | - |
| `rejected_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `rejected_at` | `DATETIME` | YES | `-` | - | - |
| `rejection_reason` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function AdminProfile.<lambda> at 0x795132f701a0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_admin_profiles_user_id` | `user_id` | NO |
##### Table: `admin_approval_logs`

**Read/Write Callers:** AdminService; records approval/rejection audit trail

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `admin_user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `reviewed_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `action` | `VARCHAR(50)` | NO | `-` | - | - |
| `reason` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function AdminApprovalLog.<lambda> at 0x795132f70880>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_admin_approval_logs_admin_user_id` | `admin_user_id` | NO |
| `ix_admin_approval_logs_reviewed_by_id` | `reviewed_by_id` | NO |
##### Table: `question_bookmarks`

**Read/Write Callers:** UserService:add_bookmark, remove_bookmark, list_bookmarks

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `notes` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function QuestionBookmark.<lambda> at 0x795132f716f0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_question_bookmarks_user_created` | `user_id`, `created_at` | NO |
| `ix_question_bookmarks_user_id` | `user_id` | NO |
| `ix_question_bookmarks_question_id` | `question_id` | NO |

### 3.4 Existing Caching Usage
- `ep:users:detail:<id>`: Caches user profile entities (TTL: 1800s).
- `ep:users:bookmarks:<id>`: Caches user bookmarks list (TTL: 1800s).
- Invalidation helper: `invalidate_user_cache(user_id)` flushes profile and bookmark keys upon update.

### 3.5 Async / Background Processing
- Suspended accounts enforce a 7-day cooling period dynamically calculated via `cooling_period_ends_at = suspended_at + 7 days`.

---

## Domain 4: Dynamic RBAC, Custom Roles & Fine-Grained Permissions

### 4.1 File, Class & Method Catalog

| File Path | Class / Interface | Function / Method | Architectural Responsibility (One-Line Description) |
|---|---|---|---|
| `app/routers/roles.py` | `APIRouter` | `list_roles(...)` | Lists all system and custom roles with linked permission sets. |
| `app/routers/roles.py` | `APIRouter` | `create_role(...)` | Creates new custom role with assigned permission IDs (Super Admin only). |
| `app/routers/roles.py` | `APIRouter` | `get_role(...)` | Fetches role details and permissions by role ID. |
| `app/routers/roles.py` | `APIRouter` | `update_role(...)` | Updates role name, description, and rebinds permission links. |
| `app/routers/roles.py` | `APIRouter` | `delete_role(...)` | Deletes custom role (system roles like Teacher/Admin are protected). |
| `app/routers/roles.py` | `APIRouter` | `list_permissions(...)` | Returns complete catalog of granular permission keys recognized by the platform. |
| `app/services/role_service.py` | `RoleService` | `assign_role_to_user(...)` | Updates a user's role and custom_role_id, recording an audit log in `role_assignment_logs`. |
| `app/core/deps.py` | - | `_user_has_permission(...)` | Evaluates whether a user's assigned custom role holds a specific permission key. |

### 4.2 Endpoints Table
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/admin/permissions` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `RoleService` |
| `GET` | `/admin/roles` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `RoleService` |
| `POST` | `/admin/roles` | `None` | `RoleOut` | `role_checker` | 200, 401, 403, 500 | `RoleService` |
| `PUT` | `/admin/roles/{role_id}` | `None` | `RoleOut` | `role_checker` | 200, 401, 403, 404, 500 | `RoleService` |
| `DELETE` | `/admin/roles/{role_id}` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `RoleService` |
| `PUT` | `/admin/users/{user_id}/role-assignment` | `None` | `UserOut` | `role_checker` | 200, 401, 403, 404, 500 | `invalidate_`, `RoleService` |

### 4.3 Database Schema

##### Table: `roles`

**Read/Write Callers:** RoleService:create_role, update_role, delete_role, list_roles

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `name` | `VARCHAR(100)` | NO | `-` | - | - |
| `slug` | `VARCHAR(100)` | NO | `-` | - | - |
| `base_role_type` | `VARCHAR(11)` | NO | `UserRole.ADMIN` | - | - |
| `is_system` | `BOOLEAN` | NO | `False` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `created_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `created_at` | `DATETIME` | NO | `<function Role.<lambda> at 0x795132ac3060>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function Role.<lambda> at 0x795132ac3110>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_roles_slug` | `slug` | YES |
| `ix_roles_name` | `name` | YES |
##### Table: `permissions`

**Read/Write Callers:** RoleService:list_permissions; seeded with question:review, exam:create, etc.

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `key` | `VARCHAR(100)` | NO | `-` | - | - |
| `label` | `VARCHAR(255)` | NO | `-` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function Permission.<lambda> at 0x795132ac2820>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_permissions_key` | `key` | YES |
##### Table: `role_permissions`

**Read/Write Callers:** RoleService; junction table linking roles to permissions

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `role_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `roles.id` | Foreign key linkage |
| `permission_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `permissions.id` | Foreign key linkage |
| `granted_at` | `DATETIME` | NO | `<function RolePermission.<lambda> at 0x795132ac3c10>` | - | - |
##### Table: `role_assignment_logs`

**Read/Write Callers:** RoleService:assign_role_to_user; audit trail of role transitions

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `target_user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `changed_by_admin_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `previous_role` | `VARCHAR(11)` | YES | `-` | - | - |
| `previous_custom_role_id` | `INTEGER` | YES | `-` | - | Foreign key linkage |
| `new_role` | `VARCHAR(11)` | NO | `-` | - | - |
| `new_custom_role_id` | `INTEGER` | YES | `-` | - | Foreign key linkage |
| `created_at` | `DATETIME` | NO | `<function RoleAssignmentLog.<lambda> at 0x7951329583b0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_role_assignment_logs_target_user_id` | `target_user_id` | NO |

### 4.4 Existing Caching Usage
- Custom role permissions are cached during session lifetime; invalidating roles triggers permission reload.

### 4.5 Async / Background Processing
- Synchronous transactional logging in `role_assignment_logs` on every role change.

---

## Domain 5: Exam Types & Configurations

### 5.1 File, Class & Method Catalog

| File Path | Class / Interface | Function / Method | Architectural Responsibility (One-Line Description) |
|---|---|---|---|
| `app/routers/exam_types.py` | `APIRouter` | `list_exam_types(...)` | Returns list of configured competitive exam categories (UPSC, MPSC, etc.) with exam counts. |
| `app/routers/exam_types.py` | `APIRouter` | `create_exam_type(...)` | Provisions a new examination type with default duration, marks, and negative marking (Admin only). |
| `app/routers/exam_types.py` | `APIRouter` | `get_exam_type(...)` | Retrieves detailed exam type configuration by numeric ID. |
| `app/routers/exam_types.py` | `APIRouter` | `update_exam_type(...)` | Updates exam type parameters, positive/negative marks, or active status. |
| `app/routers/exam_types.py` | `APIRouter` | `delete_exam_type(...)` | Deletes exam type if no active exams are bound to it. |
| `app/routers/exam_types.py` | `APIRouter` | `get_exam_type_by_code(...)` | Resolves exam type configuration by unique canonical code (e.g. `upsc`, `mpsc`). |
| `app/services/exam_type_service.py` | `ExamTypeService` | `list_exam_types(...)` | Fetches exam types with associated exam counts; enforces cache lookups. |
| `app/services/exam_type_service.py` | `ExamTypeService` | `create_exam_type(...)` | Validates uniqueness and creates new `ExamType` record. |
| `app/repositories/exam_type_repository.py` | `ExamTypeRepository` | `get_by_type(...)` | Case-insensitive lookup supporting alias fallbacks (e.g. seamless resolution between `upsc` and legacy `upse`). |

### 5.2 Endpoints Table
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/exam-types` | `None` | `List` | Public (None) | 200, 500 | `get_cache`, `ExamTypeService` |
| `GET` | `/admin/exam-types` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `ExamTypeService` |
| `GET` | `/admin/exam-types/{exam_type_id}` | `None` | `ExamTypeResponse` | `role_checker` | 200, 401, 403, 404, 500 | `ExamTypeService` |
| `POST` | `/admin/exam-types` | `None` | `ExamTypeResponse` | `role_checker` | 201, 401, 403, 500 | `ExamTypeService` |
| `PUT` | `/admin/exam-types/{exam_type_id}` | `None` | `ExamTypeResponse` | `role_checker` | 200, 401, 403, 404, 500 | `ExamTypeService` |
| `DELETE` | `/admin/exam-types/{exam_type_id}` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `ExamTypeService` |

### 5.3 Database Schema

##### Table: `exam_types`

**Read/Write Callers:** ExamTypeService, ExamTypeRepository; stores default exam rules (duration, marks, negative marks)

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `type` | `VARCHAR(50)` | NO | `-` | - | - |
| `name` | `VARCHAR(200)` | NO | `-` | - | - |
| `total_duration` | `INTEGER` | NO | `120` | - | - |
| `number_of_questions` | `INTEGER` | NO | `100` | - | - |
| `total_marks` | `FLOAT` | NO | `200.0` | - | - |
| `negative_marks` | `FLOAT` | NO | `0.66` | - | - |
| `positive_marks` | `FLOAT` | NO | `2.0` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `is_active` | `BOOLEAN` | NO | `True` | - | Boolean flag |
| `created_at` | `DATETIME` | NO | `<function ExamType.<lambda> at 0x795132f72090>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function ExamType.<lambda> at 0x795132f71fe0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_exam_types_type` | `type` | YES |
| `ix_exam_types_is_active` | `is_active` | NO |

### 5.4 Existing Caching Usage
- `@cached("exam_types:list", ttl=3600)`: Caches all active exam types for 1 hour.
- `@cached("exam_types:detail", ttl=3600)`: Caches individual exam type records.
- Invalidation helper: `invalidate_exam_cache` sweeps exam type listings upon modification.

### 5.5 Async / Background Processing
- No dedicated asynchronous queues; synchronous atomic CRUD with cache invalidation.

---

## Domain 6: Exams, Syllabus & Taxonomy Hierarchy

### 6.1 File, Class & Method Catalog

| File Path | Class / Interface | Function / Method | Architectural Responsibility (One-Line Description) |
|---|---|---|---|
| `app/routers/exams.py` | `APIRouter` | `list_exams(...)` | Paginated listing of available exams filtered by stage, year, category, and active status. |
| `app/routers/exams.py` | `APIRouter` | `upload_exam_pdf(...)` | Ingests Question Paper PDF, parses filename tokens, registers Exam, and triggers extraction. |
| `app/routers/exams.py` | `APIRouter` | `get_exam_detail(...)` | Returns complete metadata, question count, and JSON artifact URLs for an exam. |
| `app/routers/exams.py` | `APIRouter` | `delete_exam(...)` | Deletes exam record and cascades questions, attempts, and S3 artifact directories. |
| `app/routers/exams.py` | `APIRouter` | `sync_exam_s3(...)` | Triggers background Celery/FastAPI worker to generate consolidated JSON files and sync to S3. |
| `app/routers/exams.py` | `APIRouter` | `export_exam_zip(...)` | Bundles complete exam package (Markdown files, YAML exports, diagrams, JSON) into a downloadable ZIP. |
| `app/routers/syllabus.py` | `APIRouter` | `get_complete_syllabus(...)` | Returns multi-level nested syllabus tree (Version -> Subject -> Topic -> Subtopic) for an exam. |
| `app/routers/syllabus.py` | `APIRouter` | `verify_syllabus(...)` | Validates that all questions in an exam are correctly mapped to verified syllabus nodes. |
| `app/services/exam_service.py` | `ExamService` | `handle_pdf_upload(...)` | Orchestrates file saving, canonical code generation, duplicate checks, and worker dispatch. |
| `app/services/syllabus_service.py` | `SyllabusService` | `get_complete_syllabus(...)` | Traverses hierarchical taxonomy nodes with `@cached("syllabus:complete")`. |
| `app/services/syllabus_service.py` | `SyllabusService` | `evaluate_and_persist_question_integrity(...)` | Audits question integrity (missing options, truncated stems) and updates DB flags. |
| `app/services/exam_json_builder.py` | `ExamJsonBuilder` | `generate_and_upload(...)` | Builds `exam_questions.json` and `exam_solutions.json` and uploads to S3/local storage. |
| `app/services/exam_json_builder.py` | `ExamJsonBuilder` | `build_single_question_cards(...)` | Assembles single-question interactive JSON cards for live student exam taking. |
| `app/services/exam_export_service.py` | `ExamExportService` | `create_exam_export_zip(...)` | Assembles in-memory ZIP archive containing YAML, Markdown, diagrams, and master JSONs. |
| `app/repositories/exam_repository.py` | `ExamRepository` | `get_all_matching_canonical_exams(...)` | Matches exams by code, aliases (`upse` vs `upsc`), or composite tokens (year, stage, subject, set). |

### 6.2 Endpoints Table
##### Exams Router (`app/routers/exams.py`)
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/exams/upload` | `None` | `Any` | Public (None) | 200, 500 | `ExamService` |
| `GET` | `/exams` | `None` | `Any` | Public (None) | 200, 500 | `ExamService`, `get_cache` |
| `GET` | `/exams/{exam_id}/solutions` | `None` | `ExamReviewQuestionsResponse` | Public (None) | 200, 404, 500 | `QuestionService`, `get_cache` |
| `GET` | `/exams/{exam_id}/review-questions` | `None` | `ExamReviewQuestionsResponse` | Public (None) | 200, 404, 500 | `QuestionService`, `get_cache` |
| `GET` | `/exams/{exam_id}/question-artifact/{question_number}` | `None` | `Any` | Public (None) | 200, 404, 500 | `Direct DB / Session` |
| `GET` | `/exams/{exam_id}/question-db/{question_number}` | `None` | `Any` | Public (None) | 200, 404, 500 | `get_cache` |
| `GET` | `/exams/{exam_id}/solution-artifact/{question_number}` | `None` | `Any` | Public (None) | 200, 404, 500 | `Direct DB / Session` |
| `GET` | `/exams/{exam_id}/solution-db/{question_number}` | `None` | `Any` | Public (None) | 200, 404, 500 | `get_cache` |
| `GET` | `/exams/export-zip` | `None` | `Any` | Public (None) | 200, 500 | `ExamExportService` |
| `GET` | `/exams/{exam_name:path}/export-zip` | `None` | `Any` | Public (None) | 200, 404, 500 | `ExamExportService` |
| `GET` | `/exams/years` | `None` | `ExamsByYearResponse` | Public (None) | 200, 500 | `SyllabusService`, `get_cache` |
| `GET` | `/exams/by-year` | `None` | `ExamsByYearResponse` | Public (None) | 200, 500 | `SyllabusService`, `get_cache` |
| `GET` | `/exams/{exam_id}` | `None` | `Any` | Public (None) | 200, 404, 500 | `ExamService` |
| `DELETE` | `/exams/{exam_id}` | `None` | `Any` | Public (None) | 200, 404, 500 | `ExamService` |
| `GET` | `/exams/{exam_id}/syllabus` | `None` | `CompleteSyllabusResponse` | Public (None) | 200, 404, 500 | `SyllabusService`, `get_cache` |
| `GET` | `/exams/{exam_id}/integrity-questions` | `None` | `ExamIntegrityQuestionsResponse` | Public (None) | 200, 404, 500 | `SyllabusService`, `get_cache` |
##### Syllabus Router (`app/routers/syllabus.py`)
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/syllabus/hierarchy` | `None` | `CompleteSyllabusResponse` | Public (None) | 200, 500 | `SyllabusService`, `get_cache` |
| `GET` | `/syllabus` | `None` | `CompleteSyllabusResponse` | Public (None) | 200, 500 | `SyllabusService`, `get_cache` |
| `POST` | `/syllabus/verify` | `None` | `SyllabusVerifyResponse` | Public (None) | 200, 500 | `Direct DB / Session` |

### 6.3 Database Schema

##### Table: `exams`

**Read/Write Callers:** ExamService, ExamRepository, ExamJsonBuilder, PipelineManagementService

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `code` | `VARCHAR(100)` | NO | `-` | - | - |
| `name` | `VARCHAR(200)` | NO | `-` | - | - |
| `exam_type_id` | `INTEGER` | YES | `-` | FK -> `exam_types.id` | Foreign key linkage |
| `exam_type` | `VARCHAR(11)` | NO | `QuestionSourceType.PYQ` | - | - |
| `status` | `VARCHAR(20)` | NO | `ExamStatus.PENDING_HUMAN_REVIEW` | - | Standardized string enum |
| `stage` | `VARCHAR(50)` | NO | `prelims` | - | - |
| `subject_code` | `VARCHAR(50)` | NO | `gs1` | - | - |
| `source_year` | `INTEGER` | NO | `2023` | - | - |
| `paper_set_code` | `VARCHAR(20)` | NO | `SET_A` | - | - |
| `total_duration_minutes` | `INTEGER` | YES | `120` | - | - |
| `total_marks` | `FLOAT` | YES | `200.0` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `pdf_path` | `VARCHAR` | YES | `-` | - | - |
| `answer_key_pdf_path` | `VARCHAR` | YES | `-` | - | - |
| `total_questions` | `INTEGER` | YES | `100` | - | - |
| `extracted_questions_count` | `INTEGER` | NO | `0` | - | - |
| `missing_questions_count` | `INTEGER` | NO | `0` | - | - |
| `missing_question_numbers_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `questions_json_path` | `VARCHAR` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `solutions_json_path` | `VARCHAR` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `questions_json_folder_path` | `VARCHAR` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `solutions_json_folder_path` | `VARCHAR` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `total_pages` | `INTEGER` | YES | `-` | - | - |
| `display_order` | `INTEGER` | NO | `1` | - | - |
| `is_active` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `created_at` | `DATETIME` | NO | `<function Exam.<lambda> at 0x795132f72cf0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function Exam.<lambda> at 0x795132f72b90>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `last_synced_at` | `DATETIME` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_exams_active_order` | `is_active`, `display_order` | NO |
| `ix_exams_stage` | `stage` | NO |
| `ix_exams_exam_type` | `exam_type` | NO |
| `ix_exams_is_active` | `is_active` | NO |
| `ix_exams_canonical_match` | `stage`, `subject_code`, `source_year`, `paper_set_code` | NO |
| `ix_exams_exam_type_id` | `exam_type_id` | NO |
| `ix_exams_paper_set_code` | `paper_set_code` | NO |
| `ix_exams_status` | `status` | NO |
| `ix_exams_code` | `code` | YES |
| `ix_exams_subject_code` | `subject_code` | NO |
| `ix_exams_source_year` | `source_year` | NO |
##### Table: `syllabus_versions`

**Read/Write Callers:** SyllabusService; tracks syllabus revisions per exam

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `exam_id` | `INTEGER` | NO | `-` | FK -> `exams.id` | Foreign key linkage |
| `version_code` | `VARCHAR(50)` | NO | `-` | - | - |
| `title` | `VARCHAR` | YES | `-` | - | - |
| `effective_from` | `DATETIME` | NO | `<function SyllabusVersion.<lambda> at 0x795132f73d70>` | - | - |
| `is_active` | `BOOLEAN` | NO | `True` | - | Boolean flag |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_syllabus_versions_is_active` | `is_active` | NO |
| `ix_syllabus_versions_exam_id` | `exam_id` | NO |
| `ix_syllabus_exam_version` | `exam_id`, `version_code` | YES |
##### Table: `subjects`

**Read/Write Callers:** SyllabusService, QuestionRepository; GS1, CSAT, Polity, etc.

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `version_id` | `INTEGER` | NO | `-` | FK -> `syllabus_versions.id` | Foreign key linkage |
| `code` | `VARCHAR(50)` | NO | `DEFAULT` | - | - |
| `name` | `VARCHAR(200)` | NO | `-` | - | - |
| `display_order` | `INTEGER` | NO | `1` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_subjects_syllabus_order` | `version_id`, `display_order` | NO |
| `ix_subjects_version_id` | `version_id` | NO |
##### Table: `topics`

**Read/Write Callers:** SyllabusService, QuestionRepository; Preamble, Monetary Policy, etc.

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `subject_id` | `INTEGER` | NO | `-` | FK -> `subjects.id` | Foreign key linkage |
| `code` | `VARCHAR(50)` | NO | `DEFAULT` | - | - |
| `name` | `VARCHAR(200)` | NO | `-` | - | - |
| `display_order` | `INTEGER` | NO | `1` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_topics_subject_order` | `subject_id`, `display_order` | NO |
| `ix_topics_subject_id` | `subject_id` | NO |
##### Table: `subtopics`

**Read/Write Callers:** SyllabusService, MatrixOrchestrator; concept nodes with pyq_frequency

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `topic_id` | `INTEGER` | NO | `-` | FK -> `topics.id` | Foreign key linkage |
| `code` | `VARCHAR(50)` | NO | `DEFAULT` | - | - |
| `name` | `VARCHAR(200)` | NO | `-` | - | - |
| `display_order` | `INTEGER` | NO | `1` | - | - |
| `pyq_frequency` | `INTEGER` | NO | `0` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_subtopics_pyq_frequency` | `pyq_frequency` | NO |
| `ix_subtopics_topic_order` | `topic_id`, `display_order` | NO |
| `ix_subtopics_topic_id` | `topic_id` | NO |
##### Table: `question_hierarchy_links`

**Read/Write Callers:** SyllabusService, QuestionService; junction mapping questions to multiple taxonomy nodes

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `subtopic_id` | `INTEGER` | NO | `-` | FK -> `subtopics.id` | Foreign key linkage |
| `topic_id` | `INTEGER` | YES | `-` | FK -> `topics.id` | Foreign key linkage |
| `subject_id` | `INTEGER` | YES | `-` | FK -> `subjects.id` | Foreign key linkage |
| `is_primary` | `BOOLEAN` | NO | `False` | - | - |
| `relevance_weight` | `FLOAT` | NO | `1.0` | - | - |
| `concept_name` | `VARCHAR(200)` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_question_hierarchy_links_topic_id` | `topic_id` | NO |
| `ix_question_hierarchy_links_subtopic_id` | `subtopic_id` | NO |
| `ix_qhl_topic` | `topic_id` | NO |
| `ix_question_hierarchy_links_is_primary` | `is_primary` | NO |
| `ix_qhl_subject` | `subject_id` | NO |
| `ix_question_hierarchy_links_question_id` | `question_id` | NO |
| `ix_question_hierarchy_links_subject_id` | `subject_id` | NO |
| `ix_qhl_question_subtopic` | `question_id`, `subtopic_id` | YES |

### 6.4 Existing Caching Usage
- `@cached("exams:list", ttl=1800)`: Caches exam listings.
- `@cached("exams:detail", ttl=1800)`: Caches full exam metadata.
- `@cached("syllabus:complete", ttl=3600)`: Caches complete multi-level syllabus hierarchy.
- Invalidation helper: `invalidate_exam_cache(exam_id)` and `invalidate_taxonomy_cache()`.

### 6.5 Async / Background Processing
- `sync_exam_s3_task`: Celery background task generating `exam_questions.json` and `exam_solutions.json`.
- `process_exam_pdf_task`: Celery worker executing end-to-end PDF question extraction.

---

## Domain 7: Questions, Assets, Options & Passages

### 7.1 File, Class & Method Catalog

| File Path | Class / Interface | Function / Method | Architectural Responsibility (One-Line Description) |
|---|---|---|---|
| `app/routers/questions.py` | `APIRouter` | `list_questions(...)` | Paginated listing of extracted questions with multi-parameter taxonomy and integrity filters. |
| `app/routers/questions.py` | `APIRouter` | `create_question(...)` | Manually provisions a question with options, translations, and taxonomy linkage. |
| `app/routers/questions.py` | `APIRouter` | `get_question_detail(...)` | Returns complete question detail including stems, options, explanations, and reverse logic. |
| `app/routers/questions.py` | `APIRouter` | `update_question_detail(...)` | Updates stem, option texts, distractor analyses, and correctness flags. |
| `app/routers/questions.py` | `APIRouter` | `delete_question(...)` | Deletes question and cascades translations, options, assets, and explanations. |
| `app/routers/questions.py` | `APIRouter` | `get_question_markdown_file(...)` | Returns production-ready formatted Markdown string of the question. |
| `app/routers/questions.py` | `APIRouter` | `get_question_yaml_file(...)` | Returns standardized structured YAML representation of the question. |
| `app/routers/questions.py` | `APIRouter` | `get_question_solution(...)` | Returns solution card containing verified correct answer, explanation, and traps. |
| `app/services/question_service.py` | `QuestionService` | `list_questions_paginated(...)` | Queries filtered questions with preloaded translations, options, and assets. |
| `app/repositories/question_repository.py` | `QuestionRepository` | `list_questions_filtered(...)` | Low-level SQLModel query builder filtering questions by subject, topic, difficulty, and status. |
| `app/repositories/explanation_repository.py` | `ExplanationRepository` | `get_full_question_knowledge_base(...)` | Fetches per-question knowledge base, Bloom's level, IRT parameters, and distractor closeness. |
| `app/formatters/markdown_exporter.py` | - | `async_export_question_to_markdown(...)` | Formats question, statements, options, explanation, traps, and takeaways to clean Markdown. |
| `app/formatters/yaml_exporter.py` | - | `async_export_question_to_yaml(...)` | Formats question metadata and structure into standardized YAML. |

### 7.2 Endpoints Table
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/questions` | `None` | `QuestionPaginatedResponse` | Public (None) | 200, 500 | `QuestionService` |
| `GET` | `/questions/taxonomy` | `None` | `Any` | Public (None) | 200, 500 | `get_cache` |
| `POST` | `/questions` | `None` | `QuestionDetailResponse` | Public (None) | 201, 500 | `QuestionService`, `invalidate_` |
| `GET` | `/questions/recommended` | `None` | `Any` | Public (None) | 200, 500 | `QuestionService` |
| `GET` | `/questions/{question_id}` | `None` | `QuestionDetailResponse` | Public (None) | 200, 404, 500 | `QuestionService`, `get_cache` |
| `PUT` | `/questions/{question_id}` | `None` | `QuestionDetailResponse` | Public (None) | 200, 404, 500 | `QuestionService`, `invalidate_` |
| `PATCH` | `/questions/{question_id}` | `None` | `QuestionDetailResponse` | Public (None) | 200, 404, 500 | `QuestionService`, `invalidate_` |
| `DELETE` | `/questions/{question_id}` | `None` | `Any` | Public (None) | 204, 404, 500 | `QuestionService`, `invalidate_` |
| `GET` | `/questions/{question_id}/formatted/yaml` | `None` | `Any` | Public (None) | 200, 404, 500 | `QuestionService` |
| `GET` | `/questions/{question_id}/formatted/markdown` | `None` | `Any` | Public (None) | 200, 404, 500 | `QuestionService` |
| `GET` | `/questions/{question_id}/solution` | `None` | `Any` | Public (None) | 200, 404, 500 | `get_cache` |

### 7.3 Database Schema

##### Table: `questions`

**Read/Write Callers:** QuestionService, BatchQuestionRegistrar, QuestionRepository

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `exam_id` | `INTEGER` | YES | `-` | FK -> `exams.id` | Foreign key linkage |
| `subtopic_id` | `INTEGER` | YES | `-` | FK -> `subtopics.id` | Foreign key linkage |
| `section_code` | `VARCHAR(50)` | NO | `DEFAULT` | - | - |
| `paper_set_code` | `VARCHAR(20)` | NO | `SET_A` | - | - |
| `question_number_in_paper` | `INTEGER` | NO | `-` | - | - |
| `question_type` | `VARCHAR(50)` | NO | `SINGLE_CHOICE` | - | - |
| `difficulty` | `VARCHAR(6)` | NO | `DifficultyLevel.MEDIUM` | - | Standardized string enum |
| `marks` | `FLOAT` | NO | `2.0` | - | - |
| `negative_marks` | `FLOAT` | NO | `0.66` | - | - |
| `expected_time_seconds` | `INTEGER` | NO | `60` | - | - |
| `source_type` | `VARCHAR(11)` | NO | `QuestionSourceType.PYQ` | - | - |
| `source_year` | `INTEGER` | YES | `-` | - | - |
| `status` | `VARCHAR(20)` | NO | `QuestionStatus.PENDING_HUMAN_REVIEW` | - | Standardized string enum |
| `version` | `INTEGER` | NO | `1` | - | - |
| `is_mcq` | `BOOLEAN` | NO | `True` | - | - |
| `is_complete` | `BOOLEAN` | NO | `True` | - | Boolean flag |
| `has_image` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `page_numbers_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `requires_human_review` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `subject_raw` | `VARCHAR(255)` | YES | `-` | - | - |
| `topic_raw` | `VARCHAR(255)` | YES | `-` | - | - |
| `subtopic_raw` | `VARCHAR(255)` | YES | `-` | - | - |
| `difficulty_raw` | `VARCHAR(50)` | YES | `-` | - | - |
| `extraction_confidence` | `FLOAT` | YES | `-` | - | - |
| `extraction_issues_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `created_at` | `DATETIME` | NO | `<function Question.<lambda> at 0x795132e433d0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function Question.<lambda> at 0x795132e43320>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_questions_subtopic_id` | `subtopic_id` | NO |
| `ix_questions_paper_set_code` | `paper_set_code` | NO |
| `ix_questions_source_type` | `source_type` | NO |
| `ix_questions_status` | `status` | NO |
| `ix_questions_requires_human_review` | `requires_human_review` | NO |
| `ix_questions_status_exam` | `status`, `exam_id` | NO |
| `ix_questions_exam_id` | `exam_id` | NO |
| `ix_questions_difficulty` | `difficulty` | NO |
| `ix_questions_source_year` | `source_year` | NO |
| `ix_questions_is_complete` | `is_complete` | NO |
| `ix_questions_subtopic` | `subtopic_id` | NO |
| `ix_questions_section_code` | `section_code` | NO |
| `ix_questions_question_number_in_paper` | `question_number_in_paper` | NO |
| `ix_questions_has_image` | `has_image` | NO |
| `ix_questions_exam_number` | `exam_id`, `question_number_in_paper` | YES |
##### Table: `question_translations`

**Read/Write Callers:** QuestionTranslationService, BatchQuestionRegistrar; localized stems

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `language` | `VARCHAR(9)` | NO | `-` | - | Standardized string enum |
| `question_text` | `VARCHAR` | NO | `-` | - | - |
| `parent_context_override` | `VARCHAR` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_question_translations_language` | `language` | NO |
| `ix_q_trans_unique` | `question_id`, `language` | YES |
| `ix_question_translations_question_id` | `question_id` | NO |
##### Table: `question_options`

**Read/Write Callers:** QuestionService, BatchQuestionRegistrar; A/B/C/D choices, correctness

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `option_label` | `VARCHAR(10)` | NO | `-` | - | - |
| `display_order` | `INTEGER` | NO | `-` | - | - |
| `is_correct` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `is_complete` | `BOOLEAN` | NO | `True` | - | Boolean flag |
| `closeness_score` | `FLOAT` | NO | `0.0` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_options_question_label` | `question_id`, `option_label` | YES |
| `ix_question_options_question_id` | `question_id` | NO |
| `ix_options_question_order` | `question_id`, `display_order` | NO |
| `ix_question_options_is_correct` | `is_correct` | NO |
| `ix_question_options_is_complete` | `is_complete` | NO |
##### Table: `option_translations`

**Read/Write Callers:** QuestionTranslationService, BatchQuestionRegistrar; localized option text

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `option_id` | `INTEGER` | NO | `-` | FK -> `question_options.id` | Foreign key linkage |
| `language` | `VARCHAR(9)` | NO | `-` | - | Standardized string enum |
| `option_text` | `VARCHAR` | NO | `-` | - | - |
| `distractor_analysis` | `VARCHAR` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_option_translations_option_id` | `option_id` | NO |
| `ix_option_translations_language` | `language` | NO |
| `ix_opt_trans_unique` | `option_id`, `language` | YES |
##### Table: `question_option_reasoning`

**Read/Write Callers:** BatchQuestionRegistrar; stores why_tempting and whats_actually_true

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_option_id` | `INTEGER` | NO | `-` | FK -> `question_options.id` | Foreign key linkage |
| `why_tempting` | `TEXT` | NO | `-` | - | - |
| `whats_actually_true` | `TEXT` | NO | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function QuestionOptionReasoning.<lambda> at 0x795132eeb110>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ux_option_reasoning_option` | `question_option_id` | YES |
| `ix_question_option_reasoning_question_option_id` | `question_option_id` | YES |
##### Table: `question_metadata`

**Read/Write Callers:** ExplanationRepository, BatchQuestionRegistrar; IRT a/b/c params, Bloom's level

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `blooms_level` | `VARCHAR(10)` | NO | `BloomsLevel.ANALYZE` | - | Standardized string enum |
| `cognitive_skill` | `VARCHAR` | YES | `-` | - | - |
| `primary_concept_tag` | `VARCHAR` | NO | `GENERAL` | - | - |
| `irt_discrimination_a` | `FLOAT` | NO | `1.5` | - | - |
| `irt_difficulty_b` | `FLOAT` | NO | `0.0` | - | - |
| `irt_pseudo_guessing_c` | `FLOAT` | NO | `0.25` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_question_metadata_blooms_level` | `blooms_level` | NO |
| `ix_q_meta_blooms` | `blooms_level` | NO |
| `ix_question_metadata_primary_concept_tag` | `primary_concept_tag` | NO |
| `ix_question_metadata_question_id` | `question_id` | YES |
| `ix_q_meta_concept` | `primary_concept_tag` | NO |
##### Table: `question_explanations`

**Read/Write Callers:** ExplanationRepository, BatchQuestionRegistrar; solutions, common mistakes

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `language` | `VARCHAR(9)` | NO | `LanguageCode.ENGLISH` | - | Standardized string enum |
| `core_concept` | `VARCHAR` | YES | `-` | - | - |
| `detailed_solution` | `VARCHAR` | NO | `-` | - | - |
| `common_mistake` | `VARCHAR` | YES | `-` | - | - |
| `common_traps_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `key_takeaways_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `created_at` | `DATETIME` | NO | `<function QuestionExplanation.<lambda> at 0x795132b921f0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function QuestionExplanation.<lambda> at 0x795132b922a0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_question_explanations_question_id` | `question_id` | NO |
| `ix_question_explanations_language` | `language` | NO |
| `ix_q_expl_question_lang` | `question_id`, `language` | YES |
##### Table: `question_assets`

**Read/Write Callers:** DoclingOcrExtractor, BatchQuestionRegistrar; diagrams, figures, bboxes

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `asset_path` | `VARCHAR` | YES | `-` | - | - |
| `table_markdown` | `VARCHAR` | YES | `-` | - | - |
| `asset_type` | `VARCHAR(11)` | NO | `AssetType.DIAGRAM` | - | - |
| `caption` | `VARCHAR` | YES | `-` | - | - |
| `bounding_box_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `display_order` | `INTEGER` | NO | `1` | - | - |
| `created_at` | `DATETIME` | NO | `<function QuestionAsset.<lambda> at 0x795132eea610>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_question_assets_question_id` | `question_id` | NO |
| `ix_assets_question_order` | `question_id`, `display_order` | NO |
| `ix_question_assets_asset_type` | `asset_type` | NO |
##### Table: `passages`

**Read/Write Callers:** BatchQuestionRegistrar; multi-question reading comprehension contexts

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `subtopic_id` | `INTEGER` | YES | `-` | FK -> `subtopics.id` | Foreign key linkage |
| `exam_id` | `INTEGER` | YES | `-` | FK -> `exams.id` | Foreign key linkage |
| `section_code` | `VARCHAR(50)` | NO | `DEFAULT` | - | - |
| `memory_type` | `VARCHAR(19)` | NO | `MemoryType.PASSAGE` | - | - |
| `is_complete` | `BOOLEAN` | NO | `True` | - | Boolean flag |
| `page_numbers_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `question_ids_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `created_at` | `DATETIME` | NO | `<function Passage.<lambda> at 0x795132e41bc0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_passages_section_code` | `section_code` | NO |
| `ix_passages_subtopic_id` | `subtopic_id` | NO |
| `ix_passages_memory_type` | `memory_type` | NO |
| `ix_passages_subtopic` | `subtopic_id` | NO |
| `ix_passages_is_complete` | `is_complete` | NO |
| `ix_passages_exam_section` | `exam_id`, `section_code` | NO |
| `ix_passages_exam_id` | `exam_id` | NO |
##### Table: `passage_translations`

**Read/Write Callers:** QuestionTranslationService; localized passage texts

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `passage_id` | `INTEGER` | NO | `-` | FK -> `passages.id` | Foreign key linkage |
| `language` | `VARCHAR(9)` | NO | `-` | - | Standardized string enum |
| `passage_text` | `VARCHAR` | NO | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_passage_trans_unique` | `passage_id`, `language` | YES |
| `ix_passage_translations_language` | `language` | NO |
| `ix_passage_translations_passage_id` | `passage_id` | NO |

### 7.4 Existing Caching Usage
- `ep:questions:detail:<id>`: Caches full question cards (TTL: 1800s).
- `ep:questions:list:<hash>`: Caches filtered question query results.
- Invalidation helper: `invalidate_question_cache(question_id, exam_id)` flushes affected cards and review listings.

### 7.5 Async / Background Processing
- Cropped diagram images are saved asynchronously via `BaseStorageProvider.save_image()`.
- Single question artifact updates trigger `ExamJsonBuilder.sync_single_question_artifacts()`.

---

## Domain 8: Deterministic Document Extraction Pipeline

### 8.1 Module Architecture & File Catalog

This domain implements a robust, deterministic document parsing and extraction pipeline for competitive exam question papers (PDFs). It replaces legacy non-deterministic multi-agent pipelines with an OCR + noise-tolerant regex + LangGraph state machine architecture that reliably handles multi-column layouts, bilingual papers (Hindi/English), cross-page passage stitching, and formula extraction.

- `app/pipeline/batch_processor.py`:
  - `BatchQuestionRegistrar`: Manages transactional bulk ingestion of extracted questions into the database in chunks of 10 (`_BATCH_SIZE = 10`), minimizing lock contention and rollbacks.
  - `calculate_question_expected_time()`: Computes baseline solving time in seconds based on difficulty tier, blooms taxonomy level, and question length.
  - `_merge_question_item_into_registry()`: Deduplicates and merges extracted question variants across languages.
  - `build_question_registry()`: Prepares consolidated batch records for database insertion.
  - `_get_exam_lock()`: Acquires an asynchronous Redis mutex lock (`ep:lock:pipeline:<exam_id>`) to prevent duplicate simultaneous pipeline runs.
- `app/pipeline/batch_schema.py`:
  - `QuestionRegistryItem`: Pydantic transfer schema representing an intermediate parsed question record prior to database commitment.
  - `BatchProcessingSummary`: Metrics envelope containing processed, skipped, failed, and HITL-flagged question counts.
- `app/pipeline/docling_ocr_extractor.py`:
  - `DoclingOcrExtractor`: Uses RapidOCR and ONNX runtime to extract raw layout tokens, bounding boxes, text blocks, and embedded figures from input PDF pages.
- `app/pipeline/dsu_stitcher.py`:
  - `DisjointSetUnion`: Data structure maintaining connected components of multi-page reading passages and questions split by page breaks.
  - `resolve_transitive_passages_dsu()`: Resolves transitive relationships between split text blocks to reconstruct complete reading comprehension passages.
  - `async_crop_and_save_asset()`: Crops visual diagrams and formulas from PDF coordinates and uploads them asynchronously to storage.
- `app/pipeline/graph.py`:
  - `build_langgraph_pipeline()`: Assembles the compiled LangGraph workflow.
  - `node_ocr_convert()`: Executes OCR extraction stage on raw PDF bytes.
  - `node_regex_parse_and_stitch()`: Executes deterministic pattern matching and DSU passage stitching.
  - `node_mcq_validator_and_hitl()`: Runs schema validation and flags low-confidence or corrupt questions for HITL review.
  - `node_export_artifacts()`: Exports validated question JSON and updates pipeline run records.
- `app/pipeline/patterns.py`:
  - `extract_header_tags()`: Extracts exam metadata (year, paper code, subject, shift) from document header blocks.
  - Noise-tolerant regex patterns: Standardized matching rules for question anchors (e.g., `Q.1`, `Question 1:`, `१.`), option anchors (`(A)`, `(B)`, `[a]`, `(क)`), Hindi devanagari numerals, and tabular questions.
- `app/pipeline/regex_question_parser.py`:
  - `QuestionRecord`: In-memory container for parsed question blocks.
  - `map_difficulty()`: Heuristic classifier mapping question length, vocabulary complexity, and formula density to difficulty tier.
  - `detect_format()`: Identifies question format (`MCQ`, `NUMERICAL`, `MATCH_LIST`, `ASSERTION_REASON`).
  - `split_into_question_blocks()`: Partitions page OCR text into individual question candidate slices.
  - `disambiguate_asset_question()`: Links cropped diagrams to corresponding question bodies based on bounding box proximity.
  - `parse_question_block()`: Extracts question stem, options, assertions, and metadata from candidate slices.
- `app/pipeline/state.py`:
  - `LanguageCodeEnum`, `MemoryTypeEnum`, `AssetTypeEnum`, `LayoutTypeEnum`, `SeamBlockTypeEnum`: Domain enums.
  - `ExtractionState`: TypedDict representing the pipeline execution state flowing across LangGraph nodes.
- `app/pipeline/taxonomy_resolver.py`:
  - `MatchTier`, `FieldResolutionResult`, `TaxonomyResolutionMetrics`, `MultiConceptItemResolved`, `ValidatedTaxonomy`: Resolution result schemas.
  - `validate_master_syllabus_hierarchy()`: Verifies that assigned subject/topic/subtopic matches the master syllabus.
  - `normalize_text()`: Standardizes taxonomy strings for matching.
  - `pure_python_token_sort_ratio()`: Fallback string distance metric avoiding external C-extension dependencies.
  - `get_taxonomy_resolver()`: Singleton factory returning cached syllabus taxonomy trees.
- `app/pipeline/validator.py`:
  - `ainvoke_mcq_validator_llm()`: Optional LLM validator evaluating question semantic integrity and answer key alignment when regex heuristics detect anomalies.
- `app/routers/pipeline.py`:
  - FastAPI router exposing endpoints for PDF upload, answer key ingestion, run status tracking, and re-extraction triggers.
- `app/services/pipeline_management_service.py`:
  - Orchestrates background extraction tasks, updates `PipelineRun` database records, records execution logs, and dispatches failure notifications.

### 8.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/pipeline/check-duplicate` | `None` | `Any` | `role_checker` | 200, 401, 403, 500 | `PipelineManagementService` |
| `POST` | `/pipeline/upload-question-paper` | `None` | `Any` | `role_checker` | 202, 401, 403, 500 | `ExamService`, `ExamRepository`, `ExamTypeRepository`, `PipelineManagementService` |
| `POST` | `/pipeline/upload-answer-key` | `None` | `Any` | Public (None) | 200, 500 | `Direct DB / Session` |
| `GET` | `/pipeline/questions-status/{exam_identifier}` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `GET` | `/pipeline/status/{exam_identifier}` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `PipelineManagementService` |
| `POST` | `/pipeline/trigger-explanation/{exam_id}` | `None` | `Any` | Public (None) | 200, 404, 500 | `Direct DB / Session` |
| `POST` | `/pipeline/stop/{exam_id}` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `PipelineManagementService` |
| `POST` | `/pipeline/restart/{exam_id}` | `None` | `Any` | `role_checker` | 202, 401, 403, 404, 500 | `PipelineManagementService` |
| `POST` | `/pipeline/retry/{exam_id}` | `None` | `Any` | `role_checker` | 202, 401, 403, 404, 500 | `PipelineManagementService` |


### 8.3 Database Schemas & Persistence

##### Table: `pipeline_runs`

**Read/Write Callers:** PipelineManagementService, pipeline router, worker tasks

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `exam_id` | `INTEGER` | NO | `-` | FK -> `exams.id` | Foreign key linkage |
| `pipeline_type` | `VARCHAR(50)` | NO | `-` | - | - |
| `status` | `VARCHAR(50)` | NO | `PENDING` | - | Standardized string enum |
| `current_step` | `VARCHAR(100)` | NO | `INITIALIZING` | - | - |
| `progress_percent` | `FLOAT` | NO | `0.0` | - | - |
| `error_log` | `VARCHAR` | YES | `-` | - | - |
| `started_at` | `DATETIME` | NO | `<function PipelineRun.<lambda> at 0x795132b92da0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `completed_at` | `DATETIME` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_pipeline_runs_status` | `status` | NO |
| `ix_pipeline_runs_exam_id` | `exam_id` | NO |
| `ix_pipeline_runs_exam_type` | `exam_id`, `pipeline_type` | NO |

##### Table: `answer_key_batches`

**Read/Write Callers:** AnswerKeyRepository, pipeline router

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `exam_id` | `INTEGER` | NO | `-` | FK -> `exams.id` | Foreign key linkage |
| `pdf_path` | `VARCHAR` | NO | `-` | - | - |
| `target_set_code` | `VARCHAR(20)` | NO | `SET_A` | - | - |
| `detected_set_code` | `VARCHAR(20)` | YES | `-` | - | - |
| `set_match_status` | `VARCHAR(16)` | NO | `SetMatchStatus.UNDETECTED` | - | - |
| `total_keys_extracted` | `INTEGER` | NO | `0` | - | - |
| `total_keys_mapped` | `INTEGER` | NO | `0` | - | - |
| `created_at` | `DATETIME` | NO | `<function AnswerKeyBatch.<lambda> at 0x795132a2c460>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_answer_key_batches_exam_id` | `exam_id` | NO |
| `ix_ak_batch_exam_status` | `exam_id`, `set_match_status` | NO |
| `ix_answer_key_batches_set_match_status` | `set_match_status` | NO |
| `ix_answer_key_batches_detected_set_code` | `detected_set_code` | NO |
| `ix_answer_key_batches_target_set_code` | `target_set_code` | NO |

##### Table: `answer_key_mappings`

**Read/Write Callers:** AnswerKeyRepository, pipeline matching logic

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `batch_id` | `INTEGER` | NO | `-` | FK -> `answer_key_batches.id` | Foreign key linkage |
| `question_id` | `INTEGER` | YES | `-` | FK -> `questions.id` | Foreign key linkage |
| `printed_question_number` | `INTEGER` | NO | `-` | - | - |
| `detected_option_label` | `VARCHAR(10)` | NO | `-` | - | - |
| `paper_set_code` | `VARCHAR(20)` | NO | `SET_A` | - | - |
| `mapping_status` | `VARCHAR(20)` | NO | `MappingStatus.APPLIED` | - | - |
| `notes` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function AnswerKeyMapping.<lambda> at 0x795132a2d0c0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_ak_mapping_batch_q` | `batch_id`, `question_id` | NO |
| `ix_answer_key_mappings_printed_question_number` | `printed_question_number` | NO |
| `ix_answer_key_mappings_mapping_status` | `mapping_status` | NO |
| `ix_answer_key_mappings_paper_set_code` | `paper_set_code` | NO |
| `ix_answer_key_mappings_question_id` | `question_id` | NO |
| `ix_ak_mapping_status` | `mapping_status` | NO |
| `ix_answer_key_mappings_batch_id` | `batch_id` | NO |


### 8.4 Existing Caching Usage
- Redis Lock `ep:lock:pipeline:<exam_id>` (TTL: 3600s): Prevents concurrent pipeline execution on the same exam.
- Taxonomy Tree Cache `ep:taxonomy:tree:<exam_type_id>` (TTL: 86400s): Caches compiled syllabus taxonomy for instant regex mapping.
- Run Status Cache `ep:pipeline:run:<run_id>` (TTL: 300s): High-frequency status polling cache for UI progress bars.

### 8.5 Async / Background Processing
- `upload_question_paper`: Dispatches async execution via `asyncio.create_task` or Celery task worker `process_exam_paper_pipeline`.
- `node_export_artifacts`: Calls `ExamJsonBuilder` and `BaseStorageProvider` in background to write production artifacts.

---

## Domain 9: Human-in-the-Loop (HITL) Review & Auditing

### 9.1 Module Architecture & File Catalog

This domain provides administrative oversight, question auditing, and manual correction workflows for questions flagged during document extraction or reported by users. It enforces quality gates before extracted questions are promoted to live test sessions.

- `app/routers/review.py`:
  - `get_exam_questions_review()`: Fetches paginated review items for a specific exam.
  - `get_pending_tasks()`: Lists unassigned or pending `HumanReviewTask` items.
  - `get_question_detail()`: Retrieves complete question tree (stem, options, assets, hierarchy) for review.
  - `approve_question()`: Marks question as verified and resolves associated review tasks.
  - `trigger_reextraction()`: Queues single-question re-extraction with modified bounding coordinates.
  - `OptionEditRequest`, `ApproveQuestionRequest`, `RejectQuestionRequest`, `UpdateExplanationRequest`: Request payload models.
- `app/hitl/review_service.py`:
  - `ReviewService`:
    - `get_review_queue()`: Queries pending tasks ordered by priority and creation timestamp.
    - `submit_review_decision()`: Handles approve, reject, or edit actions transactionally.
    - `update_question_content()`: Modifies question stem, options, or explanations based on human reviewer input.
    - `log_review_action()`: Records audit trail of reviewer modifications and awards teacher reward points if applicable.
- `app/db/models/review.py`:
  - `HumanReviewTask`: Database entity tracking question review requests, assigned reviewers, priority, flags, and resolution statuses.

### 9.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/admin/review/exams/{exam_id}/questions` | `None` | `ExamReviewQuestionsResponse` | Public (None) | 200, 404, 500 | `QuestionService`, `get_cache` |
| `GET` | `/admin/review/tasks` | `None` | `Any` | Public (None) | 200, 500 | `get_cache`, `HumanReviewService` |
| `GET` | `/admin/review/tasks/{question_id}` | `None` | `Any` | Public (None) | 200, 404, 500 | `get_cache`, `HumanReviewService` |
| `POST` | `/admin/review/tasks/{question_id}/approve` | `None` | `Any` | Public (None) | 200, 404, 500 | `invalidate_`, `HumanReviewService` |
| `POST` | `/admin/review/tasks/{question_id}/reextract` | `None` | `Any` | Public (None) | 200, 404, 500 | `invalidate_`, `HumanReviewService` |
| `POST` | `/admin/review/tasks/{question_id}/reject` | `None` | `Any` | Public (None) | 200, 404, 500 | `invalidate_`, `HumanReviewService` |
| `POST` | `/admin/review/tasks/{question_id}/update-explanation` | `None` | `Any` | Public (None) | 200, 404, 500 | `invalidate_`, `HumanReviewService` |


### 9.3 Database Schemas & Persistence

##### Table: `human_review_tasks`

**Read/Write Callers:** ReviewService, pipeline.validator, review router, question_service

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `exam_id` | `INTEGER` | NO | `-` | FK -> `exams.id` | Foreign key linkage |
| `assigned_admin_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `review_status` | `VARCHAR` | NO | `PENDING_REVIEW` | - | - |
| `is_flagged_by_validator` | `BOOLEAN` | NO | `False` | - | - |
| `failure_reasons_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `reviewer_notes` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function HumanReviewTask.<lambda> at 0x795132cf2560>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `reviewed_at` | `DATETIME` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_review_tasks_flagged` | `is_flagged_by_validator`, `review_status` | NO |
| `ix_human_review_tasks_is_flagged_by_validator` | `is_flagged_by_validator` | NO |
| `ix_human_review_tasks_exam_id` | `exam_id` | NO |
| `ix_human_review_tasks_question_id` | `question_id` | NO |
| `ix_review_tasks_status_exam` | `review_status`, `exam_id` | NO |
| `ix_human_review_tasks_assigned_admin_id` | `assigned_admin_id` | NO |
| `ix_human_review_tasks_review_status` | `review_status` | NO |


### 9.4 Existing Caching Usage
- `ep:review:queue:count`: Caches pending review task counter (TTL: 60s).
- Invalidation: `ReviewService.submit_review_decision()` invalidates `ep:review:queue:count` and question detail cache.

### 9.5 Async / Background Processing
- Question approval invalidates cached exam questions and regenerates candidate exam JSON bundles in background.
- Reviewer point awards are dispatched asynchronously to `ReviewPointsService`.

---

## Domain 10: Exam Taking, Telemetry & Session Management

### 10.1 Module Architecture & File Catalog

This domain powers the real-time test-taking interface, candidate session state machines, high-frequency telemetry logging, micro-answer saves, option revision tracking, and exam submission flows. It supports both structured mock tests (`Test`) and live past-year exam runs (`ExamAttempt`), handling network interruptions, auto-pause heartbeats, and client reconnection.

- `app/routers/attempts.py`:
  - `start_exam_attempt()`: Initializes candidate session, generates randomized or sequential question delivery tokens, sets timer deadlines.
  - `get_question_by_number()`: Fetches single question card with localized stem, options, and candidate's previous response state.
  - `get_all_attempt_questions_bulk()`: Optimistic bulk loader fetching all test questions in a single payload for offline client caching.
  - `save_response()`: Real-time telemetry sink capturing selected option, time spent, elimination state, and confidence tag.
  - `save_responses_batch()`: High-throughput batch submission endpoint for client offline sync.
  - `submit_exam()`: Finalizes attempt, locks response mutations, triggers synchronous Phase 1 psychometric computation, and queues async Phase 2 AI synthesis.
  - `heartbeat()`: Keeps session active, tracks active window focus, and detects tab-switching or prolonged inactivity.
  - `reveal_answer()`: Instant practice-mode feedback endpoint revealing correct answer and explanation if practice mode is active.
- `app/services/exam_session_service.py`:
  - `ExamSessionService`:
    - `start_exam()`: Validates exam access, checks ongoing attempt limits, creates `ExamAttempt` row in `IN_PROGRESS` state.
    - `get_question()`: Resolves question asset URLs, builds navigation status payload, and masks correct answers.
    - `_build_question_nav_response()`: Constructs palette metadata (attempted, skipped, marked for review).
    - `save_response()`: Records or updates `ExamQuestionResponse`, logs option revisions to `QuestionSwitchLog`.
    - `save_responses_batch()`: Transactional bulk upsert for batch telemetry payloads.
    - `heartbeat()`: Updates last active timestamp and flags potential proctoring violations.
    - `submit_exam()`: Enforces exam time limits, transitions status to `SUBMITTED`, and kicks off `run_post_submission_pipeline`.
    - `list_user_attempts()`: Lists historical test runs for candidate dashboard with summary scores.
    - `sync_guest_sessions()`: Reassigns anonymous or guest session attempts to an authenticated account upon signup.
- `app/db/models/telemetry.py` & `app/db/models/exam_type.py`:
  - `ExamAttempt`: Entity tracking exam run lifecycle (`IN_PROGRESS`, `PAUSED`, `SUBMITTED`, `EVALUATED`, `ABANDONED`).
  - `ExamQuestionResponse`: Detailed telemetry per question (option selected, time spent, strike-through options, switch count).
  - `QuestionSwitchLog`: High-resolution event stream capturing every option change and timestamp.
  - `Test`, `TestQuestion`, `UserTestAttempt`, `UserQuestionResponse`: Equivalent relational entities for customizable user-created tests and mock series.

### 10.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/attempts` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `ExamSessionService` |
| `GET` | `/attempts/status-by-exam` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `ExamSessionService` |
| `POST` | `/attempts/start` | `None` | `StartExamResponse` | `get_current_user` | 201, 401, 403, 500 | `ExamSessionService` |
| `GET` | `/attempts/{attempt_id}/questions/bulk` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `GET` | `/attempts/{attempt_id}/questions/{question_number}` | `None` | `QuestionNavResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `POST` | `/attempts/{attempt_id}/responses` | `None` | `SaveResponseResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `POST` | `/attempts/{attempt_id}/responses/batch` | `None` | `BatchSaveResponseAck` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `GET` | `/attempts/{attempt_id}/responses/batch/{batch_id}` | `None` | `BatchStatusResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `POST` | `/attempts/{attempt_id}/reveal/{question_id}` | `None` | `RevealAnswerResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `POST` | `/attempts/{attempt_id}/heartbeat` | `None` | `HeartbeatResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `GET` | `/attempts/{attempt_id}/status` | `None` | `ExamStatusResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `POST` | `/attempts/{attempt_id}/submit` | `None` | `SubmitExamResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `invalidate_`, `ExamSessionService` |
| `GET` | `/attempts/{attempt_id}/result` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `ExamSessionService` |
| `POST` | `/attempts/sync-guest-sessions` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `ExamSessionService` |
| `GET` | `/attempts/student-dashboard-stats` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `ExamSessionService` |


### 10.3 Database Schemas & Persistence

##### Table: `exam_attempts`

**Read/Write Callers:** ExamSessionService, attempts router, post-submission engine

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `exam_id` | `INTEGER` | NO | `-` | FK -> `exams.id` | Foreign key linkage |
| `status` | `VARCHAR(11)` | NO | `AttemptStatus.IN_PROGRESS` | - | Standardized string enum |
| `mode` | `VARCHAR(8)` | NO | `AttemptMode.EXAM` | - | Standardized string enum |
| `total_score` | `FLOAT` | NO | `0.0` | - | - |
| `max_possible_score` | `FLOAT` | NO | `200.0` | - | - |
| `time_spent_seconds` | `FLOAT` | NO | `0.0` | - | - |
| `total_questions_attempted` | `INTEGER` | NO | `0` | - | - |
| `total_questions` | `INTEGER` | NO | `0` | - | - |
| `total_correct` | `INTEGER` | NO | `0` | - | - |
| `total_incorrect` | `INTEGER` | NO | `0` | - | - |
| `total_unattempted` | `INTEGER` | NO | `0` | - | - |
| `current_question_index` | `INTEGER` | NO | `1` | - | - |
| `max_duration_seconds` | `INTEGER` | NO | `7200` | - | - |
| `started_at` | `DATETIME` | NO | `<function ExamAttempt.<lambda> at 0x795132c18a90>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `submitted_at` | `DATETIME` | YES | `-` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `submission_reason` | `VARCHAR(100)` | YES | `-` | - | - |
| `pacing_status` | `VARCHAR(100)` | NO | `BALANCED_PACING` | - | - |
| `gti_score` | `FLOAT` | NO | `0.0` | - | - |
| `irt_theta` | `FLOAT` | NO | `0.0` | - | - |
| `percentile_rank` | `FLOAT` | NO | `50.0` | - | - |
| `oeei_score` | `FLOAT` | NO | `0.0` | - | - |
| `satoi_score` | `FLOAT` | NO | `100.0` | - | - |
| `icrs_score` | `FLOAT` | NO | `50.0` | - | - |
| `report_metadata_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `created_at` | `DATETIME` | NO | `<function ExamAttempt.<lambda> at 0x795132c189e0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_exam_attempts_user_id` | `user_id` | NO |
| `ix_exam_attempts_status` | `status` | NO |
| `ix_exam_attempts_user_created` | `user_id`, `created_at` | NO |
| `ix_exam_attempts_user_started` | `user_id`, `started_at` | NO |
| `ix_exam_attempts_exam_id` | `exam_id` | NO |
| `ix_exam_attempts_mode` | `mode` | NO |
| `ix_exam_attempts_user_exam` | `user_id`, `exam_id` | NO |
| `ix_exam_attempts_user_status` | `user_id`, `status` | NO |

##### Table: `exam_question_responses`

**Read/Write Callers:** ExamSessionService, attempts router, psychometric matrices

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `attempt_id` | `INTEGER` | NO | `-` | FK -> `exam_attempts.id` | Foreign key linkage |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `selected_option_id` | `INTEGER` | YES | `-` | FK -> `question_options.id` | Foreign key linkage |
| `initial_option_id` | `INTEGER` | YES | `-` | FK -> `question_options.id` | Foreign key linkage |
| `question_status` | `VARCHAR(19)` | NO | `QuestionResponseStatus.UNVISITED` | - | - |
| `is_marked_for_review` | `BOOLEAN` | NO | `False` | - | - |
| `option_switch_count` | `INTEGER` | NO | `0` | - | - |
| `visited_count` | `INTEGER` | NO | `0` | - | - |
| `answer_revealed` | `BOOLEAN` | NO | `False` | - | - |
| `is_correct` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `time_taken_seconds` | `FLOAT` | NO | `60.0` | - | - |
| `expected_time_seconds` | `FLOAT` | NO | `60.0` | - | - |
| `closeness_score_awarded` | `FLOAT` | NO | `0.0` | - | - |
| `final_score` | `FLOAT` | NO | `0.0` | - | - |
| `candidate_accuracy_pct` | `FLOAT` | YES | `-` | - | - |
| `is_switched` | `BOOLEAN` | NO | `False` | - | - |
| `gti_item_score` | `FLOAT` | NO | `0.0` | - | - |
| `created_at` | `DATETIME` | NO | `<function ExamQuestionResponse.<lambda> at 0x795132c19850>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_exam_question_responses_is_marked_for_review` | `is_marked_for_review` | NO |
| `ix_exam_question_responses_question_id` | `question_id` | NO |
| `ix_eq_responses_question` | `question_id` | NO |
| `ix_exam_question_responses_attempt_id` | `attempt_id` | NO |
| `ix_exam_question_responses_is_switched` | `is_switched` | NO |
| `ix_eq_responses_attempt_q` | `attempt_id`, `question_id` | YES |
| `ix_exam_question_responses_question_status` | `question_status` | NO |
| `ix_exam_question_responses_is_correct` | `is_correct` | NO |

##### Table: `question_switch_logs`

**Read/Write Callers:** ExamSessionService.save_response(), option switch regret matrix

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `response_id` | `INTEGER` | YES | `-` | FK -> `user_question_responses.id` | Foreign key linkage |
| `exam_response_id` | `INTEGER` | YES | `-` | FK -> `exam_question_responses.id` | Foreign key linkage |
| `from_option_id` | `INTEGER` | YES | `-` | FK -> `question_options.id` | Foreign key linkage |
| `to_option_id` | `INTEGER` | YES | `-` | FK -> `question_options.id` | Foreign key linkage |
| `timestamp_offset_sec` | `INTEGER` | NO | `0` | - | - |
| `created_at` | `DATETIME` | NO | `<function QuestionSwitchLog.<lambda> at 0x795132d7f320>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_question_switch_logs_exam_response_id` | `exam_response_id` | NO |
| `ix_question_switch_logs_response_id` | `response_id` | NO |
| `ix_switch_logs_response` | `response_id` | NO |

##### Table: `tests`

**Read/Write Callers:** Test management, custom mock generation

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `title` | `VARCHAR(200)` | NO | `-` | - | - |
| `test_type` | `VARCHAR(8)` | NO | `-` | - | - |
| `total_questions` | `INTEGER` | NO | `0` | - | - |
| `duration_minutes` | `INTEGER` | NO | `60` | - | - |
| `created_at` | `DATETIME` | NO | `<function Test.<lambda> at 0x795132d7c510>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_tests_type_created` | `test_type`, `created_at` | NO |
| `ix_tests_test_type` | `test_type` | NO |

##### Table: `test_questions`

**Read/Write Callers:** Test question linking, ordering and marks allocation

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `test_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `tests.id` | Foreign key linkage |
| `question_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `questions.id` | Foreign key linkage |
| `question_order` | `INTEGER` | NO | `1` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_test_q_order` | `test_id`, `question_order` | NO |
| `ix_test_questions_test_id` | `test_id` | NO |
| `ix_test_questions_question_id` | `question_id` | NO |

##### Table: `user_test_attempts`

**Read/Write Callers:** Custom test session tracking

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `test_id` | `INTEGER` | NO | `-` | FK -> `tests.id` | Foreign key linkage |
| `exam_attempt_id` | `INTEGER` | YES | `-` | FK -> `exam_attempts.id` | Foreign key linkage |
| `status` | `VARCHAR(11)` | NO | `AttemptStatus.IN_PROGRESS` | - | Standardized string enum |
| `mode` | `VARCHAR(8)` | NO | `AttemptMode.EXAM` | - | Standardized string enum |
| `score_raw` | `FLOAT` | YES | `-` | - | - |
| `score_time_adjusted` | `FLOAT` | YES | `-` | - | - |
| `guessing_tendency_index` | `FLOAT` | YES | `-` | - | - |
| `total_time_spent_sec` | `INTEGER` | NO | `0` | - | - |
| `started_at` | `DATETIME` | NO | `<function UserTestAttempt.<lambda> at 0x795132d7d7a0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `submitted_at` | `DATETIME` | YES | `-` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_attempts_test` | `test_id` | NO |
| `ix_user_test_attempts_exam_attempt_id` | `exam_attempt_id` | NO |
| `ix_user_test_attempts_mode` | `mode` | NO |
| `ix_user_test_attempts_status` | `status` | NO |
| `ix_user_test_attempts_test_id` | `test_id` | NO |
| `ix_attempts_user_status` | `user_id`, `status` | NO |
| `ix_user_test_attempts_user_id` | `user_id` | NO |

##### Table: `user_question_responses`

**Read/Write Callers:** Custom test telemetry sinks

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `attempt_id` | `INTEGER` | NO | `-` | FK -> `user_test_attempts.id` | Foreign key linkage |
| `exam_response_id` | `INTEGER` | YES | `-` | FK -> `exam_question_responses.id` | Foreign key linkage |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `selected_option_id` | `INTEGER` | YES | `-` | FK -> `question_options.id` | Foreign key linkage |
| `initial_selected_option_id` | `INTEGER` | YES | `-` | FK -> `question_options.id` | Foreign key linkage |
| `option_switch_count` | `INTEGER` | NO | `0` | - | - |
| `time_taken_seconds` | `INTEGER` | NO | `0` | - | - |
| `closeness_score_awarded` | `FLOAT` | YES | `-` | - | - |
| `final_score` | `FLOAT` | YES | `-` | - | - |
| `is_flagged_for_review` | `BOOLEAN` | NO | `False` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_responses_attempt_q` | `attempt_id`, `question_id` | YES |
| `ix_user_question_responses_question_id` | `question_id` | NO |
| `ix_user_question_responses_exam_response_id` | `exam_response_id` | NO |
| `ix_user_question_responses_attempt_id` | `attempt_id` | NO |
| `ix_user_question_responses_selected_option_id` | `selected_option_id` | NO |
| `ix_responses_question` | `question_id` | NO |


### 10.4 Existing Caching Usage
- Active Session Cache `ep:attempt:<attempt_id>:state` (TTL: 7200s): Caches remaining time, active question pointer, and proctoring counters in Redis.
- Question Palette Cache `ep:attempt:<attempt_id>:palette` (TTL: 7200s): Real-time bitmap or JSON map of answered/marked question numbers.
- Invalidation: `submit_exam()` immediately deletes session caches and flushes student dashboard aggregate keys.

### 10.5 Async / Background Processing
- `save_response()` dispatches non-blocking DB writes via connection pool while caching state in Redis.
- `submit_exam()` spawns `run_post_submission_pipeline` via `asyncio.create_task` or Celery task worker.

---

## Domain 11: Psychometrics & Analytics Engine (12 Cognitive Matrices)

### 11.1 Module Architecture & File Catalog

This domain represents the computational core of RankEdge. It evaluates candidate test attempts using a suite of 12 advanced psychometric and behavioral matrices. The post-submission pipeline runs in two phases:
- **Phase 1 (Deterministic Math, <2s):** Computes all 12 mathematical models, raw scores, percentile benchmarks, and persistence to `exam_attempt_reports` and `exam_question_reports`.
- **Phase 2 (Async AI Synthesis):** Leverages `ReportAISynthesizer` (via Gemini 2.5 Flash / OpenAI) to produce qualitative diagnostic insights, identify behavioral traps, and prescribe exactly 4 prioritized study tasks without recalculating any math.

#### Files & Classes:
- `app/routers/analytics.py`:
  - Exposes REST endpoints for fetching attempt reports in JSON, YAML, and Markdown formats, retrieving skill profiles, polling evaluation status, and retrying failed evaluations.
- `app/services/analytics_service.py`:
  - `AnalyticsService`:
    - `get_psychometric_report_json()`, `get_psychometric_report_yaml()`, `get_psychometric_report_markdown()`: Multi-format report serializers.
    - `get_attempt_question_report()`: Question-by-question diagnostic breakdown.
    - `get_attempt_exam_report()`: High-level exam scorecard and psychometric radar metrics.
    - `get_user_skill_profile()`: Aggregated longitudinal student mastery vector.
    - `get_attempt_evaluation_status()`: Status polling endpoint for UI transition (`PROCESSING` -> `COMPLETED`).
    - `retry_attempt_evaluation()`: Administrative or recovery trigger to re-run pipeline on failed attempts.
    - `get_user_cumulative_aggregate_report()`: Multi-exam historical performance aggregator.
    - `get_predicted_rank()`: Statistical rank predictor mapping candidate score and ability against benchmark population.
- `app/engine/post_submission_pipeline.py`:
  - `run_post_submission_pipeline()`: Master entry point orchestrating Phase 1 and Phase 2.
  - `_run_pipeline_core()`: Executes the 12 matrix strategies against candidate telemetry.
  - `load_exam_solutions_data()`: Loads answer keys, distractor metadata, and taxonomy links (cached in Redis).
- `app/engine/matrix_orchestrator.py`:
  - `MatrixOrchestrator`: Sequences matrix execution, merges intermediate score dictionaries, and computes normalized aggregate scores.
- `app/engine/report_ai_synthesizer.py`:
  - `ReportAISynthesizer`: Ingests Phase 1 mathematical vectors and prompts LLM to generate an 11-point diagnostic analysis and 4 concrete revision tasks. Enforces strict zero-math-recalculation guardrails.
  - `_generate_deterministic_fallback()`: Rule-based template fallback if LLM provider times out or fails schema validation.
- `app/engine/report_compiler.py`:
  - `compile_comprehensive_psychometric_report()`: Compiles final combined payload into standardized schema.
- `app/engine/cumulative_analytics_aggregator.py`:
  - `CumulativeAnalyticsAggregator`: Aggregates historical attempt metrics into longitudinal mastery graphs.

#### The 12 Psychometric Matrices (`app/engine/matrices/`):
1. `irt_3pl_ability.py` (`IRT3PLStrategy`):
   - 3-Parameter Logistic Item Response Theory model estimating candidate latent ability $\\theta$, item discrimination ($a$), difficulty ($b$), and guessing pseudo-chance ($c$).
2. `closeness_evaluator.py` (`ClosenessEvaluator`):
   - Categorizes candidate errors across 7 distractor tiers (e.g., conceptual near-miss, calculation slippage, formula confusion, trap option).
3. `guessing_tendency.py` (`GuessingTendencyStrategy`):
   - Calculates Guessing Tendency Index (GTI) based on rapid answering below baseline expected reading time.
4. `speed_accuracy_tradeoff.py` (`SATOIEngine`):
   - Measures Speed-Accuracy Trade-Off Index (SATOI), identifying questions rushed vs over-thought.
5. `option_elimination.py` (`OptionEliminationStrategy`):
   - Evaluates Option Elimination Efficiency (OEEI), scoring candidate's strategic elimination of distractors before selection.
6. `option_switch_regret.py` (`OptionSwitchRegretStrategy`):
   - Evaluates Option Switch Regret Index (OSRI), measuring score delta resulting from changing answers (beneficial vs harmful switches).
7. `macro_pacing.py` (`ExamMacroTimeStrategy`):
   - Evaluates exam-wide time allocation across exam sections, fatigue curves, and end-of-test time panic.
8. `time_tiered_scoring.py` (`TimeTieredScoringStrategy`):
   - Multi-tier scoring assigning bonus efficiency points for fast accurate answers and penalties for excessive time sink.
9. `blooms_mastery.py` (`BloomsMasteryStrategy`):
   - Maps accuracy and ability across Bloom's Taxonomy cognitive levels (Remember, Understand, Apply, Analyze, Evaluate, Create).
10. `fsrs_retention.py` (`FSRSEngine`):
    - Free Spaced Repetition Scheduler (FSRS-4.5) algorithm calculating memory stability ($S$) and retrievability ($R$) per concept.
11. `topic_fsrs_decay.py` (`TopicFSRSDecayEngine`):
    - Computes time-dependent memory decay curves across syllabus topics to schedule optimal spaced revision.
12. `integrated_cognitive_readiness.py` (`IntegratedCognitiveReadinessEngine`):
    - Synthesizes all 11 indices into a unified Integrated Cognitive Readiness Score (ICRS, 0-100) representing exam-day preparedness.

### 11.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/analytics/reports/attempts/{attempt_id}/status` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `POST` | `/analytics/reports/attempts/{attempt_id}/retry` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/attempts/{attempt_id}/questions` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/attempts/{attempt_id}/exam` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/attempts/{attempt_id}/user-delta` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/user/{user_id}/skill-profile` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/users/{user_id}/aggregate-report` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/users/{user_id}/aggregate-report/markdown` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/attempts/{attempt_id}/json` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/attempts/{attempt_id}/yaml` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/attempts/{attempt_id}/markdown` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `POST` | `/analytics/activity` | `None` | `StudyActivityOut` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/analytics/activity/today` | `None` | `list` | `get_current_user` | 200, 401, 403, 500 | `get_cache` |
| `GET` | `/analytics/predicted-rank` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `AnalyticsService` |
| `GET` | `/analytics/monthly-benchmark` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `AnalyticsService` |
| `GET` | `/analytics/subject-performance` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/user/{user_id}/exam/{exam_id}/json` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/user/{user_id}/exam/{exam_id}/yaml` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |
| `GET` | `/analytics/reports/user/{user_id}/exam/{exam_id}/markdown` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `AnalyticsService` |


### 11.3 Database Schemas & Persistence

##### Table: `exam_attempt_reports`

**Read/Write Callers:** AnalyticsService, post-submission pipeline, report serializers

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `attempt_id` | `INTEGER` | NO | `-` | FK -> `exam_attempts.id` | Foreign key linkage |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `exam_id` | `INTEGER` | NO | `-` | FK -> `exams.id` | Foreign key linkage |
| `matrices_summary_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `taxonomy_breakdown_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `llm_insight_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `full_report_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `s3_report_url` | `VARCHAR(500)` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function ExamAttemptReport.<lambda> at 0x795132cf1170>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_exam_attempt_reports_user_id` | `user_id` | NO |
| `ix_exam_attempt_reports_attempt_id` | `attempt_id` | YES |
| `ix_exam_attempt_reports_exam_id` | `exam_id` | NO |

##### Table: `exam_question_reports`

**Read/Write Callers:** AnalyticsService, post-submission pipeline, question analytics

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `attempt_id` | `INTEGER` | NO | `-` | FK -> `exam_attempts.id` | Foreign key linkage |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `question_number` | `INTEGER` | NO | `-` | - | - |
| `is_correct` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `final_score` | `FLOAT` | NO | `0.0` | - | - |
| `time_taken_seconds` | `FLOAT` | NO | `60.0` | - | - |
| `expected_time_seconds` | `FLOAT` | NO | `60.0` | - | - |
| `time_window` | `VARCHAR(50)` | NO | `OPTIMAL` | - | - |
| `closeness_score` | `FLOAT` | NO | `0.0` | - | - |
| `closeness_classification` | `VARCHAR(100)` | NO | `Neutral Distractor` | - | - |
| `gti_item_score` | `FLOAT` | NO | `0.0` | - | - |
| `is_option_switched` | `BOOLEAN` | NO | `False` | - | - |
| `blooms_level` | `VARCHAR(50)` | NO | `ANALYZE` | - | Standardized string enum |
| `explanation_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `created_at` | `DATETIME` | NO | `<function ExamQuestionReport.<lambda> at 0x795132cf0670>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_exam_question_reports_is_correct` | `is_correct` | NO |
| `ix_exam_question_reports_question_number` | `question_number` | NO |
| `ix_exam_question_reports_attempt_id` | `attempt_id` | NO |
| `ix_eq_reports_attempt_num` | `attempt_id`, `question_number` | NO |
| `ix_exam_question_reports_question_id` | `question_id` | NO |
| `ix_eq_reports_attempt_q` | `attempt_id`, `question_id` | YES |

##### Table: `user_skill_profiles`

**Read/Write Callers:** AnalyticsService, cumulative aggregator, mastery tracking

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `user_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `users.id` | Foreign key linkage |
| `cumulative_irt_theta` | `FLOAT` | NO | `0.0` | - | - |
| `cumulative_gti` | `FLOAT` | NO | `0.2` | - | - |
| `cumulative_oeei` | `FLOAT` | NO | `0.7` | - | - |
| `cumulative_icrs` | `FLOAT` | NO | `65.0` | - | - |
| `cumulative_satoi` | `FLOAT` | NO | `85.0` | - | - |
| `total_tests_given` | `INTEGER` | NO | `0` | - | - |
| `total_questions_answered` | `INTEGER` | NO | `0` | - | - |
| `aggregate_report_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `aggregate_markdown_audit` | `VARCHAR` | YES | `-` | - | - |
| `updated_at` | `DATETIME` | NO | `<function UserSkillProfile.<lambda> at 0x795132c1b270>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

##### Table: `user_taxonomy_mastery`

**Read/Write Callers:** AnalyticsService, FSRS engine, syllabus mastery

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `taxonomy_type` | `VARCHAR(50)` | NO | `-` | - | - |
| `taxonomy_id_code` | `VARCHAR(100)` | NO | `-` | - | - |
| `taxonomy_name` | `VARCHAR(200)` | NO | `-` | - | - |
| `total_attempts` | `INTEGER` | NO | `0` | - | - |
| `correct_attempts` | `INTEGER` | NO | `0` | - | - |
| `mastery_percentage` | `FLOAT` | NO | `0.0` | - | - |
| `strength_status` | `VARCHAR(50)` | NO | `MODERATE` | - | - |
| `updated_at` | `DATETIME` | NO | `<function UserTaxonomyMastery.<lambda> at 0x795132c1bb60>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_user_taxonomy_mastery_user_id` | `user_id` | NO |
| `ix_user_taxonomy_mastery_taxonomy_id_code` | `taxonomy_id_code` | NO |
| `ix_tax_mastery_user_code` | `user_id`, `taxonomy_type`, `taxonomy_id_code` | YES |
| `ix_user_taxonomy_mastery_taxonomy_type` | `taxonomy_type` | NO |

##### Table: `user_memory_states`

**Read/Write Callers:** FSRS memory engine, spaced repetition scheduler

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `question_id` | `INTEGER` | YES | `-` | FK -> `questions.id` | Foreign key linkage |
| `subtopic_id` | `INTEGER` | YES | `-` | FK -> `subtopics.id` | Foreign key linkage |
| `fsrs_difficulty` | `FLOAT` | NO | `5.0` | - | - |
| `fsrs_stability` | `FLOAT` | NO | `2.0` | - | - |
| `retrievability` | `FLOAT` | NO | `1.0` | - | - |
| `last_reviewed_at` | `DATETIME` | NO | `<function UserMemoryState.<lambda> at 0x795132c1a820>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `next_scheduled_review` | `DATETIME` | NO | `<function UserMemoryState.<lambda> at 0x795132c1a8d0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_memory_user_question` | `user_id`, `question_id` | YES |
| `ix_memory_next_review` | `user_id`, `next_scheduled_review` | NO |
| `ix_user_memory_states_user_id` | `user_id` | NO |
| `ix_user_memory_states_subtopic_id` | `subtopic_id` | NO |
| `ix_memory_user_subtopic` | `user_id`, `subtopic_id` | NO |
| `ix_user_memory_states_question_id` | `question_id` | NO |

##### Table: `user_concept_retention`

**Read/Write Callers:** FSRS topic decay engine, concept retention curve

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `subtopic_id` | `INTEGER` | NO | `-` | FK -> `subtopics.id` | Foreign key linkage |
| `fsrs_difficulty` | `FLOAT` | NO | `5.0` | - | - |
| `fsrs_stability` | `FLOAT` | NO | `1.0` | - | - |
| `fsrs_retrievability` | `FLOAT` | NO | `1.0` | - | - |
| `total_reviews` | `INTEGER` | NO | `1` | - | - |
| `lapses` | `INTEGER` | NO | `0` | - | - |
| `last_reviewed_at` | `DATETIME` | NO | `<function UserConceptRetention.<lambda> at 0x795132d7fcc0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `next_scheduled_review` | `DATETIME` | NO | `<function UserConceptRetention.<lambda> at 0x795132d7fd70>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_retention_user_subtopic` | `user_id`, `subtopic_id` | YES |
| `ix_user_concept_retention_subtopic_id` | `subtopic_id` | NO |
| `ix_retention_next_review` | `user_id`, `next_scheduled_review` | NO |
| `ix_user_concept_retention_user_id` | `user_id` | NO |
| `ix_user_concept_retention_next_scheduled_review` | `next_scheduled_review` | NO |

##### Table: `user_skill_progression_reports`

**Read/Write Callers:** Cumulative analytics aggregator, progression chart

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `attempt_id` | `INTEGER` | NO | `-` | FK -> `exam_attempts.id` | Foreign key linkage |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `previous_metrics_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `updated_metrics_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `deltas_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `taxonomy_promotions_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `spaced_repetition_schedule_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `created_at` | `DATETIME` | NO | `<function UserSkillProgressionReport.<lambda> at 0x795132cf1bc0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_user_skill_progression_reports_attempt_id` | `attempt_id` | NO |
| `ix_skill_prog_user_created` | `user_id`, `created_at` | NO |
| `ix_user_skill_progression_reports_user_id` | `user_id` | NO |


### 11.4 Existing Caching Usage
- `ep:analytics:attempt:<attempt_id>:report` (TTL: 86400s): Full psychometric report cached in Redis.
- `ep:analytics:attempt:<attempt_id>:status` (TTL: 30s): Polling cache for evaluation status.
- `ep:analytics:user:<user_id>:skill_profile` (TTL: 3600s): Student longitudinal skill profile cache.
- `ep:exam:<exam_id>:solutions_data` (TTL: 86400s): Pre-computed answer keys, distractor tiers, and taxonomy hierarchy for instant post-submission scoring.

### 11.5 Async / Background Processing
- Phase 2 LLM synthesis runs via background task or Celery worker `run_psychometric_ai_synthesis_task`.
- On completion, generates daily study tasks based on diagnosed weaknesses and updates user memory states.

---

## Domain 12: Study Planning, Gamification & Scheduler

### 12.1 Module Architecture & File Catalog

This domain drives student retention, spaced repetition schedules, daily study task generation, gamification streaks, XP progression, and badge unlocks. It includes a background midnight cron loop that recalculates memory decay curves, dispatches email digests, and creates personalized revision tasks.

- `app/routers/study_plan.py`:
  - `create_study_task()`, `update_study_task()`, `complete_study_task()`, `delete_study_task()`: Task CRUD endpoints.
  - `bulk_create_from_report()`: Converts post-submission diagnostic tasks into active study schedule items.
  - `generate_weekly_plan()`: Algorithmic weekly study planner balancing weak topics with upcoming exam targets.
  - `get_weekly_schedule()`, `get_weekly_insights()`: Calendar view and productivity trend telemetry.
  - `log_study_activity()`, `list_study_activities()`, `get_activity_summary()`: Study session tracker (pomodoro, note-taking, problem sets).
  - `list_badges()`: Unlocked and locked badge catalog.
  - `trigger_daily_digests()`, `trigger_midnight_translation()`: Admin triggers for scheduled background jobs.
- `app/services/daily_scheduler_service.py`:
  - `start_daily_midnight_scheduler()`: Initializes background task running every 24 hours at 00:00 UTC.
  - `run_daily_midnight_dispatch()`: Scans student base, calculates spaced repetition FSRS decay, and generates daily practice tasks.
  - `run_midnight_translation_job()`: Scans newly added questions and enqueues missing language translations.
  - `_calculate_seconds_until_midnight()`: Computes exact sleep duration until next midnight UTC.
- `app/services/gamification_service.py`:
  - `GamificationService`:
    - `check_and_update_daily_goal()`: Increments daily practice counters, checks streak continuity, and awards XP.
    - `_check_and_award_badges()`: Checks milestone conditions (e.g., "7-Day Streak", "Master of Mechanics", "500 Questions Solved") and inserts `UserBadge`.
- `app/db/models/study_plan.py` & `app/db/models/gamification.py`:
  - `StudyTask`: Actionable revision task (`PENDING`, `COMPLETED`, `SKIPPED`).
  - `StudyActivity`: Logged study session telemetry (duration, activity type, notes).
  - `Badge`, `UserBadge`: Gamification achievements catalog and candidate unlocks.
  - `XPLog`: Ledger of experience point gains (exam attempt, streak bonus, challenge victory).

### 12.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/study-plan/tasks/{task_id}/complete` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `get_cache`, `GamificationService` |
| `POST` | `/study-plan/tasks` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `PUT` | `/study-plan/tasks/{task_id}` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `DELETE` | `/study-plan/tasks/{task_id}` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `POST` | `/study-plan/tasks/bulk-from-report` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/study-plan/tasks/attempt/{attempt_id}/status` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `GET` | `/study-plan/tasks` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `POST` | `/study-plan/generate-weekly-plan` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/study-plan/weekly-schedule` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `get_cache` |
| `GET` | `/study-plan/weekly-insights` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `get_cache` |
| `POST` | `/study-plan/activities` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `GamificationService` |
| `GET` | `/study-plan/activities` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `DELETE` | `/study-plan/activities/{activity_id}` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `GET` | `/study-plan/activities/summary` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/study-plan/badges` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `get_cache` |
| `POST` | `/study-plan/send-pending-email` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `POST` | `/study-plan/trigger-daily-digests` | `None` | `Any` | Public (None) | 200, 500 | `Direct DB / Session` |
| `POST` | `/study-plan/trigger-midnight-translation` | `None` | `Any` | Public (None) | 200, 500 | `Direct DB / Session` |


### 12.3 Database Schemas & Persistence

##### Table: `study_tasks`

**Read/Write Callers:** DailySchedulerService, study_plan router, post-submission pipeline

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `title` | `VARCHAR(255)` | NO | `-` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `subject` | `VARCHAR` | YES | `-` | - | - |
| `topic` | `VARCHAR` | YES | `-` | - | - |
| `subtopic` | `VARCHAR` | YES | `-` | - | - |
| `priority` | `VARCHAR` | NO | `MEDIUM` | - | - |
| `allocated_time_minutes` | `INTEGER` | NO | `30` | - | - |
| `activity_type` | `VARCHAR` | NO | `CONCEPT_REVISION` | - | - |
| `scheduled_date` | `DATE` | NO | `<function StudyTask.<lambda> at 0x795132a2f8a0>` | - | - |
| `is_completed` | `BOOLEAN` | NO | `False` | - | - |
| `created_at` | `DATETIME` | NO | `<function StudyTask.<lambda> at 0x795132a2fb60>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `completed_at` | `DATETIME` | YES | `-` | - | - |
| `is_ai_recommended` | `BOOLEAN` | NO | `False` | - | - |
| `source_attempt_id` | `INTEGER` | YES | `-` | - | Foreign key linkage |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_study_tasks_subject` | `subject` | NO |
| `ix_study_tasks_scheduled_date` | `scheduled_date` | NO |
| `ix_study_tasks_user_id` | `user_id` | NO |
| `ix_study_tasks_source_attempt_id` | `source_attempt_id` | NO |
| `ix_study_tasks_user_completed` | `user_id`, `is_completed` | NO |
| `ix_study_tasks_user_scheduled` | `user_id`, `scheduled_date` | NO |

##### Table: `study_activities`

**Read/Write Callers:** study_plan router, activity tracker

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `date` | `DATE` | NO | `<function StudyActivity.<lambda> at 0x795132ac05c0>` | - | - |
| `activity_type` | `VARCHAR(15)` | NO | `-` | - | - |
| `activity_source` | `VARCHAR(9)` | NO | `ActivitySource.UNPLANNED` | - | - |
| `subject` | `VARCHAR` | YES | `-` | - | - |
| `topic` | `VARCHAR` | YES | `-` | - | - |
| `duration_minutes` | `INTEGER` | NO | `0` | - | - |
| `questions_attempted` | `INTEGER` | YES | `-` | - | - |
| `questions_correct` | `INTEGER` | YES | `-` | - | - |
| `score` | `FLOAT` | YES | `-` | - | - |
| `confidence_rating` | `INTEGER` | YES | `-` | - | - |
| `notes` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function StudyActivity.<lambda> at 0x795132ac0510>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_study_activities_user_id` | `user_id` | NO |
| `ix_study_activities_date` | `date` | NO |
| `ix_study_activities_user_date` | `user_id`, `date` | NO |

##### Table: `badges`

**Read/Write Callers:** GamificationService, seed_badges script, badge catalog

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `name` | `VARCHAR(255)` | NO | `-` | - | - |
| `description` | `VARCHAR` | NO | `-` | - | - |
| `icon_url` | `VARCHAR` | YES | `-` | - | - |
| `required_xp` | `INTEGER` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function Badge.<lambda> at 0x795132a2dd20>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

##### Table: `user_badges`

**Read/Write Callers:** GamificationService, badge awards

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `badge_id` | `INTEGER` | NO | `-` | FK -> `badges.id` | Foreign key linkage |
| `unlocked_at` | `DATETIME` | NO | `<function UserBadge.<lambda> at 0x795132a2e4b0>` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_user_badges_badge_id` | `badge_id` | NO |
| `ix_user_badges_user_id` | `user_id` | NO |

##### Table: `xp_logs`

**Read/Write Callers:** GamificationService, exam_session_service, challenge_service

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `amount` | `INTEGER` | NO | `-` | - | - |
| `source` | `VARCHAR(100)` | NO | `-` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function XPLog.<lambda> at 0x795132a2ee50>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_xp_logs_user_id` | `user_id` | NO |


### 12.4 Existing Caching Usage
- `ep:study:tasks:user:<user_id>:today` (TTL: 600s): Today's task list cache.
- `ep:gamification:user:<user_id>:streak` (TTL: 3600s): Current streak counter and streak freeze status.
- Invalidation: `complete_study_task()` invalidates user task lists and flushes student dashboard keys.

### 12.5 Async / Background Processing
- `daily_midnight_scheduler_loop`: Runs as an infinite `asyncio.sleep` task or Celery Beat periodic job.
- Task completion triggers asynchronous XP awards and badge milestone checks via `GamificationService`.

---

## Domain 13: Peer Challenges & Quota Limiting

### 13.1 Module Architecture & File Catalog

This domain enables peer-to-peer competitive learning, allowing students to create custom quiz duels or public group challenges across specific subjects, difficulty levels, and time limits. It enforces rate limits on challenge creation and tracks head-to-head live leaderboards.

- `app/routers/challenges.py`:
  - `create_challenge()`: Generates challenge room with sampled question sets and expiration deadlines.
  - `get_public_challenges()`: Lists joinable community challenges.
  - `get_challenge_detail()`: Retrieves challenge parameters and leaderboard preview.
  - `invite_user_to_challenge()`: Sends direct challenge invitation notification to another student.
  - `start_challenge_attempt()`: Initializes participant attempt session.
  - `save_challenge_response()`: Micro-telemetry sink saving participant answers.
  - `submit_challenge_attempt()`: Computes score, speed, and updates challenge standings.
  - `get_challenge_leaderboard()`: Real-time ranked participant standings.
- `app/services/challenge_service.py`:
  - `ChallengeService`:
    - `_sample_questions()`: Algorithmic question selector ensuring diverse difficulty and topic distribution.
    - `create_challenge()`: Enforces daily challenge quota limits, assigns join codes, and persists `Challenge`.
    - `invite_user()`: Validates target user and creates `ChallengeInvite`.
    - `start_attempt()`: Verifies challenge availability and creates `ChallengeAttempt`.
    - `save_response()`: Records question response and updates attempt score accumulator.
    - `submit_attempt()`: Finalizes attempt, locks answers, updates leaderboard ranks, and awards XP.
    - `get_leaderboard()`: Returns sorted participant ranking based on score (descending) and time taken (ascending).
- `app/db/models/challenge.py`:
  - `Challenge`: Challenge room entity (`WAITING`, `ACTIVE`, `COMPLETED`, `EXPIRED`).
  - `ChallengeQuestion`: Ordered list of questions linked to challenge.
  - `ChallengeInvite`: User invitations and acceptance status.
  - `ChallengeAttempt`: Participant attempt record.
  - `ChallengeResponse`: Telemetry for answers selected during challenge.

### 13.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/challenges` | `None` | `ChallengeSummary` | `require_challenge_quota` | 200, 401, 403, 500 | `ChallengeService` |
| `GET` | `/challenges` | `None` | `List` | `get_current_user` | 200, 401, 403, 500 | `ChallengeService` |
| `GET` | `/challenges/public/{share_token}` | `None` | `ChallengePublicPreview` | Public (None) | 200, 404, 500 | `ChallengeService` |
| `GET` | `/challenges/{challenge_id}` | `None` | `ChallengeSummary` | `get_current_user` | 200, 401, 403, 404, 500 | `ChallengeService` |
| `POST` | `/challenges/{challenge_id}/invite` | `None` | `Any` | `get_current_user` | 204, 401, 403, 404, 500 | `ChallengeService` |
| `GET` | `/challenges/{challenge_id}/leaderboard` | `None` | `List` | `get_current_user` | 200, 401, 403, 404, 500 | `ChallengeService` |
| `POST` | `/challenges/{id_or_token}/attempts/start` | `None` | `StartChallengeAttemptResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ChallengeService` |
| `POST` | `/challenges/attempts/{attempt_id}/responses` | `None` | `Any` | `get_current_user` | 204, 401, 403, 404, 500 | `ChallengeService` |
| `POST` | `/challenges/attempts/{attempt_id}/submit` | `None` | `SubmitChallengeAttemptResponse` | `get_current_user` | 200, 401, 403, 404, 500 | `ChallengeService` |


### 13.3 Database Schemas & Persistence

##### Table: `challenges`

**Read/Write Callers:** ChallengeService, challenges router

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `creator_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `title` | `VARCHAR(255)` | NO | `-` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `question_count` | `INTEGER` | NO | `10` | - | - |
| `difficulty` | `VARCHAR(6)` | YES | `-` | - | Standardized string enum |
| `subject_name` | `VARCHAR(200)` | YES | `-` | - | - |
| `time_limit_minutes` | `INTEGER` | NO | `15` | - | - |
| `visibility` | `VARCHAR(11)` | NO | `ChallengeVisibility.INVITE_ONLY` | - | Standardized string enum |
| `share_token` | `VARCHAR(64)` | NO | `-` | - | - |
| `status` | `VARCHAR(8)` | NO | `ChallengeStatus.ACTIVE` | - | Standardized string enum |
| `created_at` | `DATETIME` | NO | `<function Challenge.<lambda> at 0x7951329f0e00>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `expires_at` | `DATETIME` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_challenges_creator_status` | `creator_id`, `status` | NO |
| `ix_challenges_status` | `status` | NO |
| `ix_challenges_visibility` | `visibility` | NO |
| `ix_challenges_creator_id` | `creator_id` | NO |
| `ix_challenges_share_token` | `share_token` | YES |
| `ix_challenges_expires_at` | `expires_at` | NO |

##### Table: `challenge_questions`

**Read/Write Callers:** ChallengeService._sample_questions()

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `challenge_id` | `INTEGER` | NO | `-` | FK -> `challenges.id` | Foreign key linkage |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `order_index` | `INTEGER` | NO | `0` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_challenge_questions_challenge_id` | `challenge_id` | NO |
| `ix_challenge_questions_challenge_order` | `challenge_id`, `order_index` | YES |
| `ix_challenge_questions_question_id` | `question_id` | NO |

##### Table: `challenge_invites`

**Read/Write Callers:** ChallengeService.invite_user()

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `challenge_id` | `INTEGER` | NO | `-` | FK -> `challenges.id` | Foreign key linkage |
| `invited_user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `invited_by_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `status` | `VARCHAR(7)` | NO | `ChallengeInviteStatus.PENDING` | - | Standardized string enum |
| `created_at` | `DATETIME` | NO | `<function ChallengeInvite.<lambda> at 0x7951329f2560>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_challenge_invites_user` | `invited_user_id` | NO |
| `ix_challenge_invites_challenge_id` | `challenge_id` | NO |
| `ix_challenge_invites_challenge_user` | `challenge_id`, `invited_user_id` | YES |

##### Table: `challenge_attempts`

**Read/Write Callers:** ChallengeService.start_attempt(), submit_attempt()

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `challenge_id` | `INTEGER` | NO | `-` | FK -> `challenges.id` | Foreign key linkage |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `status` | `VARCHAR(11)` | NO | `ChallengeAttemptStatus.IN_PROGRESS` | - | Standardized string enum |
| `total_score` | `FLOAT` | NO | `0.0` | - | - |
| `total_correct` | `INTEGER` | NO | `0` | - | - |
| `total_incorrect` | `INTEGER` | NO | `0` | - | - |
| `total_unattempted` | `INTEGER` | NO | `0` | - | - |
| `time_spent_seconds` | `FLOAT` | NO | `0.0` | - | - |
| `started_at` | `DATETIME` | NO | `<function ChallengeAttempt.<lambda> at 0x7951329f3060>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `submitted_at` | `DATETIME` | YES | `-` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_challenge_attempts_status` | `status` | NO |
| `ix_challenge_attempts_challenge_id` | `challenge_id` | NO |
| `ix_challenge_attempts_user` | `user_id` | NO |
| `ix_challenge_attempts_challenge_user` | `challenge_id`, `user_id` | NO |

##### Table: `challenge_responses`

**Read/Write Callers:** ChallengeService.save_response()

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `attempt_id` | `INTEGER` | NO | `-` | FK -> `challenge_attempts.id` | Foreign key linkage |
| `question_id` | `INTEGER` | NO | `-` | FK -> `questions.id` | Foreign key linkage |
| `selected_option_id` | `INTEGER` | YES | `-` | FK -> `question_options.id` | Foreign key linkage |
| `is_correct` | `BOOLEAN` | NO | `False` | - | Boolean flag |
| `time_spent_seconds` | `FLOAT` | NO | `0.0` | - | - |
| `answered_at` | `DATETIME` | NO | `<function ChallengeResponse.<lambda> at 0x7951329f3c10>` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_challenge_responses_attempt_q` | `attempt_id`, `question_id` | YES |
| `ix_challenge_responses_question_id` | `question_id` | NO |
| `ix_challenge_responses_attempt_id` | `attempt_id` | NO |


### 13.4 Existing Caching Usage
- `ep:challenge:leaderboard:<challenge_id>` (TTL: 30s): High-frequency leaderboard cache during active challenge runs.
- `ep:challenge:quota:user:<user_id>:<date>` (TTL: 86400s): Redis counter tracking daily challenge creation limits.
- Invalidation: `submit_attempt()` clears the cached leaderboard to reflect updated scores.

### 13.5 Async / Background Processing
- Challenge invitations dispatch push and in-app notifications asynchronously via `NotificationService`.
- Background scheduler or Celery worker marks challenges as `EXPIRED` once deadline passes.

---

## Domain 14: Teacher Profiles & Review Rewards

### 14.1 Module Architecture & File Catalog

This domain manages specialized educator accounts, verifying credentials, tracking human-in-the-loop (HITL) question audit contributions, rewarding quality reviews with redeemable points, and handling payout redemption requests.

- `app/routers/teacher.py`:
  - `get_teacher_profile()`, `update_teacher_profile()`: Teacher profile and expertise management.
  - `get_review_points()`: Current available balance and historical point accruals.
  - `list_rewards()`: Catalog of available physical and digital redemption rewards.
  - `redeem_reward()`: Submits points redemption request.
  - `list_redemption_requests()`: Tracks payout/redemption status (`PENDING`, `APPROVED`, `DISPATCHED`, `REJECTED`).
  - `admin_approve_redemption()`: Administrative endpoint approving payout and debiting points.
- `app/services/teacher_reward_service.py`:
  - `TeacherRewardService`:
    - `grant_reward()`: Creates catalog reward tiers and allocates rewards to teachers.
    - `list_rewards_for_teacher()`: Filters eligible rewards based on accumulated points.
- `app/services/review_points_service.py`:
  - `ReviewPointsService`:
    - `award_for_review_action()`: Computes reward points for question approvals, corrections, and detailed explanation contributions.
    - `get_points_summary()`: Aggregates lifetime earned, redeemed, and current spendable points.
    - `get_teacher_leaderboard()`: Ranks educators by audit throughput and accuracy scores.
- `app/db/models/teacher.py`:
  - `TeacherProfile`: Educator bio, subject specializations, verification state, and institution affiliation.
  - `ReviewPointsLog`: Transactional points ledger tracking earnings from HITL reviews.
  - `TeacherReward`: Catalog of rewards (gift cards, books, cash payouts).
  - `RedemptionRequest`: Payout redemption requests and fulfillment tracking.

### 14.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/admin/teachers` | `None` | `List` | Public (None) | 200, 500 | `ReviewPointsService` |
| `GET` | `/admin/teachers/{teacher_id}/rewards` | `None` | `List` | Public (None) | 200, 404, 500 | `TeacherRewardService` |
| `POST` | `/admin/teachers/{teacher_id}/rewards` | `None` | `TeacherRewardOut` | Public (None) | 200, 404, 500 | `TeacherRewardService` |
| `GET` | `/teacher/points` | `None` | `TeacherPointsSummaryOut` | `role_checker` | 200, 401, 403, 500 | `ReviewPointsService` |
| `GET` | `/teacher/rewards` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `TeacherRewardService` |


### 14.3 Database Schemas & Persistence

##### Table: `teacher_profiles`

**Read/Write Callers:** TeacherService, review points service, teacher router

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `user_id` | `INTEGER` | NO | `-` | PRIMARY KEY, FK -> `users.id` | Foreign key linkage |
| `total_review_points` | `INTEGER` | NO | `0` | - | - |
| `reviews_completed_count` | `INTEGER` | NO | `0` | - | - |
| `created_at` | `DATETIME` | NO | `<function TeacherProfile.<lambda> at 0x795132958f60>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function TeacherProfile.<lambda> at 0x795132959010>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_teacher_profiles_user_id` | `user_id` | NO |

##### Table: `review_points_logs`

**Read/Write Callers:** ReviewPointsService, review_service HITL approval hook

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `review_task_id` | `INTEGER` | YES | `-` | FK -> `human_review_tasks.id` | Foreign key linkage |
| `question_id` | `INTEGER` | YES | `-` | FK -> `questions.id` | Foreign key linkage |
| `action` | `VARCHAR(20)` | NO | `-` | - | - |
| `points` | `INTEGER` | NO | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function ReviewPointsLog.<lambda> at 0x795132959850>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_review_points_logs_user_id` | `user_id` | NO |

##### Table: `teacher_rewards`

**Read/Write Callers:** TeacherRewardService, reward catalog

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `teacher_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `admin_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `title` | `VARCHAR(255)` | NO | `-` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `points_value` | `INTEGER` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function TeacherReward.<lambda> at 0x79513295a140>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_teacher_rewards_teacher_id` | `teacher_id` | NO |

##### Table: `redemption_requests`

**Read/Write Callers:** TeacherRewardService, teacher router, admin payouts

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `points_redeemed` | `INTEGER` | NO | `0` | - | - |
| `cash_amount` | `FLOAT` | NO | `0.0` | - | - |
| `payment_details` | `VARCHAR` | YES | `-` | - | - |
| `status` | `VARCHAR(8)` | NO | `RedemptionStatus.PENDING` | - | Standardized string enum |
| `processed_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `rejection_reason` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function RedemptionRequest.<lambda> at 0x79513295a980>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `processed_at` | `DATETIME` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_redemption_requests_status` | `status` | NO |
| `ix_redemption_requests_user_id` | `user_id` | NO |


### 14.4 Existing Caching Usage
- `ep:teacher:profile:<user_id>` (TTL: 3600s): Teacher metadata cache.
- `ep:teacher:leaderboard` (TTL: 600s): Top contributing educator leaderboard.
- Invalidation: HITL review approval invalidates teacher profile and point balance caches.

### 14.5 Async / Background Processing
- Payout request submissions notify administrators via `EmailService`.
- Point awards are logged asynchronously to prevent slowing down reviewer UI workflows.

---

## Domain 15: Notifications & Broadcast Announcements

### 15.1 Module Architecture & File Catalog

This domain provides an asynchronous notification engine delivering in-app alerts, transactional emails, and platform-wide broadcast announcements (e.g., scheduled maintenance, new exam releases, challenge invites, weekly progress reports). It supports targeted recipient cohorts, attachment uploads, rich markdown content, and delivery state tracking.

- `app/routers/notifications.py`:
  - `get_user_notifications()`: Fetches paginated user notifications with unread counts.
  - `get_published_notification_detail()`: Fetches specific public broadcast announcement.
  - `mark_notification_read()`: Marks single notification as read.
  - `mark_all_notifications_read()`: Bulk marks all active notifications as read.
- `app/routers/admin_notifications.py`:
  - `create_notification()`: Drafts new administrative broadcast.
  - `list_admin_notifications()`: Administrative listing across draft, published, and archived states.
  - `get_admin_notification_detail()`: Fetches administrative view with target audience metrics.
  - `update_notification()`: Edits announcement content and metadata.
  - `publish_notification()`: Transitions status to `PUBLISHED` and triggers fan-out delivery.
  - `reject_notification()`: Cancels or rejects pending announcement.
  - `delete_notification()`: Soft-deletes announcement.
  - `upload_notification_attachment()`: Handles PDF or banner attachment uploads.
- `app/services/notification_service.py`:
  - `NotificationService`: Dispatches in-app notifications, enqueues transactional emails via `EmailService`, and manages fan-out to active user cohorts.
- `app/services/email_service.py`:
  - `EmailService`: SMTP/SES email delivery engine with HTML templates for welcome emails, weekly scorecards, password resets, and digest updates.
- `app/db/models/notification.py`:
  - `Notification`: Individual recipient notification record (`UNREAD`, `READ`, `ARCHIVED`).
  - `BroadcastNotification`: Global announcement record with lifecycle status (`DRAFT`, `PUBLISHED`, `ARCHIVED`), target role filter, and banner assets.

### 15.2 API Endpoints

#### User Notification Endpoints
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/notifications` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/notifications/{notification_id}` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `POST` | `/notifications/{notification_id}/read` | `None` | `Any` | `get_current_user` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `POST` | `/notifications/mark-all-read` | `None` | `Any` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |


#### Administrative Broadcast Endpoints
| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/admin/notifications` | `None` | `NotificationResponse` | `role_checker` | 201, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/admin/notifications` | `None` | `NotificationListResponse` | `role_checker` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/admin/notifications/{notification_id}` | `None` | `NotificationResponse` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `PUT` | `/admin/notifications/{notification_id}` | `None` | `NotificationResponse` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `PATCH` | `/admin/notifications/{notification_id}/publish` | `None` | `NotificationResponse` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `PATCH` | `/admin/notifications/{notification_id}/reject` | `None` | `NotificationResponse` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `DELETE` | `/admin/notifications/{notification_id}` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `POST` | `/admin/notifications/upload` | `None` | `Any` | `role_checker` | 200, 401, 403, 500 | `Direct DB / Session` |


### 15.3 Database Schemas & Persistence

##### Table: `notifications`

**Read/Write Callers:** NotificationService, notifications router

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `title` | `VARCHAR(255)` | NO | `-` | - | - |
| `message` | `VARCHAR` | NO | `-` | - | - |
| `notification_type` | `VARCHAR(50)` | NO | `GENERAL` | - | - |
| `action_url` | `VARCHAR(255)` | YES | `-` | - | - |
| `is_read` | `BOOLEAN` | NO | `False` | - | - |
| `created_at` | `DATETIME` | NO | `<function UserNotification.<lambda> at 0x795132ac1dd0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_notifications_is_read` | `is_read` | NO |
| `ix_notifications_user_id` | `user_id` | NO |

##### Table: `broadcast_notifications`

**Read/Write Callers:** admin_notifications router, NotificationService fan-out

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `title` | `VARCHAR(255)` | NO | `-` | - | - |
| `description` | `TEXT` | YES | `-` | - | - |
| `content_type` | `VARCHAR(50)` | NO | `other` | - | - |
| `link` | `VARCHAR(1000)` | YES | `-` | - | - |
| `attachment` | `VARCHAR(1000)` | YES | `-` | - | - |
| `status` | `VARCHAR(50)` | NO | `draft` | - | Standardized string enum |
| `created_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `created_at` | `DATETIME` | NO | `<function Notification.<lambda> at 0x795132ac12d0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function Notification.<lambda> at 0x795132ac1380>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `published_at` | `DATETIME` | YES | `-` | - | - |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_broadcast_notifications_status` | `status` | NO |
| `ix_broadcast_notifications_created_at` | `created_at` | NO |
| `ix_broadcast_notifications_published_at` | `published_at` | NO |
| `ix_broadcast_notifications_created_by_id` | `created_by_id` | NO |


### 15.4 Existing Caching Usage
- `ep:notifications:unread:user:<user_id>` (TTL: 300s): Real-time unread counter cache for UI bell icon.
- `ep:broadcasts:active` (TTL: 1800s): List of active global announcement banners.
- Invalidation: `mark_notification_read()` and `mark_all_notifications_read()` immediately clear the unread counter key.

### 15.5 Async / Background Processing
- Announcement publishing triggers asynchronous fan-out worker to generate individual `Notification` rows for targeted cohorts.
- Transactional emails are dispatched through Celery background tasks (`send_email_task`).

---

## Domain 16: Testimonials Moderation

### 16.1 Module Architecture & File Catalog

This domain manages candidate success stories, ranker reviews, and student endorsements. It provides a public submission flow, administrative review queue with approval/rejection workflows, rating moderation, and public display serialization.

- `app/routers/testimonials.py`:
  - `get_approved_testimonials()`: Public endpoint returning verified 5-star testimonials for landing page.
  - `submit_testimonial()`: Authenticated student submission endpoint.
  - `list_all_testimonials_for_admin()`: Admin review dashboard showing all submissions (`PENDING`, `APPROVED`, `REJECTED`).
  - `approve_testimonial()`: Admin action approving submission for public display.
  - `reject_testimonial()`: Admin action rejecting submission with reason notes.
  - `delete_testimonial()`: Admin action removing testimonial.
  - `TestimonialCreatePayload`, `TestimonialRejectPayload`, `TestimonialOut`: Schema payloads.
- `app/db/models/testimonial.py`:
  - `Testimonial`: Entity tracking user ID, exam type, rating (1-5), content, approval status, reviewer notes, and publication timestamp.

### 16.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/testimonials/approved` | `None` | `List` | Public (None) | 200, 500 | `Direct DB / Session` |
| `POST` | `/testimonials` | `None` | `TestimonialOut` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/testimonials/admin/all` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `Direct DB / Session` |
| `POST` | `/testimonials/admin/{testimonial_id}/approve` | `None` | `TestimonialOut` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `POST` | `/testimonials/admin/{testimonial_id}/reject` | `None` | `TestimonialOut` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `DELETE` | `/testimonials/admin/{testimonial_id}` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |


### 16.3 Database Schemas & Persistence

##### Table: `testimonials`

**Read/Write Callers:** testimonials router, student submissions, admin moderation

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `user_name` | `VARCHAR` | NO | `-` | - | - |
| `user_exam` | `VARCHAR` | NO | `-` | - | - |
| `user_photo` | `VARCHAR` | YES | `-` | - | - |
| `rating` | `INTEGER` | NO | `5` | - | - |
| `quote` | `VARCHAR` | NO | `-` | - | - |
| `status` | `VARCHAR(8)` | NO | `TestimonialStatus.PENDING` | - | Standardized string enum |
| `rejection_reason` | `VARCHAR` | YES | `-` | - | - |
| `created_at` | `DATETIME` | NO | `<function Testimonial.<lambda> at 0x79513295b480>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function Testimonial.<lambda> at 0x79513295b3d0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_testimonials_user_id` | `user_id` | NO |


### 16.4 Existing Caching Usage
- `ep:testimonials:approved:list` (TTL: 86400s): Public landing page testimonial cache.
- Invalidation: `approve_testimonial()` and `reject_testimonial()` invalidate `ep:testimonials:approved:list`.

### 16.5 Async / Background Processing
- Testimonial approval dispatches a notification to the student thanking them for their feedback.

---

## Domain 17: Current Affairs

### 17.1 Module Architecture & File Catalog

This domain provides a daily and weekly news compilation service tailored for civil services and government competitive exams (UPSC, SSC, State PCS). It organizes current events by category (National, International, Economy, Science & Tech, Environment), dates, and syllabus links.

- `app/routers/current_affairs.py`:
  - `create_current_affair()`: Admin endpoint publishing news summary with tags and importance level.
  - `list_current_affairs()`: Public paginated listing with date range, category, and keyword filters.
  - `get_current_affair()`: Fetches individual news article with related question recommendations.
  - `update_current_affair()`, `delete_current_affair()`: Admin modification endpoints.
  - `CurrentAffairCreate`, `CurrentAffairRead`: Pydantic transfer schemas.
- `app/db/models/current_affairs.py`:
  - `CurrentAffair`: Database model storing date, title, content, bullet points, tags, exam relevance, and source URLs.

### 17.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/current-affairs/` | `None` | `CurrentAffairRead` | `role_checker` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/current-affairs/` | `None` | `List` | `get_current_user` | 200, 401, 403, 500 | `Direct DB / Session` |
| `GET` | `/current-affairs/{id}` | `None` | `CurrentAffairRead` | `get_current_user` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `PUT` | `/current-affairs/{id}` | `None` | `CurrentAffairRead` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `DELETE` | `/current-affairs/{id}` | `None` | `dict` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |


### 17.3 Database Schemas & Persistence

##### Table: `current_affairs`

**Read/Write Callers:** current_affairs router, admin editors, student study flows

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `title` | `VARCHAR(255)` | NO | `-` | - | - |
| `content` | `VARCHAR` | NO | `-` | - | - |
| `topic` | `VARCHAR` | YES | `-` | - | - |
| `subtopic` | `VARCHAR` | YES | `-` | - | - |
| `date` | `DATE` | NO | `<function CurrentAffair.<lambda> at 0x7951329f00f0>` | - | - |
| `is_published` | `BOOLEAN` | NO | `True` | - | - |
| `created_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |
| `created_at` | `DATETIME` | NO | `<function CurrentAffair.<lambda> at 0x7951329f01a0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function CurrentAffair.<lambda> at 0x7951329f03b0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_current_affairs_is_published` | `is_published` | NO |
| `ix_current_affairs_subtopic` | `subtopic` | NO |
| `ix_current_affairs_date` | `date` | NO |
| `ix_current_affairs_topic` | `topic` | NO |


### 17.4 Existing Caching Usage
- `ep:current_affairs:feed:<category>:<date>` (TTL: 3600s): Daily feed query cache.
- Invalidation: New article creation or updates invalidate affected date and category feed keys.

### 17.5 Async / Background Processing
- Automatic translation of published current affairs articles into scheduled regional languages is dispatched asynchronously.

---

## Domain 18: Site Settings & Dynamic Theming

### 18.1 Module Architecture & File Catalog

This domain manages runtime configuration parameters, brand themes, dynamic feature toggles, maintenance window banners, and global platform metadata without requiring code redeployment.

- `app/routers/site_settings.py`:
  - `get_active_theme()`: Public endpoint returning active CSS theme tokens, color palettes, logo URLs, and typography configurations.
  - `update_active_theme()`: Superadmin endpoint updating platform appearance tokens.
- `app/services/site_settings_service.py`:
  - `SiteSettingsService`:
    - `_ensure_table_exists()`: Idempotent initialization checking table readiness.
    - `get_theme()`: Retrieves theme configuration with fallback to default dark/light theme dictionary.
    - `set_theme()`: Validates and persists JSON theme configuration.
- `app/db/models/site_settings.py`:
  - `SiteSetting`: Key-value configuration entity storing dialect-agnostic JSON values (`PortableJSON`).

### 18.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/site-settings/theme` | `None` | `ThemeOut` | Public (None) | 200, 500 | `SiteSettingsService` |
| `PUT` | `/site-settings/theme` | `None` | `ThemeOut` | `role_checker` | 200, 401, 403, 500 | `SiteSettingsService` |


### 18.3 Database Schemas & Persistence

##### Table: `site_settings`

**Read/Write Callers:** SiteSettingsService, site_settings router

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `1` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `theme_name` | `VARCHAR(50)` | NO | `crimson` | - | - |
| `updated_at` | `DATETIME` | NO | `<function SiteSettings.<lambda> at 0x795132894510>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_by_id` | `INTEGER` | YES | `-` | FK -> `users.id` | Foreign key linkage |


### 18.4 Existing Caching Usage
- `ep:settings:theme:active` (TTL: 86400s): Active UI theme token cache.
- Invalidation: `SiteSettingsService.set_theme()` flushes `ep:settings:theme:active`.

### 18.5 Async / Background Processing
- None. Theme mutations are synchronous and write directly to the database and Redis cache.

---

## Domain 19: Monetization, Feature Flags & Subscription Management

### 19.1 Module Architecture & File Catalog

This domain defines the database foundation and entitlement models for tiered subscription plans, platform feature gates, and student billing records. While user-facing checkout flows are prepared for Razorpay/Stripe webhook integration, the backend models enforce role- and tier-based feature enablement.

- `app/db/models/subscription.py`:
  - `PlatformFeature`: Registry of gateable capabilities (e.g., `MOCK_GENERATOR`, `AI_TUTOR`, `DETAILED_PSYCHOMETRICS`, `UNLIMITED_CHALLENGES`).
  - `SubscriptionPlan`: Tier definition (`FREE`, `PRO_MONTHLY`, `PRO_ANNUAL`, `LIFETIME`) with pricing and currency metadata.
  - `PlanFeatureLink`: Many-to-many relationship mapping features and optional usage limits to subscription tiers.
  - `UserSubscription`: Active student subscriptions with status lifecycle (`ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`), auto-renewal flags, and period bounds.
  - `BillingInterval`, `SubscriptionStatus`: Standard domain enums.

### 19.2 API Endpoints

*Architectural Note: Subscription checkout and plan management endpoints are currently in transition to unified payment webhook ingress (`/api/v1/webhooks`). Direct CRUD endpoints for plan creation are currently restricted to administrative migration scripts.*

### 19.3 Database Schemas & Persistence

##### Table: `platform_features`

**Read/Write Callers:** Feature gating middleware, subscription service

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `feature_code` | `VARCHAR(100)` | NO | `-` | - | - |
| `name` | `VARCHAR(200)` | NO | `-` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `is_active` | `BOOLEAN` | NO | `True` | - | Boolean flag |
| `created_at` | `DATETIME` | NO | `<function PlatformFeature.<lambda> at 0x795132cf33d0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_platform_features_feature_code` | `feature_code` | NO |
| `ix_platform_features_code` | `feature_code` | YES |
| `ix_platform_features_is_active` | `is_active` | NO |

##### Table: `subscription_plans`

**Read/Write Callers:** Billing service, feature gating

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `plan_code` | `VARCHAR(100)` | NO | `-` | - | - |
| `name` | `VARCHAR(200)` | NO | `-` | - | - |
| `description` | `VARCHAR` | YES | `-` | - | - |
| `price_cents` | `INTEGER` | NO | `0` | - | - |
| `currency` | `VARCHAR(10)` | NO | `INR` | - | - |
| `billing_interval` | `VARCHAR(8)` | NO | `BillingInterval.MONTHLY` | - | - |
| `display_order` | `INTEGER` | NO | `0` | - | - |
| `is_active` | `BOOLEAN` | NO | `True` | - | Boolean flag |
| `metadata_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |
| `created_at` | `DATETIME` | NO | `<function SubscriptionPlan.<lambda> at 0x795132cf3e20>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_subscription_plans_active_display` | `is_active`, `display_order` | NO |
| `ix_subscription_plans_plan_code` | `plan_code` | NO |
| `ix_subscription_plans_billing_interval` | `billing_interval` | NO |
| `ix_subscription_plans_code` | `plan_code` | YES |
| `ix_subscription_plans_is_active` | `is_active` | NO |

##### Table: `plan_feature_links`

**Read/Write Callers:** Feature entitlement checks

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `plan_id` | `INTEGER` | NO | `-` | FK -> `subscription_plans.id` | Foreign key linkage |
| `feature_id` | `INTEGER` | NO | `-` | FK -> `platform_features.id` | Foreign key linkage |
| `usage_limit` | `INTEGER` | YES | `-` | - | - |
| `config_json` | `JSON` | YES | `-` | - | Dialect-aware JSON (`JSONB` on Postgres, `JSON` on SQLite) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_plan_feature_unique` | `plan_id`, `feature_id` | YES |
| `ix_plan_feature_links_feature_id` | `feature_id` | NO |
| `ix_plan_feature_links_plan_id` | `plan_id` | NO |

##### Table: `user_subscriptions`

**Read/Write Callers:** User billing lifecycle, entitlement verification

| Column Name | Data Type | Nullable | Default Value | Constraints | Architectural Notes |
|-------------|-----------|----------|---------------|-------------|---------------------|
| `id` | `BIGINT` | NO | `-` | PRIMARY KEY | Unique 64-bit integer identifier (`BigIntPK`) |
| `user_id` | `INTEGER` | NO | `-` | FK -> `users.id` | Foreign key linkage |
| `plan_id` | `INTEGER` | NO | `-` | FK -> `subscription_plans.id` | Foreign key linkage |
| `status` | `VARCHAR(8)` | NO | `SubscriptionStatus.ACTIVE` | - | Standardized string enum |
| `current_period_start` | `DATETIME` | NO | `<function UserSubscription.<lambda> at 0x795132b914e0>` | - | - |
| `current_period_end` | `DATETIME` | NO | `-` | - | - |
| `cancel_at_period_end` | `BOOLEAN` | NO | `False` | - | - |
| `payment_gateway` | `VARCHAR(50)` | YES | `RAZORPAY` | - | - |
| `gateway_subscription_id` | `VARCHAR` | YES | `-` | - | Foreign key linkage |
| `created_at` | `DATETIME` | NO | `<function UserSubscription.<lambda> at 0x795132b919b0>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |
| `updated_at` | `DATETIME` | NO | `<function UserSubscription.<lambda> at 0x795132b91590>` | - | Timezone-aware timestamp (`TIMESTAMPTZ` / `DateTimeTZ`) |

**Indexes:**

| Index Name | Columns | Unique |
|------------|---------|--------|
| `ix_user_subs_period_end` | `current_period_end` | NO |
| `ix_user_subscriptions_current_period_end` | `current_period_end` | NO |
| `ix_user_subscriptions_plan_id` | `plan_id` | NO |
| `ix_user_subscriptions_user_id` | `user_id` | NO |
| `ix_user_subs_user_status` | `user_id`, `status` | NO |
| `ix_user_subscriptions_status` | `status` | NO |
| `ix_user_subscriptions_gateway_subscription_id` | `gateway_subscription_id` | NO |


### 19.4 Existing Caching Usage
- `ep:user:<user_id>:entitlements` (TTL: 3600s): Cached list of active feature codes granted to candidate.
- Invalidation: Subscription renewal or cancellation webhooks invalidate user entitlement cache.

### 19.5 Async / Background Processing
- Nightly cron scans `user_subscriptions` for expired periods and updates status to `EXPIRED`.

---

## Domain 20: Global Search

### 20.1 Module Architecture & File Catalog

This domain provides a centralized full-text and faceted search engine across exams, question stems, subjects, syllabus topics, and current affairs. It integrates with PostgreSQL trigram/tsvector indexing with fallback to in-memory substring matching.

- `app/routers/search.py`:
  - `global_search()`: Universal query endpoint supporting category filters (`exams`, `questions`, `topics`, `news`), pagination, and relevance ranking.
- `app/services/search_service.py` (or repository search methods):
  - Executes multi-entity search queries with similarity scoring and search result categorization.

### 20.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/search/` | `None` | `Dict` | Public (None) | 200, 500 | `Direct DB / Session` |
| `GET` | `/search` | `None` | `Dict` | Public (None) | 200, 500 | `Direct DB / Session` |


### 20.3 Database Schemas & Persistence
- Reads across: `exams`, `questions`, `subjects`, `topics`, `current_affairs`.
- Utilizes composite B-tree and text search indexes on `stem`, `title`, and `name` columns.

### 20.4 Existing Caching Usage
- `ep:search:<hash_query_params>` (TTL: 300s): Caches top search results for common query terms.

### 20.5 Async / Background Processing
- None. Search queries are read-only and synchronous.

---

## Domain 21: Storage Abstraction Layer (S3 / Local)

### 21.1 Module Architecture & File Catalog

This domain isolates file system interactions behind a unified asynchronous interface, allowing seamless switching between local disk storage (development) and AWS S3 / MinIO object storage (staging and production).

- `app/storage/base.py`:
  - `BaseStorageProvider`: Abstract interface declaring:
    - `upload_file(file_path, destination)`: Uploads raw binary or file stream.
    - `download_file(destination, local_path)`: Downloads object to local disk.
    - `save_image(image_bytes, destination)`: Stores cropped question diagrams.
    - `get_public_url(destination)`: Resolves public CDN or direct URL.
    - `exists(destination)`: Verifies object existence.
    - `upload_json(data, destination)`, `download_json(destination)`: Direct JSON serialization.
    - `generate_presigned_url(destination, expiry)`: Creates temporary secure download/upload links.
    - `delete_file(destination)`: Removes object.
- `app/storage/factory.py`:
  - `get_storage_provider()`: Factory returning `S3StorageProvider` if `STORAGE_BACKEND == "s3"` or `LocalStorageProvider` otherwise.
- `app/storage/s3.py`:
  - `S3StorageProvider`: Implementation using `aiobotocore` / `boto3` client.
  - `_ensure_bucket_exists()`: Validates target bucket or creates it during startup in local MinIO environments.
- `app/storage/local.py`:
  - `LocalStorageProvider`: Local filesystem implementation storing files under `UPLOAD_DIR`.
  - `_resolve_path()`: Prevents directory traversal attacks by validating destination bounds.
- `app/services/s3_service.py`:
  - Domain service wrapper for legacy S3 calls, presigned URL generation, and artifact synchronization.

### 21.2 API Endpoints
*Storage operations are invoked internally by pipeline, review, question, and admin modules.*

### 21.3 Database Schemas & Persistence
- Storage paths and asset URLs are persisted in `question_assets`, `pipeline_runs`, and `exams`.

### 21.4 Existing Caching Usage
- Presigned URLs are generated with configurable TTL (default: 3600s).

### 21.5 Async / Background Processing
- Image uploads during document OCR cropping run asynchronously via threadpool or async I/O.

---

## Domain 22: Multi-Tier Caching Layer

### 22.1 Module Architecture & File Catalog

This domain implements a fault-tolerant multi-tier caching architecture. If Redis experiences downtime, network partitions, or connection timeouts, the system automatically falls back to an in-memory LRU cache (`InMemoryCache`) without dropping user requests.

- `app/cache/base.py`:
  - `BaseCache`: Abstract class declaring `get`, `set`, `delete`, `delete_pattern`, `exists`, `clear`, and `health_check`.
- `app/cache/decorator.py`:
  - `@cached(key_builder, ttl, condition)`: Declarative function decorator with automatic parameter inspection, namespace isolation, and exception suppression.
- `app/cache/factory.py`:
  - `get_cache()`: Singleton factory returning `FallbackCache(L1=InMemoryCache, L2=RedisCache)`.
  - `reset_cache_client()`: Reconnect hook invoked during test teardown or worker fork.
- `app/cache/fallback_cache.py`:
  - `FallbackCache`: Dual-layer wrapper querying L1 (Memory) first, L2 (Redis) second; writes to both; gracefully handles L2 disconnects.
- `app/cache/redis_cache.py`:
  - `RedisCache`: Async Redis client using `redis-py` connection pools with retry logic.
  - `CacheJSONEncoder`: Handles datetime and Pydantic model serialization.
- `app/cache/memory_cache.py`:
  - `InMemoryCache`: Thread-safe in-memory cache with LRU eviction and timestamp-based TTL pruning.
- `app/cache/noop_cache.py`:
  - `NoOpCache`: Passthrough mock cache for test isolation.
- `app/cache/helpers.py`:
  - Key generation utilities (`ep:exam:<id>`, `ep:user:<id>:profile`, `ep:questions:detail:<id>`).

### 22.2 API Endpoints
*Internal cache layer; health checked via `/api/v1/admin/diagnostics`.*

### 22.3 Database Schemas & Persistence
*Transient in-memory and Redis storage.*

### 22.4 Existing Caching Usage
- Comprehensive key pattern catalog documented in Part A, Section 7.

### 22.5 Async / Background Processing
- Expired memory cache pruning runs periodically in background threads.

---

## Domain 23: LLM Provider Abstraction Layer

### 23.1 Module Architecture & File Catalog

This domain encapsulates generative AI model interactions behind vendor-agnostic abstractions, supporting Google Vertex AI / Gemini 2.5 Flash and OpenAI GPT-4o with token rate limiting, fallback retries, and structured JSON output parsing.

- `app/llm/providers/base.py`:
  - `BaseLLMProvider`: Abstract provider declaring `get_chat_model()`.
- `app/llm/providers/gemini.py`:
  - `GeminiProvider`: Google GenAI / Vertex AI integration using `langchain-google-genai` or native client.
- `app/llm/providers/openai.py`:
  - `OpenAIProvider`: OpenAI client integration using `langchain-openai`.
- `app/llm/factory.py`:
  - `get_vision_llm()`: Factory returning multimodal vision-capable LLM for diagram extraction and review auditing.
  - `get_rate_limiter()`: Token-bucket rate limiter preventing API quota exhaustion.
- `app/schemas/report_llm_schemas.py`:
  - Pydantic models enforcing strict JSON output schemas for post-submission AI synthesis (`DiagnosticAnalysisResult`, `PrescribedStudyTask`).

### 23.2 API Endpoints
*Internal service layer invoked by pipeline validator and post-submission engine.*

### 23.3 Database Schemas & Persistence
- LLM outputs are persisted in `exam_attempt_reports` (`diagnostic_insight_json`, `recommendations_json`).

### 23.4 Existing Caching Usage
- `ep:llm:cache:<prompt_hash>`: Semantic prompt-response cache for identical diagnostic inputs.

### 23.5 Async / Background Processing
- All LLM calls execute asynchronously in background tasks or Celery workers.

---

## Domain 24: Multi-Language Translation (22 Scheduled Indian Languages)

### 24.1 Module Architecture & File Catalog

This domain powers RankEdge's multilingual exam experience, translating question stems, options, explanations, and passages across all 22 Eighth Schedule Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese, Urdu, Sanskrit, etc.).

- `app/core/languages.py`:
  - `SUPPORTED_LANGUAGES`: Registry of language codes (ISO 639-1 / 639-2), native display names, and script directions.
  - `validate_language_code()`: Enforces valid language codes.
- `app/services/translation_service.py`:
  - `TranslationService`: High-level translation coordinator with translation memory database lookup before calling external APIs.
- `app/services/google_translation_service.py`:
  - `GoogleTranslationService`: Batch translation client calling Google Cloud Translation Advanced API with glossary support for technical exam terms.
- `app/tasks/translation_tasks.py`:
  - `translate_exam_questions_task()`: Celery background worker translating an entire exam paper across target languages.
  - `async_translate_exam()`: Asyncio fallback translation worker.
  - `reconcile_missing_translations_task()`: Maintenance task scanning for missing translations and queueing backfill jobs.

### 24.2 API Endpoints
*Admin translation triggers exposed in Domain 27 (`/api/v1/admin/exams/{id}/translate`).*

### 24.3 Database Schemas & Persistence
- Persists to: `question_translations`, `option_translations`, `passage_translations`.

### 24.4 Existing Caching Usage
- `ep:trans:<lang>:<text_hash>`: Translation memory cache (TTL: 2592000s / 30 days).

### 24.5 Async / Background Processing
- Translation jobs run strictly in background workers due to high latency of batch translation APIs.

---

## Domain 25: Asynchronous Task Workers & Celery Queue

### 25.1 Module Architecture & File Catalog

This domain provides distributed asynchronous job execution via Celery, backed by Redis as both message broker and result backend. It includes automatic fallback to in-process `asyncio.create_task` if no Celery workers are active.

- `app/tasks/celery_app.py`:
  - Celery instance configuration, task routing (`celery` default queue, `translation` queue, `heavy_pipeline` queue), serializer settings, and worker heartbeat monitors.
  - `has_active_celery_workers()`: Dynamic inspect helper checking worker pool health.
- `app/tasks/exam_tasks.py`:
  - `process_exam_pdf_task()`: Celery worker for heavy PDF parsing and OCR extraction.
  - `async_process_exam_pdf()`: Asyncio in-process fallback task.
- `app/tasks/translation_tasks.py`:
  - `translate_exam_questions_task()`: Distributed translation task.
  - `reconcile_missing_translations_task()`: Nightly translation integrity reconcile job.
- `app/tasks/sync_tasks.py`:
  - Background artifact syncing to S3 and CDN invalidations.

### 25.2 API Endpoints
*Internal execution fabric.*

### 25.3 Database Schemas & Persistence
- Celery task IDs and execution metrics are logged in `pipeline_runs`.

### 25.4 Existing Caching Usage
- Redis serves as the message transport queue (`redis://localhost:6379/1`).

### 25.5 Async / Background Processing
- Entire domain is dedicated to asynchronous execution.

---

## Domain 26: Webhooks & External Event Ingress

### 26.1 Module Architecture & File Catalog

This domain handles inbound webhooks from external SaaS platforms, verifying cryptographic signatures, ensuring idempotent processing, and dispatching internal domain events.

- `app/routers/webhooks.py`:
  - `clerk_webhook()`: Ingests user lifecycle events from Clerk (`user.created`, `user.updated`, `user.deleted`), verifying Svix signature headers (`svix-id`, `svix-timestamp`, `svix-signature`) and synchronizing the local `users` and `student_profiles` tables.

### 26.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `POST` | `/webhooks/clerk` | `None` | `Any` | Public (None) | 200, 500 | `Direct DB / Session` |


### 26.3 Database Schemas & Persistence
- Writes directly to `users` and `student_profiles`.

### 26.4 Existing Caching Usage
- `ep:webhook:idempotency:<svix_id>` (TTL: 86400s): Deduplication key preventing duplicate processing of retried webhook deliveries.

### 26.5 Async / Background Processing
- Webhook endpoints acknowledge HTTP 200 immediately after cryptographic validation and enqueue user profile updates asynchronously.

---

## Domain 27: Administrative Operations & System Diagnostics

### 27.1 Module Architecture & File Catalog

This domain provides platform superadmins and staff with tools for user moderation, role transitions, pipeline rescue operations, system diagnostics, and exam publishing controls.

- `app/routers/admin.py`:
  - `get_admin_overview_stats()`: Platform KPI dashboard (user counts, active exams, pending reviews).
  - `list_pending_admin_requests()`, `approve_admin_request()`, `reject_admin_request()`: Admin privilege grant workflow.
  - `list_active_admins()`, `suspend_admin_user()`, `reactivate_admin_user()`: Admin access management.
  - `list_all_users()`, `update_user_role()`: User directory and role assignments.
  - `get_approval_audit_logs()`: Security audit log viewer.
  - `get_system_diagnostics()`: Runtime health inspection (DB pool stats, Redis latency, disk space, worker statuses).
  - `list_exam_pipeline_statuses()`, `list_stuck_pipelines()`, `resume_interrupted_pipeline()`, `dismiss_stuck_pipeline()`: Pipeline failure recovery controls.
  - `approve_and_publish_exam()`: Production release gate for verified exam papers.
  - `sync_exam_s3_artifacts()`, `get_exam_sync_status()`: S3 export and CDN cache warming.
  - `trigger_exam_translation()`, `trigger_reconcile_translations()`: Manual translation dispatchers.
- `app/services/admin_service.py`:
  - `AdminService`: Encapsulates administrative business logic, database queries, and role verification.
- `app/services/task_registry.py`:
  - `TaskRegistry`: Tracks running background tasks across workers, supports task cancellation, and prevents orphaned tasks.

### 27.2 API Endpoints

| HTTP Method | Route Path | Request Body Schema | Response Model | Auth & Permissions | Status Codes | Internal Services / Functions Called |
|-------------|------------|---------------------|----------------|--------------------|--------------|--------------------------------------|
| `GET` | `/admin/overview-stats` | `None` | `AdminOverviewStatsOut` | `role_checker` | 200, 401, 403, 500 | `get_cache`, `AdminService` |
| `GET` | `/admin/pending-requests` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `AdminService` |
| `GET` | `/admin/active-admins` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `AdminService` |
| `GET` | `/admin/all-users` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `AdminService` |
| `POST` | `/admin/users/{user_id}/role` | `None` | `UserOut` | `role_checker` | 200, 401, 403, 404, 500 | `get_cache`, `invalidate_`, `AdminService` |
| `POST` | `/admin/approve/{user_id}` | `None` | `UserOut` | `role_checker` | 200, 401, 403, 404, 500 | `get_cache`, `invalidate_`, `AdminService` |
| `POST` | `/admin/reject/{user_id}` | `None` | `UserOut` | `role_checker` | 200, 401, 403, 404, 500 | `get_cache`, `invalidate_`, `AdminService` |
| `POST` | `/admin/suspend/{user_id}` | `None` | `UserOut` | `role_checker` | 200, 401, 403, 404, 500 | `get_cache`, `invalidate_`, `AdminService` |
| `POST` | `/admin/reactivate/{user_id}` | `None` | `UserOut` | `role_checker` | 200, 401, 403, 404, 500 | `get_cache`, `invalidate_`, `AdminService` |
| `GET` | `/admin/audit-logs` | `None` | `List` | `role_checker` | 200, 401, 403, 500 | `AdminService` |
| `GET` | `/admin/system-stats` | `None` | `SystemStatsOut` | `role_checker` | 200, 401, 403, 500 | `get_cache`, `AdminService` |
| `GET` | `/admin/exams/pipeline-status` | `None` | `Any` | `role_checker` | 200, 401, 403, 500 | `get_cache` |
| `GET` | `/admin/exams/stuck-pipelines` | `None` | `Any` | `role_checker` | 200, 401, 403, 500 | `get_cache` |
| `POST` | `/admin/exams/{exam_id}/resume-pipeline` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `PipelineManagementService` |
| `POST` | `/admin/exams/{exam_id}/dismiss-stuck-pipeline` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `GET` | `/admin/exams/{exam_id}/review-questions` | `None` | `ExamReviewQuestionsResponse` | `role_checker` | 200, 401, 403, 404, 500 | `QuestionService`, `get_cache` |
| `POST` | `/admin/exams/{exam_id}/approve` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `invalidate_` |
| `POST` | `/admin/exams/{exam_id}/sync` | `None` | `Any` | `role_checker` | 202, 401, 403, 404, 500 | `Direct DB / Session` |
| `GET` | `/admin/exams/{exam_id}/sync-status` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `Direct DB / Session` |
| `POST` | `/admin/questions` | `None` | `QuestionDetailResponse` | `role_checker` | 201, 401, 403, 500 | `QuestionService` |
| `PUT` | `/admin/questions/{question_id}` | `None` | `QuestionDetailResponse` | `role_checker` | 200, 401, 403, 404, 500 | `QuestionService` |
| `PATCH` | `/admin/questions/{question_id}` | `None` | `QuestionDetailResponse` | `role_checker` | 200, 401, 403, 404, 500 | `QuestionService` |
| `POST` | `/admin/upload-question-paper` | `None` | `Any` | `role_checker` | 202, 401, 403, 500 | `invalidate_` |
| `POST` | `/admin/upload-answer-key` | `None` | `Any` | `role_checker` | 202, 401, 403, 500 | `invalidate_` |
| `POST` | `/admin/{exam_id}/approve-all-questions` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `QuestionService` |
| `POST` | `/admin/exams/{exam_id}/approve-all-questions` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `QuestionService` |
| `POST` | `/admin/{exam_id}/translate` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `invalidate_`, `QuestionTranslationService` |
| `POST` | `/admin/exams/{exam_id}/translate` | `None` | `Any` | `role_checker` | 200, 401, 403, 404, 500 | `invalidate_`, `QuestionTranslationService` |
| `POST` | `/admin/exams/reconcile-translations` | `None` | `Any` | `role_checker` | 200, 401, 403, 500 | `QuestionTranslationService` |
| `GET` | `/admin/languages` | `None` | `Any` | `role_checker` | 200, 401, 403, 500 | `Direct DB / Session` |


### 27.3 Database Schemas & Persistence
- Writes to: `admin_approval_logs`, `role_assignment_logs`, `users`, `exams`, `pipeline_runs`.

### 27.4 Existing Caching Usage
- `ep:admin:overview:stats` (TTL: 120s): KPI summary cache.
- `ep:admin:diagnostics` (TTL: 15s): Health stats cache.

### 27.5 Async / Background Processing
- Exam publication triggers async static bundle generation and S3 sync via `sync_exam_s3_artifacts`.

---

# PART C: CONVENTIONS, ARCHITECTURAL PATTERNS & GUARDRAILS

To ensure that any subsequent code modification or extension adheres strictly to established architectural standards, the following 8 patterns MUST be followed:

### 1. Database Lock Contention & Retry Pattern (`@with_db_retry`)
- **Location:** `app/db/upsert.py`
- **Pattern:** High-concurrency operations (such as saving live candidate telemetry, bulk question registration, and updating attempt states) must be wrapped with `@with_db_retry(max_retries=3, initial_delay=0.1, backoff_factor=2.0)`.
- **Catchable Exceptions:** Automatically intercepts `psycopg2.errors.DeadlockDetected`, `psycopg2.errors.LockNotAvailable`, and SQLAlchemy `OperationalError` when lock contention occurs, retrying with exponential jitter before bubbling up.

### 2. Managed Database Sessions (`managed_async_session`)
- **Location:** `app/db/session.py`
- **Pattern:** Standalone worker tasks, background jobs, and cron scripts that execute outside FastAPI's request-response lifecycle dependency injection (`get_db`) MUST use the async context manager:
  ```python
  async with managed_async_session() as session:
      # Perform transactional queries
      await session.commit()
  ```
- **Guardrail:** Automatically rolls back transactions on uncaught exceptions and guarantees connection return to the pool.

### 3. Multi-Tier Cache Wrapper Pattern (`@cached`)
- **Location:** `app/cache/decorator.py`
- **Pattern:** Service functions querying read-heavy, relatively static data (question cards, syllabus trees, exam details) should use the `@cached` decorator:
  ```python
  @cached(
      key_builder=lambda exam_id, **kwargs: f"ep:exam:solutions:{exam_id}",
      ttl=86400,
      namespace="exams"
  )
  async def get_exam_solutions(exam_id: int, session: AsyncSession):
      ...
  ```
- **Guardrail:** Decorated functions must always handle Redis unavailability gracefully via the integrated `FallbackCache`.

### 4. Deterministic Extraction Architecture
- **Location:** `app/pipeline/`
- **Pattern:** Document parsing for PDFs must avoid non-deterministic multi-agent LLM loops. Extraction flows through:
  `PDF Bytes` -> `RapidOCR + ONNX` -> `Regex Block Splitter` -> `DSU Passage Stitcher` -> `Heuristic Format/Difficulty Classifier` -> `BatchQuestionRegistrar (10 items/batch)`.
- **HITL Integration:** If regex parsing confidence falls below threshold, questions are flagged with `requires_human_review = True` and inserted into `human_review_tasks` rather than failing the entire paper.

### 5. Post-Submission Dual-Phase Separation
- **Location:** `app/engine/post_submission_pipeline.py`
- **Pattern:** Candidate test evaluation MUST maintain absolute separation between Phase 1 and Phase 2:
  - **Phase 1 (Pure Math):** Computes IRT 3PL ability, GTI, SATOI, FSRS decay, and time-tiered scores deterministically in <2 seconds.
  - **Phase 2 (AI Mentor Synthesis):** Runs asynchronously. The prompt for `ReportAISynthesizer` strictly forbids recalculating any numerical score. The LLM translates numbers into qualitative mentorship advice and produces exactly 4 prioritized study tasks.

### 6. Portable Database Field Types
- **Location:** `app/db/models/types.py`
- **Pattern:**
  - All primary keys on high-volume tables must use `BigIntPK` (`BIGINT` on PostgreSQL).
  - All timestamp columns must use `DateTimeTZ` (`TIMESTAMPTZ` on PostgreSQL, ensuring UTC storage).
  - All JSON payload fields must use `PortableJSON` (`JSONB` on PostgreSQL, `JSON` on SQLite for local in-memory unit tests).

### 7. Safe Temporary File Cleanups (`is_safe_temporary_path`)
- **Location:** `app/core/cleanup.py`
- **Pattern:** Before unlinking or cleaning up temporary files (OCR page splits, cropped PNG diagrams, unpacked ZIP archives), code MUST call `is_safe_temporary_path(path)` to verify that the path resolves strictly inside designated temporary directories (`/tmp`, `/var/tmp`), preventing accidental system directory deletion.

### 8. Standardized Domain Exception Envelope
- **Location:** `app/core/exceptions.py`
- **Pattern:** All service-layer errors must subclass `BaseAppException`, specifying `status_code`, `detail`, and `error_code`. FastAPI exception handlers catch these and return RFC-7807 compliant problem JSON responses.

---

# PART D: AMBIGUITIES, ARCHITECTURAL DEBT & ITEMS REQUIRING VERIFICATION

The following items represent areas in the codebase where implementation details are in transition, dependent on external environment settings, or require verification before making modifications:

### 1. Subscription & Payment Gateway Webhook Integration
- **Code Reference:** `app/db/models/subscription.py`, `app/routers/webhooks.py`
- **Finding:** Complete database models for subscription billing exist (`SubscriptionPlan`, `PlatformFeature`, `PlanFeatureLink`, `UserSubscription`), but public checkout session creation endpoints and payment gateway webhooks (Razorpay / Stripe) are not yet implemented in `app/routers/webhooks.py`.
- **Status:** **Unclear / Needs Verification.** Confirm whether payments are processed through a separate external microservice or if Razorpay webhook handlers need to be added to `apps/backend`.

### 2. Dual Background Execution Engine (Celery vs In-Process Asyncio)
- **Code Reference:** `app/tasks/celery_app.py`, `app/services/task_registry.py`
- **Finding:** The system supports both distributed Celery task queues and in-process `asyncio.create_task` via `TaskRegistry`. When `has_active_celery_workers()` returns `False`, jobs silently fall back to `asyncio.create_task`.
- **Status:** **Architecture Verification.** In single-container production environments, tasks will run in-process, which may impact API response latency under heavy OCR workloads. Verify if Celery worker containers are actively deployed in target production topology.

### 3. Database Connection Pre-Ping Disabled (`pool_pre_ping=False`)
- **Code Reference:** `app/db/session.py` (line 74)
- **Finding:** `pool_pre_ping` is explicitly set to `False` with the comment: *"pool_pre_ping=False: Avoids round-trip 'SELECT 1' ping on checkout. In remote RDS setups, pre-ping adds severe latency to every request."*
- **Status:** **Operational Risk.** If remote AWS RDS restarts or drops idle connections after timeout periods, the application may encounter `psycopg2.OperationalError: server closed the connection unexpectedly` on the first query of a recycled connection. Verify whether RDS idle timeout is configured above connection recycle limits (`pool_recycle=1800`).

### 4. Deprecated Answer-Key & Explanation Endpoints
- **Code Reference:** `app/fastapi_server.py` (legacy route registrations)
- **Finding:** Endpoints `/api/v1/answer-keys` and `/api/v1/explanations` have been intentionally replaced by the deterministic extraction pipeline and return HTTP `410 GONE`.
- **Status:** **Technical Debt.** Confirm whether any legacy mobile app or external client still calls these routes before removing their router stubs completely.

### 5. Storage Provider S3 IAM Role vs Static Credentials
- **Code Reference:** `app/storage/s3.py`
- **Finding:** `S3StorageProvider` checks `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in environment variables, and falls back to Boto3 ambient credential resolution if omitted.
- **Status:** **Needs Verification.** Verify whether the production Kubernetes / ECS cluster utilizes AWS IAM Roles for Service Accounts (IRSA) or relies on secrets injected via `AWSSecretLoader`.

---
*End of High-Level Design (HLD) & Low-Level Design (LLD) Document.*
