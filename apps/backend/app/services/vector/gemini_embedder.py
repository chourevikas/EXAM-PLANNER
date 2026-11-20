import asyncio
import hashlib
from typing import List, Optional
import httpx

from app.config.logger import setup_logger
from app.config.settings import get_settings

logger = setup_logger("GeminiEmbedder")


def compute_sha256(text: Optional[str]) -> Optional[str]:
    """Compute SHA-256 hash of text for change detection."""
    if not text:
        return None
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


class GeminiEmbedder:
    """Gemini Developer API embedder using normal (single-content) embedContent API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, dim: Optional[int] = None):
        settings = get_settings()
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_EMBEDDING_MODEL
        self.dim = dim or settings.GEMINI_EMBEDDING_DIM
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/{self.model}:embedContent"

        if not self.api_key:
            logger.warning("GEMINI_API_KEY is not set. Embedding calls will fail until configured.")

    async def embed_text(
        self,
        text: str,
        client: Optional[httpx.AsyncClient] = None,
        max_retries: int = 5,
        base_backoff_sec: float = 2.0,
    ) -> Optional[List[float]]:
        """Generate a dense embedding vector using the normal (single-content) embedContent API."""
        clean_text = (text or "").strip()
        if not clean_text:
            return None

        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required to generate embeddings.")

        url = f"{self.base_url}?key={self.api_key}"
        payload = {
            "content": {
                "parts": [{"text": clean_text}]
            },
            "output_dimensionality": self.dim,
        }

        should_close_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=30.0)
            should_close_client = True

        try:
            for attempt in range(1, max_retries + 1):
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        values = data.get("embedding", {}).get("values")
                        return values
                    elif resp.status_code == 429:
                        # Rate limit reached: exponential backoff
                        backoff = base_backoff_sec * (2 ** (attempt - 1))
                        logger.warning(
                            f"Gemini 429 Rate Limit hit. Backing off for {backoff:.1f}s (attempt {attempt}/{max_retries})"
                        )
                        await asyncio.sleep(backoff)
                    elif resp.status_code >= 500:
                        backoff = base_backoff_sec * attempt
                        logger.warning(
                            f"Gemini server error {resp.status_code}. Retrying in {backoff:.1f}s (attempt {attempt}/{max_retries})"
                        )
                        await asyncio.sleep(backoff)
                    else:
                        logger.error(f"Gemini embedContent failed: HTTP {resp.status_code} - {resp.text[:300]}")
                        return None
                except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as net_err:
                    backoff = base_backoff_sec * attempt
                    logger.warning(f"Network error calling Gemini: {net_err}. Retrying in {backoff:.1f}s")
                    await asyncio.sleep(backoff)

            logger.error(f"Failed to generate embedding after {max_retries} attempts.")
            return None
        finally:
            if should_close_client:
                await client.aclose()

    async def embed_texts_concurrent(
        self,
        texts: List[str],
        max_concurrency: int = 10,
    ) -> List[Optional[List[float]]]:
        """
        Embed a list of texts concurrently using individual normal embedContent API calls.
        Controlled by an asyncio.Semaphore to respect RPM limits.
        """
        semaphore = asyncio.Semaphore(max_concurrency)
        async with httpx.AsyncClient(timeout=45.0) as client:
            async def _worker(t: str) -> Optional[List[float]]:
                async with semaphore:
                    return await self.embed_text(t, client=client)

            tasks = [_worker(t) for t in texts]
            return await asyncio.gather(*tasks)

