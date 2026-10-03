FROM python:3.12-slim
WORKDIR /app
ENV PYTHONPATH=/app

# Install uv
RUN pip install --no-cache-dir uv

# Install dependencies first (cached layer; only rebuilt when pyproject.toml changes)
COPY pyproject.toml .
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy application source (code changes no longer bust the dependency layer)
COPY . .

CMD ["uvicorn", "app.fastapi_server:app", "--host", "0.0.0.0", "--port", "8000"]
