import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config.secret_loaders.base import BaseSecretLoader


def find_env_files(start_path: Optional[Path] = None) -> List[Path]:
    """
    Recursively searches upwards from start_path (and current working directory)
    to find all existing .env files up to the root directory.
    Returned list is ordered from workspace root to closest sub-directory.
    """
    found: List[Path] = []

    # 1. Start from current working directory
    cwd = Path.cwd().resolve()
    curr = cwd
    while curr != curr.parent:
        candidate = curr / ".env"
        if candidate.is_file() and candidate not in found:
            found.append(candidate)
        curr = curr.parent

    # 2. Trace upwards from start_path if provided
    if start_path is not None:
        curr = start_path.resolve()
        while curr != curr.parent:
            candidate = curr / ".env"
            if candidate.is_file() and candidate not in found:
                found.append(candidate)
            curr = curr.parent

    # Reverse so root .env is loaded first, allowing closer sub-directory .env to override
    found.reverse()
    return found


class EnvSecretLoader(BaseSecretLoader):
    """Secret loader reading from OS environment variables and candidate .env files."""

    def load_secrets(self) -> Dict[str, Any]:
        secrets: Dict[str, Any] = {}

        # 1. Load .env file entries across directory tree
        env_files = find_env_files(Path(__file__).resolve())
        try:
            from dotenv import dotenv_values

            for env_path in env_files:
                loaded = dotenv_values(env_path)
                for k, v in loaded.items():
                    if k and v is not None:
                        secrets[k] = v
        except ImportError:
            pass

        # 2. OS environment variables override .env file entries
        for k, v in os.environ.items():
            secrets[k] = v

        return secrets
