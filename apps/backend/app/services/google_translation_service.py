"""
Google Translation Service with Automatic Gemini Vertex AI Fallback.
Preserves non-translatable blocks (images, tables, LaTeX math formulas, HTML tags)
and translates text into any of the 22 scheduled Indian languages.
"""

import os
import re
import json
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any

from app.config.settings import get_settings
from app.config.logger import setup_logger
from app.core.languages import (
    get_language_info,
    normalize_language,
    SUPPORTED_LANGUAGES_LIST,
)

logger = setup_logger("GoogleTranslationService")


class TextProtectionHandler:
    """Protects non-translatable entities (Markdown images, HTML tags, LaTeX math, Markdown tables)
    using sentinel placeholders during translation, and accurately restores them afterwards."""

    # Patterns for entities that MUST NOT be translated or modified
    PATTERNS = [
        # Markdown image syntax: ![alt text](url "optional title")
        re.compile(r"!\[.*?\]\(.*?\)", re.DOTALL),
        # HTML tags: <img ...>, <svg ...>, <div>, etc.
        re.compile(r"<[^>]+>", re.DOTALL),
        # LaTeX display math: $$...$$ or \[...\]
        re.compile(r"\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]", re.DOTALL),
        # LaTeX inline math: $...$ or \(...\)
        re.compile(r"(?<!\$)\$(?!\$)[\s\S]*?(?<!\$)\$(?!\$)|\\\(.*?\\\)", re.DOTALL),
        # Markdown tables: rows starting and ending with '|'
        re.compile(r"(?:^|\n)(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)*)", re.MULTILINE),
    ]

    SENTINEL_PREFIX = "___EXAM_BLOCK_"
    SENTINEL_SUFFIX = "___"
    SENTINEL_REGEX = re.compile(r"___EXAM_BLOCK_(\d+)___")

    @classmethod
    def mask(cls, text: str) -> Tuple[str, Dict[str, str]]:
        """Replaces non-translatable blocks with unique sentinel tokens."""
        if not text:
            return text, {}

        store: Dict[str, str] = {}
        masked = text
        counter = 0

        for pattern in cls.PATTERNS:
            def _replace(match):
                nonlocal counter
                token = f"{cls.SENTINEL_PREFIX}{counter}{cls.SENTINEL_SUFFIX}"
                store[token] = match.group(0)
                counter += 1
                return token

            masked = pattern.sub(_replace, masked)

        return masked, store

    @classmethod
    def unmask(cls, text: str, store: Dict[str, str]) -> str:
        """Restores original non-translatable blocks from sentinel tokens."""
        if not text or not store:
            return text

        result = text
        for token, original in store.items():
            result = result.replace(token, original)

        # Catch potential spacing introduced around sentinel tokens by LLM
        def _cleanup(match):
            idx = match.group(1)
            token = f"{cls.SENTINEL_PREFIX}{idx}{cls.SENTINEL_SUFFIX}"
            return store.get(token, match.group(0))

        result = cls.SENTINEL_REGEX.sub(_cleanup, result)
        return result

    # Aliases
    protect_blocks = mask
    restore_blocks = unmask


