import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config.secret_loaders.base import BaseSecretLoader


def find_env_files(start_path: Optional[Path] = None) -> List[Path]:
    """
    Recursively searches upwards from start_path (and current working directory)
    to find all existing .env files up to the repository/workspace root.
    Returned list is ordered from workspace root to closest sub-directory (root first, specific overrides later).
    """
    found_set = set()

    # 1. Start from current working directory
    cwd = Path.cwd().resolve()
    curr = cwd
    while curr != curr.parent:
        candidate = curr / ".env"
        if candidate.is_file():
            found_set.add(candidate)
        curr = curr.parent

    # 2. Trace upwards from start_path if provided
    if start_path is not None:
        curr = start_path.resolve()
        while curr != curr.parent:
            candidate = curr / ".env"
            if candidate.is_file():
                found_set.add(candidate)
            curr = curr.parent

    # Sort by path depth (fewer parts = higher up = root loaded first, sub-directory overrides later)
    return sorted(list(found_set), key=lambda p: len(p.parts))



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
