import shutil
import tempfile
from pathlib import Path
from typing import Union, Optional, List
from app.config.settings import get_settings
from app.config.logger import setup_logger

logger = setup_logger("CleanupUtility")


# Explicit whitelist of approved temporary directory names / prefixes
KNOWN_TEMP_DIR_PATTERNS = {
    "temp_uploads",
    "temp_answer_keys",
    "temp_pdf_cache",
    "output_artifacts",
    "temp",
    "tmp",
}


def is_safe_temporary_path(path: Path) -> bool:
    """
    Safety guard guaranteeing that a path is strictly a temporary processing file/directory
    and NEVER part of persistent storage (e.g. storage_data, uploads, S3 local storage).
    """
    try:
        resolved = path.resolve()
        settings = get_settings()

        # 1. Never delete persistent local storage or uploads directory
        persistent_storage_dir = Path(settings.LOCAL_STORAGE_PATH).resolve()
        uploads_dir = (Path.cwd() / "uploads").resolve()

        if (
            persistent_storage_dir in resolved.parents
            or resolved == persistent_storage_dir
        ):
            logger.error(
                f"🛡️ SAFETY GUARD: Refusing to clean up persistent storage file/folder '{resolved}'"
            )
            return False

        if uploads_dir in resolved.parents or resolved == uploads_dir:
            logger.error(
                f"🛡️ SAFETY GUARD: Refusing to clean up persistent uploads file/folder '{resolved}'"
            )
            return False

        # 2. Verify that path or one of its parent directories matches an approved temporary pattern
        sys_temp = Path(tempfile.gettempdir()).resolve()
        if sys_temp in resolved.parents or resolved == sys_temp:
            return True

        path_parts = [part.lower() for part in resolved.parts]
        for temp_name in KNOWN_TEMP_DIR_PATTERNS:
            if temp_name in path_parts or any(
                p.name.lower().startswith("temp") or p.name.lower().startswith("tmp")
                for p in resolved.parents
            ):
                return True

        # Check if file/folder itself starts with temp or tmp
        if resolved.name.lower().startswith("temp") or resolved.name.lower().startswith(
            "tmp"
        ):
            return True

    except Exception as err:
        logger.warning(f"Error checking safety of path '{path}': {err}")
        return False

    logger.warning(
        f"🛡️ SAFETY GUARD: Path '{path}' is not a recognized temporary path. Skipping deletion."
    )
    return False


def cleanup_file(file_path: Optional[Union[str, Path]]) -> bool:
    """
    Safely removes a single temporary file ONLY if it passes temporary path safety validation.
    Returns True if removed, False otherwise.
    """
    if not file_path:
        return False
    try:
        path = Path(file_path).resolve()
        if not is_safe_temporary_path(path):
            return False

        if path.is_file() or path.is_symlink():
            path.unlink()
            logger.info(f"🗑️ Cleaned up temporary file: '{path}'")
            return True
    except Exception as exc:
        logger.warning(f"Failed to remove temporary file '{file_path}': {exc}")
    return False


def cleanup_directory(dir_path: Optional[Union[str, Path]]) -> bool:
    """
    Safely removes a temporary directory tree ONLY if it passes temporary path safety validation.
    Protects shared root temp directories (e.g. temp_pdf_cache) from global wipes.
    Returns True if removed, False otherwise.
    """
    if not dir_path:
        return False
    try:
        path = Path(dir_path).resolve()
        if not is_safe_temporary_path(path):
            return False

        # Protect shared root temp cache directories from global deletion
        shared_roots = {
            Path("./temp_pdf_cache").resolve(),
            Path("./temp_uploads").resolve(),
            Path("./temp_answer_keys").resolve(),
        }
        if path in shared_roots:
            logger.warning(
                f"🛡️ SAFETY GUARD: Refusing to delete shared root temporary folder '{path}'. "
                f"Perform file-level or task-scoped cleanup instead."
            )
            return False

        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
            logger.info(f"🗑️ Cleaned up temporary directory: '{path}'")
            return True
    except Exception as exc:
        logger.warning(f"Failed to remove temporary directory '{dir_path}': {exc}")
    return False