class GoogleTranslationService:
    """
    Unified Translation Service providing:
    1. Google Cloud Translation API (Cloud Translation v2/v3).
    2. Zero-config automatic fallback to Google Gemini (Vertex AI / Generative AI)
       using the identical project & service account credentials configured for the platform.
    """

    def __init__(self):
        self.settings = get_settings()
        self._gcp_creds = None
        self._gcp_project = self.settings.GCP_PROJECT_ID
        self._cloud_translate_client = None
        self._cloud_translate_failed = False
        self._init_credentials()

    def _init_credentials(self):
        cred_path = self.settings.GOOGLE_APPLICATION_CREDENTIALS or os.environ.get(
            "GOOGLE_APPLICATION_CREDENTIALS"
        )
        if cred_path:
            abs_cred_path = Path(cred_path)
            if not abs_cred_path.is_absolute():
                project_root = Path(__file__).resolve().parent.parent.parent
                possible_paths = [
                    Path.cwd() / cred_path,
                    project_root / cred_path,
                    project_root.parent / cred_path,
                ]
                for p in possible_paths:
                    if p.exists():
                        abs_cred_path = p.resolve()
                        break

            if abs_cred_path.exists():
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(abs_cred_path)
                try:
                    from google.oauth2 import service_account
                    self._gcp_creds = service_account.Credentials.from_service_account_file(
                        str(abs_cred_path),
                        scopes=["https://www.googleapis.com/auth/cloud-platform"],
                    )
                    if hasattr(self._gcp_creds, "project_id") and self._gcp_creds.project_id:
                        self._gcp_project = self._gcp_creds.project_id
                except Exception as e:
                    logger.warning(f"Could not load service account credentials from {abs_cred_path}: {e}")

    def _get_cloud_translate_client(self):
        """Attempts to initialize google.cloud.translate client if available."""
        if self._cloud_translate_failed:
            return None
        if self._cloud_translate_client is not None:
            return self._cloud_translate_client

        try:
            from google.cloud import translate_v2 as translate
            if self._gcp_creds:
                self._cloud_translate_client = translate.Client(credentials=self._gcp_creds)
            else:
                self._cloud_translate_client = translate.Client()
            return self._cloud_translate_client
        except Exception as e:
            logger.info(f"Google Cloud Translation v2 client not initialized ({e}). Will use Gemini / REST fallback.")
            self._cloud_translate_failed = True
            return None

    async def translate_text(
        self,
        text: str,
        target_language: str,
        source_language: str = "en",
    ) -> str:
        """
        Translates a single text into target_language.
        Preserves all images, tables, formulas, and formatting.
        """
        if not text or not str(text).strip():
            return text or ""

        target_iso, _ = normalize_language(target_language)
        source_iso, _ = normalize_language(source_language)

        if target_iso == source_iso:
            return text

        results = await self.translate_batch([text], target_language=target_language, source_language=source_language)
        return results[0] if results else text

    async def translate_batch(
        self,
        texts: List[str],
        target_language: str,
        source_language: str = "en",
    ) -> List[str]:
        """
        Translates a list of texts into target_language in batch.
        Tries Google Cloud Translation API first; if unavailable or failing,
        falls back smoothly to Gemini Vertex AI.
        """
        if not texts:
            return []

        target_iso, target_enum = normalize_language(target_language)
        source_iso, _ = normalize_language(source_language)

        if target_iso == source_iso:
            return texts

        # Mask non-translatable elements across all texts
        masked_texts: List[str] = []
        stores: List[Dict[str, str]] = []
        for t in texts:
            masked, store = TextProtectionHandler.mask(t or "")
            masked_texts.append(masked)
            stores.append(store)

        # Try Google Cloud Translation
        translated_masked = None
        client = self._get_cloud_translate_client()
        if client is not None:
            try:
                loop = asyncio.get_event_loop()
                # Run sync Google Cloud translate in thread pool
                def _call_gcp():
                    res = client.translate(
                        masked_texts,
                        target_language=target_iso,
                        source_language=source_iso,
                        format_="text",
                    )
                    if isinstance(res, dict):
                        return [res.get("translatedText", "")]
                    elif isinstance(res, list):
                        return [item.get("translatedText", "") for item in res]
                    return []

                translated_masked = await loop.run_in_executor(None, _call_gcp)
                logger.debug(f"Successfully translated {len(texts)} texts using Google Cloud Translate ({target_iso}).")
            except Exception as gcp_err:
                logger.warning(
                    f"Google Cloud Translate API failed ({gcp_err}). Falling back to Gemini Vertex AI translation..."
                )
                self._cloud_translate_failed = True

        # Fallback to Gemini Vertex AI
        if not translated_masked or len(translated_masked) != len(texts):
            translated_masked = await self._translate_with_gemini(
                masked_texts, target_language=target_language, source_language=source_language
            )

        # Unmask non-translatable entities
        final_results: List[str] = []
        for translated, store in zip(translated_masked, stores):
            final = TextProtectionHandler.unmask(translated, store)
            final_results.append(final)

        return final_results

    async def _translate_with_gemini(
        self,
        masked_texts: List[str],
        target_language: str,
        source_language: str = "en",
    ) -> List[str]:
        """Translates texts using Gemini Vertex AI model with strict instruction to preserve sentinel tokens."""
        target_info = get_language_info(target_language)
        target_name = target_info.name
        target_native = target_info.native_name

        from app.llm.factory import get_vision_llm
        llm = get_vision_llm(timeout=60, max_retries=3, rate_limit_rps=3.0)

        # Chunk large lists into manageable batches of 10 items
        batch_size = 10
        all_results: List[str] = []

        for i in range(0, len(masked_texts), batch_size):
            chunk = masked_texts[i : i + batch_size]
            prompt = (
                f"You are a professional educational exam translator specializing in Indian languages.\n"
                f"Translate the following {len(chunk)} numbered text items from English into {target_name} ({target_native}).\n\n"
                "STRICT RULES:\n"
                "1. Keep all technical terms, names, and formulas accurate according to official competitive exam standards.\n"
                "2. CRITICAL: Preserve all sentinel tokens exactly as they appear (e.g. '___EXAM_BLOCK_0___', '___EXAM_BLOCK_1___'). DO NOT TRANSLATE OR ALTER THEM.\n"
                "3. Preserve all punctuation, option letters (A, B, C, D), numbering, and LaTeX markup.\n"
                "4. Respond with a JSON array of strings containing EXACTLY the translated texts in order.\n\n"
                "Input texts to translate:\n"
                + json.dumps(chunk, ensure_ascii=False)
                + "\n\nOutput JSON format:\n[\"translated text 1\", \"translated text 2\", ...]"
            )

            try:
                response = await llm.ainvoke(prompt)
                content = response.content if hasattr(response, "content") else str(response)

                # Extract JSON array from markdown code block if present
                clean_json = content.strip()
                if "```json" in clean_json:
                    clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                elif "```" in clean_json:
                    clean_json = clean_json.split("```")[1].split("```")[0].strip()

                parsed = json.loads(clean_json)
                if isinstance(parsed, list) and len(parsed) == len(chunk):
                    all_results.extend([str(item) for item in parsed])
                else:
                    # Fallback if length mismatch
                    logger.warning(f"Gemini translated length mismatch: expected {len(chunk)}, got {len(parsed) if isinstance(parsed, list) else 0}")
                    for idx, orig in enumerate(chunk):
                        if isinstance(parsed, list) and idx < len(parsed):
                            all_results.append(str(parsed[idx]))
                        else:
                            all_results.append(orig)
            except Exception as e:
                logger.error(f"Gemini translation call failed for chunk {i}: {e}. Returning original text.")
                all_results.extend(chunk)

        return all_results
