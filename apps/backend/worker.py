#!/usr/bin/env python3
"""
Celery Worker Process Entry Point.
Run with: uv run worker.py (or uv run celery -A app.tasks.celery_app worker --loglevel=info)
"""

import sys
from app.tasks.celery_app import celery_app
from app.config.logger import setup_logger

logger = setup_logger("CeleryWorkerRunner")

if __name__ == "__main__":
    logger.info("Starting Celery worker process for Exam Mentorship Platform...")
    # Start worker process using Celery CLI argument parser
    celery_app.worker_main(["worker", "--loglevel=info", "-E"])
