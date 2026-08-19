# Module Specification: LLM Provider Layer (`llm/`)

## Overview
The `llm` module provides rate-limited vision LLM instances using Google Gemini models via Vertex AI (`ChatVertexAI`) authenticated via GCP Service Account JSON key credentials, with optional fallback for OpenAI (`ChatOpenAI`).

## Rate Limiting & Resilience
- **Global Rate Limiter**: `InMemoryRateLimiter(requests_per_second=0.5, max_bucket_size=5)` enforces a 30 req/min limit to prevent 429 Rate Limit Exceeded errors during parallel page extractions.
- **Retries & Timeouts**: Configured with `max_retries=10` and `timeout=120` seconds.
- **Factory**: `get_vision_llm()` initializes structured output vision instances using Vertex AI Service Account credentials (`GOOGLE_APPLICATION_CREDENTIALS`).

