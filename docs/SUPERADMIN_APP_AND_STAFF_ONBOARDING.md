# Super Admin app, staff onboarding and remaining hardening

Status as of 2026-09-21. The first three sections are built and tested; the rest is the remaining plan.

## Why

Super Admin used to be a route in the same Vite app (and the same browser origin) as the student app, with a 30-day access token in `localStorage`. An XSS bug anywhere in the student app could have stolen a Super Admin token. Separating the Super Admin UI onto its own origin isolates that storage, and lets us apply stricter CSP and network rules to it. A separate origin does **not** replace server-side authorization; see "Remaining".

## 1. Role-escalation fixes (backend)

- `POST /auth/register` creates **students only**. Any other role, including `ADMIN`, returns 403 (`AuthService.register_user`).
- `PUT /users/{id}` can change `role` only for a Super Admin, and can never grant `SUPER_ADMIN` (`UserService.update_user`). An Admin can still edit a student's name, email and status.

## 2. Staff accounts are created only by a Super Admin

- `POST /users` (SUPER_ADMIN only) takes `{email, full_name, role: ADMIN|TEACHER, custom_role_id?}`. A `custom_role_id` makes a sub-admin (its base type must match `role`). There is no password field.
- The server generates a 12-character temporary password, stores only the hash, creates the user `ACTIVE` with `must_change_password=true`, and emails the password (`email_service.send_staff_welcome_email`: SMTP, then AWS SES, then a dev fallback that never logs the password). The response never contains the password and reports `email_sent`.
- While `must_change_password` is set, `get_current_user` returns 403 `PASSWORD_CHANGE_REQUIRED` for everything except `/auth/me`, `/auth/change-password` and `/auth/logout`.
- `POST /auth/change-password` (current + new password, min 8 chars) clears the flag, revokes older sessions and returns a fresh one. The existing `/auth/reset-password` link also clears the flag.
- `POST /users/{id}/resend-credentials` (SUPER_ADMIN) issues a new temporary password to an Admin or Teacher; the old one stops working. Use it when the email failed or was lost.
- Migration `051_add_must_change_password`.

Note: a backend with AWS credentials (the dev `.env` has them) really sends this email. Use a backend without mail credentials, or mock the sender, when creating throwaway staff.

## 3. Separate Super Admin app (`apps/superadmin`)

- Own Vite + React app, own origin (dev: `http://localhost:3001`). Contains only the Super Admin portal, email/password login (no Clerk, no Google), and the forced change-password page. Includes a **Create user** modal and a **Resend password** row action.
- API access is same-origin: Vite dev proxy (`API_PROXY_TARGET`, default `http://127.0.0.1:8000`) and `nginx.conf` in production proxy `/api` to the backend. No CORS or cross-site cookies.
- Session: access token in `sessionStorage`; the long-lived credential is the httpOnly refresh cookie on that origin. The app rejects and revokes any non-Super-Admin session.
- `nginx.conf` sets CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` and `noindex`.
- The main app (`apps/frontend`) no longer contains `/superadmin`. If a Super Admin signs in there, the session is revoked immediately, nothing is stored, and they are pointed at `VITE_SUPERADMIN_URL`. Admins and Teachers created by a Super Admin sign in on the main app and are forced to `/change-password` first.
- Local run: `npm install` at the repo root (both apps are workspaces), then `npm run dev --workspace apps/superadmin`.

## Remaining

Server-side (highest value first):
- **Enforce the separation on the server.** Today the main app's UI refuses Super Admins, but `/auth/login` will still issue them a token to any client. Add an audience/host check (for example an `aud=superadmin` claim or an origin allowlist verified in `get_current_user`) so a Super Admin token only works from the Super Admin app.
- CORS: replace `"*"` with an env-driven allowlist (`fastapi_server.py`, `storage/s3.py`).
- Rate limiting and lockout on `/auth/login` and `/auth/clerk-exchange`.
- Replace default `SECRET_KEY` and `SUPERADMIN_PASSWORD` (`config/settings.py`); rotate if the defaults were ever used.
- Clerk sign-in links to existing accounts by email without a verified-email check, which can take over a password-based admin. Block Clerk linking for ADMIN and SUPER_ADMIN.
- Cookies: `Secure=True`, explicit `Path`; shorter access-token lifetime for staff; make logout invalidate access tokens; gate `/docs`, `/redoc`, `openapi.json` in production.

Infra (outside the repo, needs a decision on where TLS terminates):
- DNS + certificate for the Super Admin host; add an `examplanner-superadmin` service to `docker-compose.prod.yml` and a build/push job in `.github/workflows/docker-publish.yml`.
- Pass `VITE_SUPERADMIN_URL` as a build arg when building the main app image (the Dockerfile accepts it; it is empty in production builds if unset).
- Network controls on the Super Admin host: VPN or IP allowlist (or Cloudflare Access).

Hardening and cleanup:
- MFA for staff (the profile "Two-Factor" toggle is not real). Audit log for staff creation, credential resends and role changes.
- The "Pending Approvals" tab and `/admin/approve|reject` are now vestigial (nobody can sign up as a pending admin). Remove them in a later cleanup.
- The role dropdown in the Super Admin users tab can still promote to `SUPER_ADMIN` through `POST /admin/users/{id}/role`. That is Super Admin only, but consider removing it.
- Admins and Teachers stay in the main app. Moving them to their own origin is the same pattern as this app if wanted later.

## Tests

- Backend: `tests/test_role_escalation.py`, `tests/test_staff_creation.py` (HTTP-level: creation, single email, gate, change-password, resend, sub-admin, email failure).
- Browser (Playwright, run manually): Super Admin login and creation flow, student sign-up, staff forced password change on the main app, resend, and the separation checks in both directions.
- Known failing before this work, unrelated: `test_admin_notifications`, `test_bookmarks`, `test_exam_deletion_and_overwrite` (stale against current routers / dev-DB dependent).
