# Internal Release Checklist — 100 Users

24 Oct 2026 · Pankaj Pandey · Live copy: [Claude Doc](https://claude.ai/artifact/MoTAHbjhXeEBGZpfJggMpw)

## Summary

The product is close to ready for 100 internal users; what's left is mostly ops work, not features. Phases 0.2 to 8 are merged into `release/0.0.1` (latest: PR #67, calendar feed, migration `071`). Payments stay off, and Pro is granted by hand.

State of the branch on 24 Oct 2026:

- Backend tests: 371 passed, 4 failed (admin notifications, exam delete, two review-auth tests).
- Frontend type-check: clean.
- CI builds images and deploys on push to `release/0.0.1`. It runs no tests, and `alembic upgrade head || true` hides a failed migration.
- No error tracking, no uptime check, and no database backup found in the repo.

The things to settle first are in Blockers below.

## Blockers (before inviting anyone)

- [ ] **Production DB at the latest migration** (`072` once this branch is merged). Run `alembic upgrade head` by hand and confirm `alembic current`; the CI step's `|| true` won't tell you if it failed.
- [ ] **Daily database backup** with one test restore. Nothing in the repo does this today.
- [ ] **Fix or triage the 4 failing backend tests.** Two look stale (a test reads `.total` off a `JSONResponse`); confirm the review-auth and exam-delete ones aren't real permission bugs.
- [ ] **Host nginx installed** from `deploy/nginx/examplanner.in.conf`, with TLS, and `COOKIE_SECURE=true` in the API `.env` (it defaults to false).
- [ ] **Smoke test on production** as a free student, a Pro student and an admin, at desktop and phone widths: sign in, practice, take a test, report, planner, leaderboard.
- [ ] **Production Clerk key.** `apps/frontend/Dockerfile` hardcodes a `pk_test_` key, so the production build signs in through the Clerk development instance. Pass the production publishable key as a build argument.
- [ ] **Speed at 100 students.** 30 students locally already hit a 9.9 s p95; run the load test on staging (Quality section) and fix the slow calls if staging is close.

## Infrastructure and deployment

- [ ] Production `.env` reviewed: `ENVIRONMENT`, `SECRET_KEY` (fresh, not dev), `DATABASE_URL` (Postgres, not the SQLite default), `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CLERK_*`, `MAIL_*` or `AWS_SES_SENDER`, storage (`STORAGE_TYPE`, S3 keys).
- [ ] Redis: prod compose has no Redis service. Point `REDIS_CACHE_URL` at a real Redis, or confirm the in-memory fallback is intended.
- [ ] Run the API as a single uvicorn process. The daily midnight job and the weekly email scheduler run inside it, so more workers would run them twice.
- [ ] Super Admin host behind TLS and an IP allowlist or VPN, as the compose file says.
- [ ] Make the deploy fail on a failed migration (drop `|| true`), and add `pytest` and the frontend build to CI before the deploy job.
- [ ] Tag the release (`v0.0.1`) so a bad deploy can roll back to a known image instead of `latest`.
- [ ] Disk space on the server for `uploads/` and logs, with log rotation.

## Auth, accounts and access

- [ ] Clerk production instance with Google sign-in only; `CLERK_AUTHORIZED_PARTIES` set to the production domain.
- [ ] Google OAuth consent screen published (not "testing"), or the 100 testers added as test users.
- [ ] Decide how to keep it internal: an email allowlist, or accept open sign-up during the test. There's no invite gate in the app today.
- [ ] Decide who gets Pro. Migration `068` gives Pro to existing students only; new testers start free (20 questions a day), so admins must grant Pro by hand if testers should see reports.
- [ ] Staff accounts created with email and password; Super Admin MFA on (`SUPERADMIN_MFA_REQUIRED`).
- [ ] Login lockout (5 attempts) and nginx rate limits checked on production.

## Product features and content

Everything the client confirmed is built. These are the content and config gaps that testers would hit.

- [ ] MPSC and BPSC marking schemes entered (6.1).
- [ ] An exam type on every paper, MPSC and BPSC included, so challenges and the planner can offer them (7.4).
- [ ] Production translation credentials, so explanations come in Hindi and Marathi (5.2). Dev credentials can't translate.
- [ ] Enough approved questions per target exam that testers don't run out in week one.
- [ ] Planner: client confirms the free limits (8.5) and the MPSC Prelims syllabus; admins link remaining planner subtopics to the question bank.
- [ ] Hide the admin Mock tests screen, which still shows sample data (0.2).
- [ ] At least one active milestone and the leaderboard snapshot built once after deploy.
- [ ] Marketing site: client signs off the legal pages (privacy, terms, refund are `reviewed: false`) and the MPSC exam guide.

Not needed for this release: Google Calendar sync, mock-test series, push notifications and the on-hold AI features.

## Payments

Payments are not needed for an internal release. The Cashfree branch is still unmerged, and the pricing page shows "Online payment coming soon".

- [ ] Confirm with the client that testers won't pay, and that Pro is granted by admins.
- [ ] Check the pricing page lists only features that exist.

For the public launch later: merge the Cashfree branch with an Alembic merge revision onto `071`, run a sandbox payment end to end, then set production keys and dashboard webhooks (including `DISPUTE_*`).

## Quality, monitoring and support

The code for this section is built and tested on branch `pankajpandey/internal-release-checklist`, not merged yet. What's left is setup on accounts and the server.

- [x] Error tracking in code: Sentry on the API and frontend, off until a DSN is set. A crash now shows a "Something went wrong, reload" screen instead of a blank page, and production 500s no longer return the raw error text.
- [ ] Create the Sentry project. Set `SENTRY_DSN` in the API `.env`, and the repo variables `SENTRY_FRONTEND_DSN` and `SENTRY_ENVIRONMENT` for the web image.
- [x] Health check: `GET /api/v1/health` returns 200 when the database answers, 503 when it doesn't.
- [ ] Point UptimeRobot or Better Stack at `https://examplanner.in/api/v1/health` and the home page, every 5 minutes, alerting by email.
- [x] Log rotation in `docker-compose.prod.yml`: 50 MB × 10 files per service.
- [ ] Set `LOG_LEVEL=INFO` in production; after a week, check the logs cover at least 14 days.
- [x] Test-email script: `python -m app.scripts.send_test_email you@example.com` sends one email through SMTP or SES and fails loudly if neither is set.
- [ ] Run it in the production container to a Gmail and an Outlook address. Check spam and SPF/DKIM/DMARC, then that a real weekly summary and reminder arrive.
- [x] "Report a problem" in the student menu: message, optional screenshot, page and browser. Admins see it under Admin → Feedback (permission `admin.feedback`, migration `072`) and get a Discord ping.
- [ ] Set `DISCORD_ALERT_WEBHOOK_URL` in production and name one person to triage Feedback daily.
- [x] LLM daily budget: `LLM_DAILY_BUDGET_INR` alerts on Discord at 80%. At 100%, report insights use the rule-based text until midnight IST. The default, 0, means no limit.
- [ ] Agree the daily budget with the client and set it.
- [x] Load-test script in `apps/backend/loadtest/` (Locust), with throwaway FREE students from `app.scripts.loadtest_users`.
- [ ] **Run the load test on a staging copy at 100 students.** A local run with 30 students had no errors but was slow: p95 9.9 s overall, 12 s to start a test, 14 s to load its questions (an 890 KB response).

## Launch day and after

1. Freeze `release/0.0.1`; only fixes go in until the test ends.
2. Take a database backup right before the deploy.
3. Deploy, run migrations by hand, and confirm `alembic current` shows the latest migration.
4. Run the production smoke test (Blockers) yourselves.
5. Invite 10 to 20 testers first; open to all 100 after a day with no serious errors.
6. Send testers a short welcome note: how to sign in, what to try, where to report bugs, and that it's a test build.
7. Watch errors and logs closely for the first 48 hours.

After the first week:

- [ ] Review feedback and errors with the client and agree what to fix before a wider launch.
- [ ] Check usage: sign-ups, questions answered per day, tests completed, planner use.
- [ ] Remove the unused `/study-plan/generate-weekly-plan` and `/generate-monthly-plan` endpoints.
- [ ] Start Google OAuth verification early if Calendar sync is planned; it can take weeks.
