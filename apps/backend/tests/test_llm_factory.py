import unittest
from unittest.mock import patch, MagicMock
from app.config.settings import Settings, get_settings
from app.llm.factory import get_vision_llm, get_rate_limiter


class TestLLMFactory(unittest.TestCase):
    def test_default_llm_settings(self):
        settings = get_settings()
        self.assertEqual(settings.LLM_PROVIDER, "vertexai")
        self.assertEqual(settings.GEMINI_MODEL_NAME, "gemini-3.5-flash")
        self.assertEqual(settings.GCP_LOCATION, "us-central1")
        self.assertEqual(
            settings.GOOGLE_APPLICATION_CREDENTIALS, "gcp-service-account.json"
        )

    @patch("langchain_google_genai.ChatGoogleGenerativeAI")
    def test_get_vision_llm_vertexai(self, mock_chat_genai):
        mock_instance = MagicMock()
        mock_chat_genai.return_value = mock_instance

        test_settings = Settings(
            LLM_PROVIDER="vertexai",
            GCP_PROJECT_ID="test-gcp-project",
            GCP_LOCATION="us-central1",
            GEMINI_MODEL_NAME="gemini-1.5-flash",
            GOOGLE_APPLICATION_CREDENTIALS="gcp-service-account.json",
        )

        with patch("app.llm.factory.get_settings", return_value=test_settings):
            llm = get_vision_llm()
            self.assertIsNotNone(llm)
            mock_chat_genai.assert_called_once()
            call_kwargs = mock_chat_genai.call_args.kwargs
            self.assertEqual(call_kwargs.get("model"), "gemini-1.5-flash")
            self.assertTrue(call_kwargs.get("vertexai"))
            self.assertEqual(call_kwargs.get("project"), "test-gcp-project")
            self.assertEqual(call_kwargs.get("location"), "us-central1")
            self.assertEqual(call_kwargs.get("temperature"), 0)

    def test_unsupported_provider_raises_error(self):
        test_settings = Settings(LLM_PROVIDER="invalid_provider")
        with patch("app.llm.factory.get_settings", return_value=test_settings):
            with self.assertRaises(ValueError):
                get_vision_llm()


if __name__ == "__main__":
    unittest.main()
