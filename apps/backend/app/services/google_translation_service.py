"""
Google Translation Service with Automatic Gemini Vertex AI Fallback.
Preserves non-translatable blocks (images, tables, LaTeX math formulas, HTML tags)
and translates text into any of the 22 scheduled Indian languages.
"""

import os
import re
import json
import asyncio
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any

from app.config.settings import get_settings
from app.config.logger import setup_logger
from app.cache.factory import get_cache
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
        Optimized with Domain 24 Translation Memory Cache (TTL: 30 days).
        """
        if not texts:
            return []

        target_iso, target_enum = normalize_language(target_language)
        source_iso, _ = normalize_language(source_language)

        if target_iso == source_iso:
            return texts

        # Translation memory cache check: ep:trans:<target_iso>:<text_hash>
        cache = get_cache()
        prefix = self.settings.CACHE_KEY_PREFIX or "ep"
        ttl = 2592000  # 30 days

        miss_indices: List[int] = []
        miss_texts: List[str] = []
        results: List[Optional[str]] = [None] * len(texts)

        for idx, t in enumerate(texts):
            if not t or not str(t).strip():
                results[idx] = t or ""
                continue
            h = hashlib.sha256(t.strip().encode("utf-8")).hexdigest()[:16]
            ckey = f"{prefix}:trans:{target_iso}:{h}"
            try:
                cached_val = await cache.get(ckey)
            except Exception:
                cached_val = None

            if cached_val is not None:
                results[idx] = cached_val
            else:
                miss_indices.append(idx)
                miss_texts.append(t)

        if not miss_texts:
            return [r if r is not None else "" for r in results]

        # Mask non-translatable elements across cache misses only
        masked_texts: List[str] = []
        stores: List[Dict[str, str]] = []
        for t in miss_texts:
            masked, store = TextProtectionHandler.mask(t or "")
            masked_texts.append(masked)
            stores.append(store)

        # Try Google Cloud Translation
        translated_masked = None
        client = self._get_cloud_translate_client()
        if client is not None:
            try:
                loop = asyncio.get_event_loop()
                # Run sync Google Cloud translate in thread pool with 100-item chunks
                def _call_gcp():
                    all_res = []
                    for ci in range(0, len(masked_texts), 100):
                        batch = masked_texts[ci : ci + 100]
                        res = client.translate(
                            batch,
                            target_language=target_iso,
                            source_language=source_iso,
                            format_="text",
                        )
                        if isinstance(res, dict):
                            all_res.append(res.get("translatedText", ""))
                        elif isinstance(res, list):
                            all_res.extend(item.get("translatedText", "") for item in res)
                    return all_res

                translated_masked = await loop.run_in_executor(None, _call_gcp)
                logger.debug(f"Successfully translated {len(miss_texts)} texts using Google Cloud Translate ({target_iso}).")
            except Exception as gcp_err:
                logger.warning(
                    f"Google Cloud Translate API failed ({gcp_err}). Falling back to Gemini Vertex AI translation..."
                )
                self._cloud_translate_failed = True

        # Fallback to Gemini Vertex AI
        if not translated_masked or len(translated_masked) != len(miss_texts):
            translated_masked = await self._translate_with_gemini(
                masked_texts, target_language=target_language, source_language=source_language
            )

        # Unmask non-translatable entities and persist to translation memory cache
        for idx_in_miss, (translated, store) in enumerate(zip(translated_masked, stores)):
            final = TextProtectionHandler.unmask(translated, store)
            original_idx = miss_indices[idx_in_miss]
            results[original_idx] = final

            orig_text = miss_texts[idx_in_miss]
            h = hashlib.sha256(orig_text.strip().encode("utf-8")).hexdigest()[:16]
            ckey = f"{prefix}:trans:{target_iso}:{h}"
            try:
                await cache.set(ckey, final, ttl_seconds=ttl)
            except Exception:
                pass

        return [r if r is not None else "" for r in results]

    async def _translate_with_gemini(
        self,
        masked_texts: List[str],
        target_language: str,
        source_language: str = "en",
    ) -> List[str]:
        """Translates texts using Gemini Vertex AI model with strict instruction to preserve sentinel tokens."""
        if getattr(self, "_gemini_failed", False):
            logger.debug("Gemini translation disabled due to previous permission/service failure. Returning original texts.")
            return masked_texts

        target_info = get_language_info(target_language)
        target_name = target_info.name
        target_native = target_info.native_name

        from app.llm.factory import get_vision_llm
        llm = get_vision_llm(timeout=90, max_retries=3, rate_limit_rps=1.0)

        # Chunk large lists into manageable batches of 10 items
        batch_size = 10
        chunks = [
            (idx, masked_texts[i : i + batch_size])
            for idx, i in enumerate(range(0, len(masked_texts), batch_size))
        ]

        sem = asyncio.Semaphore(2)

        async def _translate_single_chunk(chunk_idx: int, chunk: List[str]) -> Tuple[int, List[str]]:
            if getattr(self, "_gemini_failed", False):
                return chunk_idx, list(chunk)

            async with sem:
                if getattr(self, "_gemini_failed", False):
                    return chunk_idx, list(chunk)

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

                chunk_results: List[str] = []
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
                        chunk_results = [str(item) for item in parsed]
                    else:
                        logger.warning(
                            f"Gemini translated length mismatch in chunk {chunk_idx}: expected {len(chunk)}, got {len(parsed) if isinstance(parsed, list) else 0}"
                        )
                        for idx, orig in enumerate(chunk):
                            if isinstance(parsed, list) and idx < len(parsed):
                                chunk_results.append(str(parsed[idx]))
                            else:
                                chunk_results.append(orig)
                except Exception as e:
                    err_msg = str(e)
                    if "PERMISSION_DENIED" in err_msg or "403" in err_msg or "aiplatform.endpoints.predict" in err_msg:
                        self._gemini_failed = True
                        logger.warning(
                            f"Vertex AI Gemini endpoint permission denied: {e}. Circuit breaker tripped; skipping remaining Gemini chunks."
                        )
                    else:
                        logger.error(f"Gemini translation call failed for chunk {chunk_idx}: {e}. Returning original text.")
                    chunk_results = list(chunk)

                return chunk_idx, chunk_results

        tasks = [_translate_single_chunk(idx, chunk) for idx, chunk in chunks]
        completed = await asyncio.gather(*tasks)
        # Sort by original chunk index to ensure preserved ordering
        completed.sort(key=lambda x: x[0])

        all_results: List[str] = []
        for _, c_res in completed:
            all_results.extend(c_res)

        return all_results
