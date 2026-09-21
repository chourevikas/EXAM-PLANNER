# Super Admin app, staff onboarding and remaining hardening

Status as of 2026-09-22. Sections 1-4 are built and tested. "Before you deploy" lists what only an operator can do.

## Why

Super Admin used to be a route in the same Vite app (and the same browser origin) as the student app, with a 30-day access token in `localStorage`. An XSS bug anywhere in the student app could have stolen a Super Admin token. Separating the Super Admin UI onto its own origin isolates that storage, and lets us apply stricter CSP and network rules to it. A separate origin does **not** replace server-side authorization; see "Hardening" and "Not done".

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

## 4. Hardening (built)

**Sign-in and sessions**
- **Authenticator app (TOTP) for Super Admins**, mandatory by default (`SUPERADMIN_MFA_REQUIRED`). A Super Admin without one can sign in with the password but is confined to enrolment (`403 MFA_SETUP_REQUIRED`) until they scan the QR code and confirm a code. Enrolment issues 8 one-time recovery codes (shown once, stored hashed). Codes cannot be replayed. Secrets are encrypted at rest with a key derived from `SECRET_KEY`.
- Lost authenticator and no recovery codes: run `python -m app.scripts.reset_mfa <email>` on the server; the next sign-in forces a new enrolment. Rotating `SECRET_KEY` also invalidates enrolled authenticators.
- **Lockout**: 5 failed sign-ins (`LOGIN_MAX_FAILED_ATTEMPTS`) lock that email for 15 minutes (`LOGIN_LOCKOUT_MINUTES`) with `429` + `Retry-After`; wrong current-password attempts on change-password and wrong MFA codes count too. Trade-off: someone can deliberately lock a known address for 15 minutes. It only blocks new sign-ins, never existing sessions.
- **Short Super Admin sessions**: access tokens last 30 minutes (`SUPERADMIN_ACCESS_TOKEN_EXPIRE_MINUTES`); the app refreshes silently. Admin and Teacher tokens are unchanged (30 days).
- Refresh cookie: `Secure` when `COOKIE_SECURE=true`; `SameSite=Strict` for the Super Admin app, `Lax` otherwise.
- Google (Clerk) sign-in can no longer be linked to an existing Admin/Teacher/Super Admin account by matching email, and never works for a Super Admin (it would skip the second factor). Staff who already had a linked Google identity keep working.

**Where a Super Admin can act from**
- With `SUPERADMIN_APP_ENFORCED=true`, a Super Admin can sign in, refresh and call the API only through the Super Admin app, identified by the `X-Client-App: superadmin` header its nginx (and the Vite dev proxy) sets; the main app's nginx sets `web`. From anywhere else sign-in looks exactly like a wrong password and an existing token gets `403 SUPERADMIN_APP_REQUIRED`. **Off by default** so nothing locks out before that app is live.
- This is only a hard guarantee if callers cannot reach the API directly and forge the header, so keep port 8000 private (the prod compose still publishes it; restrict it in the security group or bind it to loopback).
- `SUPER_ADMIN` can no longer be granted through the API (`PUT /users/{id}`, `POST /admin/users/{id}/role`, the UI dropdown). Provision Super Admins with `app.scripts.init_superadmin`.

**Audit trail**
- `admin_action_logs` (migration 052) records staff creation, credential resends, role changes, suspend/reactivate, deletes, Super Admin sign-ins and failures, lockouts, password changes, MFA enrolment/recovery-code use/reset. `GET /admin/action-logs` (Super Admin only) feeds the new **Activity Log** tab.

**Configuration hygiene**
- CORS is an explicit allowlist (dev origins, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`); no wildcard. Production traffic is same-origin through nginx.
- In production `/docs`, `/redoc` and `openapi.json` are disabled.
- **In production the API refuses to start with the built-in default `SECRET_KEY`** (anyone could forge tokens with it), and `init_superadmin` refuses the default password. Outside production it only warns.
- Removed: the Pending Approvals tab and card (nobody can sign up as a pending admin any more). The `/admin/approve|reject` endpoints and the Approval Audit Logs tab remain for history.

## 5. Delivery (built)

- `docker-compose.prod.yml`: new `superadmin` service (`examplanner-superadmin` image), bound to `127.0.0.1:3010`.
- `.github/workflows/docker-publish.yml`: new build/push job for that image; the deploy job waits for it; the main web image is built with `VITE_SUPERADMIN_URL=${{ vars.SUPERADMIN_URL }}`.
- `.env.example` documents the new settings.

## Before you deploy (operator checklist)

1. **Set `SECRET_KEY` in the production environment first** (long random value). Otherwise the API will not start. This signs every user out once.
2. Set `COOKIE_SECURE=true` if the site is served over HTTPS; set `SUPERADMIN_PASSWORD`/`SUPERADMIN_EMAIL` to real values.
3. Create a GitHub Actions **repository variable** `SUPERADMIN_URL` (e.g. `https://superadmin.<domain>`), otherwise the main app cannot tell a Super Admin where to sign in.
4. DNS, a TLS certificate and a reverse-proxy server block for the Super Admin host that forwards to `127.0.0.1:3010`; restrict that host (VPN / IP allowlist / Cloudflare Access).
5. Make port 8000 unreachable from outside (or bind it to loopback) before turning on `SUPERADMIN_APP_ENFORCED=true`; turn that on only once the Super Admin host works.
6. Each existing Super Admin will be asked to enrol an authenticator at their next sign-in on the Super Admin app. Do that promptly and store the recovery codes.
7. The deploy step runs `alembic upgrade head || true`, so check the migration really applied (`alembic current` shows `052_superadmin_mfa_action_log`); a failed migration is silent.

## Not done

- **Access-token revocation on logout**: tokens are self-contained JWTs, so logout ends the refresh session but an already-issued access token works until it expires. Super Admin tokens expire in 30 minutes; Admin/Teacher tokens still last 30 days.
- **MFA for Admins and Teachers**, and a shorter lifetime for their tokens (the main app's staff screens use plain `fetch` without 401-retry, so this needs frontend work first).
- **S3 bucket CORS** is still `*`. It is credential-less and only affects reads of already-public objects; changing it rewrites the live bucket policy at every start, so it needs the exact production origins first.
- **Rate limiting `/auth/clerk-exchange`**: it requires a token signed by Clerk, so it cannot be brute-forced; it is not throttled.
- Moving Admin/Teacher to their own origin (same pattern as the Super Admin app).

## Tests

- Backend: `tests/test_role_escalation.py`, `tests/test_staff_creation.py`, `tests/test_superadmin_hardening.py` (lockout, MFA enrolment and sign-in, replay, recovery codes, app confinement, cookies, Clerk linking, audit log, CORS, production secret check), `tests/test_totp.py` (RFC 6238 vectors). `tests/conftest.py` turns Super Admin MFA off for other tests.
- Browser (Playwright, run manually against a backend with mail disabled): Super Admin login, forced authenticator enrolment (QR, recovery codes), TOTP and recovery-code sign-in, replay refusal, staff creation, activity log, student sign-up, staff forced password change, app separation and lockout.
- Known failing before this work, unrelated: `test_admin_notifications`, `test_bookmarks`, `test_exam_deletion_and_overwrite` (stale against current routers / dev-DB dependent).
