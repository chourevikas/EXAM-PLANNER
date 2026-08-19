import os
import logging
import sys
from typing import Optional, Any, MutableMapping


class TaskContextFilter(logging.Filter):
    """Filter that guarantees 'task_id' is present on all LogRecord instances."""

    def __init__(self, default_task_id: str = "N/A"):
        super().__init__()
        self.default_task_id = default_task_id

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "task_id") or not record.task_id:
            record.task_id = self.default_task_id
        return True


class StandardLogFormatter(logging.Formatter):
    """Custom log formatter with timestamp, level, logger name, task ID, and line number."""

    fmt = "%(asctime)s [%(levelname)s] [%(name)s] [TaskID: %(task_id)s] (%(filename)s:%(lineno)d): %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    def __init__(self):
        super().__init__(fmt=self.fmt, datefmt=self.datefmt)


class FlushStreamHandler(logging.StreamHandler):
    """StreamHandler that immediately flushes sys.stdout for real-time console log output."""

    def emit(self, record: logging.LogRecord) -> None:
        super().emit(record)
        self.flush()


def setup_logger(
    name: str = "ExamMentorshipPlatform", log_level: Optional[str] = None
) -> logging.Logger:
    """Creates or retrieves a configured Logger instance with task ID support and live console flushing."""
    if not log_level:
        try:
            from app.config.settings import get_settings

            log_level = get_settings().LOG_LEVEL
        except Exception:
            log_level = os.getenv("LOG_LEVEL", "INFO")

    level_str = (log_level or "INFO").upper()
    level = getattr(logging, level_str, logging.INFO)

    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Attach live-flushing StreamHandler with TaskContextFilter if not already attached
    if not logger.handlers:
        console_handler = FlushStreamHandler(sys.stdout)
        console_handler.setLevel(level)
        console_handler.setFormatter(StandardLogFormatter())
        console_handler.addFilter(TaskContextFilter())
        logger.addHandler(console_handler)

    return logger


class TaskLoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that automatically attaches task_id to every log statement."""

    def __init__(self, logger: logging.Logger, task_id: Optional[str] = None):
        super().__init__(logger, {"task_id": task_id or "N/A"})

    def process(
        self, msg: str, kwargs: MutableMapping[str, Any]
    ) -> tuple[str, MutableMapping[str, Any]]:
        extra = kwargs.get("extra", {})
        if "task_id" not in extra:
            extra["task_id"] = self.extra.get("task_id", "N/A")
        kwargs["extra"] = extra
        return msg, kwargs


# Default application-wide logger instance
logger = setup_logger()
