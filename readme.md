# ExamPlanner

ExamPlanner (examplanner.in) is a practice and analytics platform for competitive exams such as UPSC and MPSC. Students take previous-year papers and mock tests, see solutions, and get detailed performance reports. Staff upload exam PDFs, which an AI pipeline turns into reviewed questions and solutions.

## Repository layout

| Path | What it is | Stack | Dev port |
| --- | --- | --- | --- |
| `apps/backend` | API, exam ingestion pipeline, analytics | FastAPI, SQLModel, Alembic, Celery | 8000 |
| `apps/frontend` | Student, teacher and admin web app | React 18, Vite | 3000 |
| `apps/marketing` | Public SEO pages (home, pricing, exams, current affairs, legal) | Astro (SSR) | 4321 |
| `apps/superadmin` | Separate Super Admin app | React 18, Vite | 3001 |
| `deploy/nginx` | Host nginx config for examplanner.in | nginx | |
| `docs/`, `specs/` | Specs, architecture and onboarding notes | | |

`apps/frontend` and `apps/superadmin` are npm workspaces of the root `package.json`.

## Local development

### Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- Docker, for Postgres (Redis is optional)

### 1. Configuration

```bash
cp .env.example .env
```

The backend and the frontend both read the **repo-root `.env`**. `apps/frontend/.env` can override frontend values. For local work, set at least:

```dotenv
DATABASE_URL=postgresql://examplanner:examplanner@localhost:5432/examplanner_dev
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # Google sign-in on the frontend
CLERK_SECRET_KEY=sk_test_...             # Google sign-in on the backend (required)
```

`.env.example` lists every setting, including the LLM provider, storage, cache, Celery and security options. Never commit `.env` files or service-account keys.

### 2. Database

```bash
docker compose up -d postgres       # Postgres 16 on localhost:5432
cd apps/backend
uv sync
uv run alembic upgrade head
```

To get the full set of local services (Redis, MinIO, Flower, Redis UIs), use `docker-compose.dev.yml` instead.

### 3. Run the apps

```bash
# API, from apps/backend
uv run uvicorn app.fastapi_server:app --reload --port 8000

# Web app, from the repo root
npm install
npm run dev --workspace apps/frontend      # http://localhost:3000, proxies /api to :8000

# Optional
npm run dev --workspace apps/superadmin    # http://localhost:3001
cd apps/marketing && npm install && npm run dev   # http://localhost:4321

# Background pipeline worker (needs Redis), from apps/backend
uv run worker.py
```

To create a Super Admin, run `uv run python -m app.scripts.init_superadmin` from `apps/backend` with `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` set. See [docs/SUPERADMIN_APP_AND_STAFF_ONBOARDING.md](docs/SUPERADMIN_APP_AND_STAFF_ONBOARDING.md).

## Authentication

- **Students** sign in with email and password, or with **Google**. Google sign-in goes through Clerk, and **Clerk is used for nothing else.** The frontend sends the Clerk token once to `POST /api/v1/auth/clerk-exchange`. The backend verifies it against our Clerk instance, reads the user's verified Google email from Clerk's API, and issues its own session tokens. Email fields sent by the browser are ignored.
- **Admins and teachers** sign in with email and password on the main app. They are created by a Super Admin and must change their temporary password on first sign-in.
- **Super Admins** sign in only through `apps/superadmin`, with a password and an authenticator app (TOTP).
- Every other API call uses the backend's own JWT. The refresh token is kept in an HttpOnly cookie.

## Tests

```bash
cd apps/backend
uv run pytest tests
```

The tests use in-memory SQLite and don't need Postgres. Two test files, `test_auth.py` and `test_bookmarks.py`, can fail with a connection error when the whole suite runs together, because another test module clears their database override. They pass when run on their own.

Frontend type-check and build:

```bash
npm run build --workspace apps/frontend
```

## Deployment

On pushes to the configured branches, GitHub Actions ([.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml)) builds Docker images and publishes them to GHCR. The server runs them with [docker-compose.prod.yml](docker-compose.prod.yml):

| Service | Bound to | Notes |
| --- | --- | --- |
| `api` | `127.0.0.1:8000` | Reached only through the web container's nginx (`/api/`) |
| `web` | `127.0.0.1:3000` | SPA plus API proxy, with per-IP rate limits on solution endpoints |
| `marketing` | `127.0.0.1:3020` | Astro SSR |
| `superadmin` | `127.0.0.1:3010` | Put it behind its own host with TLS and an IP allowlist or VPN |

The host nginx ([deploy/nginx/examplanner.in.conf](deploy/nginx/examplanner.in.conf)) terminates TLS and routes marketing paths to `marketing` and everything else to `web`. Keep every container port on `127.0.0.1`. Docker's published ports bypass `ufw`, so the bind address is what keeps them private.

Production checklist:

- `ENVIRONMENT=production` and a long random `SECRET_KEY`. The API refuses to start in production with the default key.
- `CLERK_SECRET_KEY` set, otherwise Google sign-in returns 503. `CLERK_AUTHORIZED_PARTIES=https://examplanner.in` is optional but recommended.
- `COOKIE_SECURE=true` when served over HTTPS.
- Run `alembic upgrade head` before starting a new API image.

## Security rules for contributors

- Every endpoint that takes a user, attempt or other per-user ID must check that the caller owns it, or that the caller is staff. For an object owned by someone else, return 404, not 403, so its existence isn't confirmed.
- Whole-exam answer data (`/exams/{id}/review-questions`, `/solutions`, `/integrity-questions`) is staff-only. Per-question solutions are public so guests can practise, and nginx rate-limits them.
- Admin-only jobs and triggers need `require_roles` or `require_admin_section`.
- Don't render user or question content with `dangerouslySetInnerHTML`. Use `ReactMarkdown`, which doesn't render raw HTML.
- Don't commit secrets, logs, database dumps or one-off scripts. Put maintenance scripts in `apps/backend/app/scripts/`.

## More docs

- [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md): product overview
- [docs/architecture_diagram.md](docs/architecture_diagram.md) and [docs/database_diagram.md](docs/database_diagram.md)
- [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md)
- [docs/celery_pipeline_integration_guide.md](docs/celery_pipeline_integration_guide.md): exam ingestion pipeline
- [HLD_LLD_BACKEND.md](HLD_LLD_BACKEND.md) and [HLD_LLD_FRONTEND.md](HLD_LLD_FRONTEND.md)
