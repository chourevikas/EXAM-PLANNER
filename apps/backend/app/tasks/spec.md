# Module Specification: Celery Async Task Queue (`tasks/`)

## Overview
The `tasks` module configures Celery with Redis/RabbitMQ brokers for non-blocking execution of heavy PDF extraction tasks.

## Tasks
1. **`process_exam_pdf_task` (`tasks/exam_tasks.py`)**:
   - Accepts `exam_id_str`, `pdf_path`, and `exam_title`.
   - Updates `Exam` record with total pages.
   - Invokes the LangGraph extraction pipeline asynchronously.
   - Generates and uploads dual `.yaml` and `.md` formatted output files to `StorageProvider`.
