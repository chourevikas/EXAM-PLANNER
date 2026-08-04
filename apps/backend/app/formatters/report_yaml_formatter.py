import yaml
from typing import Dict, Any


def format_report_to_yaml(report_data: Dict[str, Any]) -> str:
    """
    Formats the compiled report dict into clean YAML suitable for storage, archival, and LLM prompt context.
    """
    return yaml.dump(report_data, sort_keys=False, default_flow_style=False, allow_unicode=True)
