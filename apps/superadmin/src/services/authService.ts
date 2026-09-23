import { AuthResponse, User } from '../types/auth';
import {
  API_BASE,
  apiFetch,
  clearSession,
  errorMessage,
  getStoredUser,
  getToken,
  refreshSession,
  storeSession,
} from './http';

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/** Thrown when the password was right but the account needs an authenticator code as well. */
export class MfaRequiredError extends Error {
  constructor() {
    super('MFA_REQUIRED');
    this.name = 'MfaRequiredError';
  }
}

/** Sign in with email + password (+ authenticator or recovery code). Only Super Admin accounts may hold a session here. */
export async function login(email: string, password: string, otp?: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role: SUPER_ADMIN_ROLE, otp: otp || undefined }),
  });

  if (!res.ok) {
    const message = await errorMessage(res, '');
    if (res.status === 401 && message === 'MFA_REQUIRED') throw new MfaRequiredError();
    if (res.status === 401 && /authentication code/i.test(message)) throw new Error(message);
    if (res.status === 429) throw new Error(message || 'Too many failed sign-in attempts. Try again later.');
    // Deliberately vague for wrong role vs wrong password so the form does not reveal which accounts exist.
    if (res.status === 401 || res.status === 403) {
      if (/inactive|suspend|pending|rejected/i.test(message)) throw new Error(message);
      throw new Error('Invalid email or password.');
    }
    throw new Error(message || 'Could not sign in. Please try again.');
  }

  const data: AuthResponse = await res.json();
  if (!data.access_token || !data.user) throw new Error('Could not sign in. Please try again.');

  if (data.user.role !== SUPER_ADMIN_ROLE) {
    // Defence in depth: the server already checks `role`, but never keep a non-super-admin session here.
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${data.access_token}` },
    }).catch(() => undefined);
    throw new Error('Invalid email or password.');
  }

  storeSession(data.access_token, data.user);
  return data.user;
}

export async function logout(): Promise<void> {
  const token = getToken();
  clearSession();
  if (token) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
}

/** Restore the session on page load: use the stored token, else try the refresh cookie. */
export async function restoreSession(): Promise<User | null> {
  const stored = getStoredUser();
  if (stored && getToken()) return stored;
  return (await refreshSession()) ? getStoredUser() : null;
}

/** Set a new password (clears the temporary-password flag) and swap in the fresh session. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<User> {
  const res = await apiFetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not change the password.'));

  const data: AuthResponse = await res.json();
  if (!data.access_token || !data.user) throw new Error('Could not change the password.');
  storeSession(data.access_token, data.user);
  return data.user;
}


export interface MfaSetup {
  secret: string;
  otpauth_uri: string;
}

let mfaSetupInFlight: Promise<MfaSetup> | null = null;

/** Begin enrolling an authenticator app; returns the secret and the otpauth:// URI for the QR code. */
export function startMfaSetup(): Promise<MfaSetup> {
  // Concurrent callers (e.g. React StrictMode mounting twice) share one request.
  if (!mfaSetupInFlight) {
    mfaSetupInFlight = (async () => {
      const res = await apiFetch(`${API_BASE}/auth/mfa/setup`, { method: 'POST' });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not start authenticator setup.'));
      return (await res.json()) as MfaSetup;
    })().finally(() => {
      mfaSetupInFlight = null;
    });
  }
  return mfaSetupInFlight;
}

/** Confirm a code from the authenticator app. Returns the one-time recovery codes (shown once). */
export async function confirmMfaSetup(code: string): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/auth/mfa/verify`, { method: 'POST', body: JSON.stringify({ code }) });
  if (!res.ok) throw new Error(await errorMessage(res, 'That code is not valid.'));
  const data = await res.json();
  return data.recovery_codes as string[];
}

/** Re-read the signed-in user (e.g. after enrolling) and keep the stored session in step. */
export async function refreshCurrentUser(): Promise<User> {
  const res = await apiFetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load your account.'));
  const user: User = await res.json();
  const token = getToken();
  if (token) storeSession(token, user);
  return user;
}
