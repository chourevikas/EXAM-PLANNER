import asyncio
from typing import Any, Dict, List, Optional
import httpx

from app.config.logger import setup_logger
from app.config.settings import get_settings

logger = setup_logger("JinaReranker")


class JinaReranker:
    """Client for Jina AI Reranker API (jina-reranker-v3.5)."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.JINA_API_KEY
        self.model = model or settings.JINA_RERANKER_MODEL
        self.endpoint = "https://api.jina.ai/v1/rerank"

        if not self.api_key:
            logger.warning("JINA_API_KEY is not set. Reranker calls will fail until configured.")

    async def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: Optional[int] = None,
        max_retries: int = 3,
        base_backoff_sec: float = 2.0,
    ) -> List[Dict[str, Any]]:
        """
        Rerank a list of documents against the query.
        Returns a list of dicts: [{'index': int, 'relevance_score': float, 'document': ...}, ...]
        sorted by relevance_score descending.
        """
        if not documents:
            return []

        if not self.api_key:
            logger.error("JINA_API_KEY is missing. Cannot call Jina Reranker.")
            # Fallback: preserve original order with synthetic decreasing scores
            return [
                {"index": idx, "relevance_score": round(1.0 - (idx * 0.01), 3), "document": doc}
                for idx, doc in enumerate(documents[:top_n] if top_n else documents)
            ]

        payload = {
            "model": self.model,
            "query": query,
            "documents": documents,
        }
        if top_n is not None:
            payload["top_n"] = top_n

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(1, max_retries + 1):
                try:
                    resp = await client.post(self.endpoint, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data.get("results", [])
                    elif resp.status_code == 429:
                        backoff = base_backoff_sec * (2 ** (attempt - 1))
                        logger.warning(
                            f"Jina 429 Rate Limit hit. Backing off for {backoff:.1f}s (attempt {attempt}/{max_retries})"
                        )
                        await asyncio.sleep(backoff)
                    elif resp.status_code >= 500:
                        backoff = base_backoff_sec * attempt
                        logger.warning(
                            f"Jina server error {resp.status_code}. Retrying in {backoff:.1f}s"
                        )
                        await asyncio.sleep(backoff)
                    else:
                        logger.error(f"Jina rerank failed: HTTP {resp.status_code} - {resp.text[:300]}")
                        break
                except (httpx.ConnectError, httpx.ReadTimeout) as net_err:
                    backoff = base_backoff_sec * attempt
                    logger.warning(f"Network error calling Jina: {net_err}. Retrying in {backoff:.1f}s")
                    await asyncio.sleep(backoff)

        # Fallback on failure
        logger.warning("Jina rerank failed completely; returning original order as fallback.")
        return [
            {"index": idx, "relevance_score": round(1.0 - (idx * 0.01), 3), "document": doc}
            for idx, doc in enumerate(documents[:top_n] if top_n else documents)
        ]

