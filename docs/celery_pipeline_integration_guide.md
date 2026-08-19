# Celery Asynchronous Pipeline & Background Worker Integration Guide

> **Exam Platform & Vision AI PDF Processing Engine**
> Technical Operational Guide for DevOps & Backend Engineering Teams.

---

## 1. Executive Architecture Overview

The system processes heavy Vision AI LLM extractions and multi-concept indexing asynchronously through a decoupled **Celery worker architecture** backed by **Redis** as the message broker and result backend.

```
                              ┌───────────────────────────────────┐
                              │     FastAPI Application Server    │
                              │     (HTTP Routers / Admin API)    │
                              └─────────────────┬─────────────────┘
                                                │
                                    Dispatches Async Tasks
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │    Redis Message Broker & Result  │
                              │    redis://localhost:6379/0       │
                              └─────────────────┬─────────────────┘
                                                │
                                    Workers Consume Tasks
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │       Celery Worker Cluster       │
                              │   - process_exam_pdf_task         │
                              │   - process_answer_key_task       │
                              │   - process_exam_explanations_task│
                              └─────────────────┬─────────────────┘
                                                │
                                       Auto-Orchestration
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │    Database & S3 / Storage Data   │
                              │ (JSON Artifacts, DB Entities)     │
                              └───────────────────────────────────┘
```

---

## 2. Celery Configuration Reference

### Environment Variables (`.env`)

```env
# Celery Broker & Result Backend
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Development Mode (Set True to run synchronously in-memory without Redis broker)
CELERY_TASK_ALWAYS_EAGER=false
```

### Module Location & Task Registry
- **Celery App Core**: `app/tasks/celery_app.py`
- **Task Modules**:
  - `app/tasks/exam_tasks.py` (`process_exam_pdf_task`)
  - `app/tasks/answer_key_tasks.py` (`process_answer_key_task`)
  - `app/tasks/explanation_tasks.py` (`process_exam_explanations_task`)

---

## 3. Registered Celery Tasks & Ingestion Flow

### Task 1: `process_exam_pdf_task` (Pipeline 1: Question Extraction)
- **Signature**: `process_exam_pdf_task(exam_id_str: str, pdf_path: str, exam_title: Optional[str], task_id: Optional[str])`
- **Role**: Parses PDF pages using Vision LLM, resolves passage continuum via DSU stitcher, crops visual assets to `cropped_assets/{canonical}/{set}/{sec}/`, registers baseline questions and metadata in DB, and sets `QUESTION_EXTRACTION` status to `WAITING_FOR_ANSWER_KEY`.

### Task 2: `process_answer_key_task` (Pipeline 2: Answer Key & Set Mapping)
- **Signature**: `process_answer_key_task(exam_id_str: str, pdf_path: str, target_set_code: str, task_id: Optional[str])`
- **Role**: Extracts question-answer pairs from answer key documents, detects paper set code (`SET_A`, `SET_B`, etc.), validates against exam target set, sets correct answer options in DB (`QuestionOption.is_correct = True`), and checks if Pipeline 3 is ready to trigger.

### Task 3: `process_exam_explanations_task` (Pipeline 3: Explanation, IRT & JSON Artifacts)
- **Signature**: `process_exam_explanations_task(exam_id_str: str, task_id: Optional[str])`
- **Role**: 
  1. Generates English-only step-by-step solutions, distractor analyses, core concepts, and key takeaways (handling non-English questions safely without skipping).
  2. Evaluates option `closeness_score` ($0.0 - 1.0$) for every option choice.
  3. Calculates inter-dependent Item Response Theory (IRT 3PL) parameters ($a, b, c$).
  4. Normalizes question `expected_time_seconds` so that $\sum \text{expected\_time}_i == \text{Total Allocated Exam Time}$ exactly.
  5. Exports formatted standalone JSON artifacts (`artifacts/{canonical}/{set}/json/questions/Q001.json`) and summary JSONs for zero-DB-load frontend queries.

---

## 4. Automatic Pipeline Orchestration Logic

The system includes an **Automatic Pipeline Orchestrator** in `PipelineManagementService`:

```python
await pm.check_and_trigger_pipeline_3_if_ready(exam_id)
```

1. When Pipeline 1 (Questions) completes $\rightarrow$ State transitions to `WAITING_FOR_ANSWER_KEY`.
2. When Pipeline 2 (Answer Key) completes $\rightarrow$ State checks if Pipeline 1 is ready.
3. When **BOTH** Pipeline 1 and Pipeline 2 are complete $\rightarrow$ The orchestrator **automatically dispatches `process_exam_explanations_task` (Pipeline 3)**!

---

## 5. DevOps Commands & CLI Operation

### Local / Staging Worker Launch

Navigate to `apps/backend` and run:

```bash
# Start Redis Broker (via Docker Compose or system service)
docker compose up -d redis

# Start Celery Worker Node (Concurrency = 4)
uv run celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

### Production Deployment (Systemd Unit File)

Create `/etc/systemd/system/exam-celery.service`:

```ini
[Unit]
Description=Exam Platform Celery Async Worker
After=network.target redis.service

[Service]
Type=forking
User=examuser
Group=examuser
WorkingDirectory=/opt/exam-planner/apps/backend
ExecStart=/opt/exam-planner/.venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=8 --detach
ExecStop=/opt/exam-planner/.venv/bin/celery -A app.tasks.celery_app control shutdown
Restart=always

[Install]
WantedBy=multi-user.target
```

### Monitoring with Flower Dashboard

Launch Flower web UI for real-time task progress, worker health metrics, and failure alerts:

```bash
uv run celery -A app.tasks.celery_app flower --port=5555
```
Access Flower web dashboard at: `http://localhost:5555`

---

## 6. Error Handling & Retry Policies

1. **Vision Rate Limit Retries**: Worker invocations use Exponential Backoff (`retry_backoff=True`, `max_retries=3`).
2. **Transient Failures**: Interrupted tasks log details in `pipeline_runs.error_log` and transition status to `FAILED`. Admin can re-trigger failed tasks via API endpoints without corrupting previously saved DB records.
