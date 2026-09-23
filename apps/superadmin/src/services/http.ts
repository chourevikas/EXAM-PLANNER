import { AuthResponse, User } from '../types/auth';

/**
 * Session + HTTP plumbing for the Super Admin app.
 *
 * The access token lives in sessionStorage (gone when the tab closes); the long-lived credential is
 * the httpOnly refresh cookie the backend sets on this origin, so a fresh tab restores the session
 * through POST /auth/refresh without any long-lived secret sitting in JavaScript-readable storage.
 */

const TOKEN_KEY = 'sa_access_token';
const USER_KEY = 'sa_user';

export const API_BASE = '/api/v1';
export const PASSWORD_CHANGE_REQUIRED_EVENT = 'sa:password-change-required';
export const SESSION_EXPIRED_EVENT = 'sa:session-expired';
export const MFA_SETUP_REQUIRED_EVENT = 'sa:mfa-setup-required';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: User): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function authHeader(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken() || ''}`,
    'Content-Type': 'application/json',
  };
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchange the refresh cookie for a new access token; concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return false;
        const data: AuthResponse = await res.json();
        if (!data.access_token || !data.user) return false;
        if (data.user.role !== 'SUPER_ADMIN') {
          // Not a super admin session: revoke it and keep nothing.
          await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: { Authorization: `Bearer ${data.access_token}` },
          }).catch(() => undefined);
          return false;
        }
        storeSession(data.access_token, data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/** fetch() with the bearer token attached; refreshes once on 401 and flags a forced password change. */
export async function apiFetch(input: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = { ...authHeader(), ...(init.headers as Record<string, string> | undefined) };
  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status === 401 && !retried) {
    if (await refreshSession()) return apiFetch(input, init, true);
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    return res;
  }

  if (res.status === 403) {
    const body = await res
      .clone()
      .json()
      .catch(() => null);
    if (body?.detail === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new Event(PASSWORD_CHANGE_REQUIRED_EVENT));
    } else if (body?.detail === 'MFA_SETUP_REQUIRED') {
      window.dispatchEvent(new Event(MFA_SETUP_REQUIRED_EVENT));
    }
  }
  return res;
}

/** Readable message from a FastAPI error body (string detail, or a list of validation errors). */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (typeof body?.detail === 'string') return body.detail;
  if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  return fallback;
}
