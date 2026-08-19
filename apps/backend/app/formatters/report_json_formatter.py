import json
import math
from typing import Dict, Any


def _sanitize_floats(obj: Any) -> Any:
    """Recursively replaces NaN, Infinity, -Infinity floats with 0.0 or valid values."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, dict):
        return {k: _sanitize_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_floats(elem) for elem in obj]
    elif isinstance(obj, tuple):
        return tuple(_sanitize_floats(elem) for elem in obj)
    return obj


def format_report_to_json(report_data: Dict[str, Any], indent: int = 2) -> str:
    """
    Formats the raw compiled report dict into a clean, structured JSON string suitable for frontend consumption.
    Guarantees no NaN/Inf tokens that break browser JSON.parse().
    """
    sanitized = _sanitize_floats(report_data)
    return json.dumps(sanitized, indent=indent, default=str)

