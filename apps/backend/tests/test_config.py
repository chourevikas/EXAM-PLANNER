import unittest
from pydantic_core import ValidationError
from app.config.settings import Settings, get_settings



class TestConfig(unittest.TestCase):
    def test_default_settings(self):
        settings = get_settings()
        self.assertEqual(settings.APP_NAME, "Exam Mentorship Platform")
        self.assertIn(settings.STORAGE_TYPE, ["local", "s3"])
        self.assertIsNotNone(settings.DATABASE_URL)

    def test_s3_validation_failure(self):
        with self.assertRaises((ValueError, ValidationError)):
            Settings(STORAGE_TYPE="s3", S3_BUCKET_NAME=None)


if __name__ == "__main__":
    unittest.main()
