import json
from typing import Dict, Any


def format_report_to_json(report_data: Dict[str, Any], indent: int = 2) -> str:
    """
    Formats the raw compiled report dict into a clean, structured JSON string suitable for frontend consumption.
    """
    return json.dumps(report_data, indent=indent, default=str)
