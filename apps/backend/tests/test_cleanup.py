import unittest
import tempfile
from pathlib import Path
from app.config.settings import get_settings
from app.core.cleanup import (
    cleanup_file,
    cleanup_directory,
    is_safe_temporary_path,
)


class TestCleanupUtility(unittest.TestCase):
    def test_cleanup_file(self):
        tmp_dir = Path(tempfile.mkdtemp(prefix="temp_test_"))
        tmp_file = tmp_dir / "sample.txt"
        tmp_file.write_text("test content")

        self.assertTrue(tmp_file.exists())
        result = cleanup_file(tmp_file)
        self.assertTrue(result)
        self.assertFalse(tmp_file.exists())

        cleanup_directory(tmp_dir)

    def test_cleanup_directory(self):
        tmp_dir = Path(tempfile.mkdtemp(prefix="temp_test_dir_"))
        sub_file = tmp_dir / "sample.txt"
        sub_file.write_text("sample")

        self.assertTrue(tmp_dir.exists())
        result = cleanup_directory(tmp_dir)
        self.assertTrue(result)
        self.assertFalse(tmp_dir.exists())

    def test_safety_guard_protects_storage_files(self):
        settings = get_settings()
        storage_dir = Path(settings.LOCAL_STORAGE_PATH).resolve()
        storage_dir.mkdir(parents=True, exist_ok=True)

        protected_file = storage_dir / "persistent_paper.pdf"
        protected_file.write_text("persistent content")

        try:
            self.assertFalse(is_safe_temporary_path(protected_file))
            deleted = cleanup_file(protected_file)
            self.assertFalse(deleted)
            self.assertTrue(protected_file.exists())
        finally:
            if protected_file.exists():
                protected_file.unlink()


if __name__ == "__main__":
    unittest.main()
