import { UserRole, AuthResponse } from '../types/auth';
import { getGuestAttempts, clearGuestAttempts } from '../utils/guestStorage';
import { guardedFetch, registerTokenRefreshHandler } from '../utils/apiGuard';

const API_BASE_URL = '/api/v1/auth';

let activeRefreshPromise: Promise<string> | null = null;
let refreshTimerId: any = null;

/**
 * Proactive Silent Token Refresh
 * Calculates remaining token lifetime from JWT payload and schedules refresh
 * 2 minutes prior to expiration.
 */
export function scheduleProactiveRefresh(token?: string): void {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }

  const currentToken = token || localStorage.getItem('access_token');
  if (!currentToken) return;

  try {
    const parts = currentToken.split('.');
    if (parts.length !== 3) return;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return;

    const expiresAtMs = payload.exp * 1000;
    const nowMs = Date.now();
    // Proactively refresh 2 minutes (120,000 ms) before expiration
    const refreshDelayMs = expiresAtMs - nowMs - (2 * 60 * 1000);

    if (refreshDelayMs <= 0) {
      refreshAccessToken().catch((err) => {
        console.warn('Immediate proactive refresh failed:', err);
      });
    } else {
      refreshTimerId = setTimeout(() => {
        refreshAccessToken().catch((err) => {
          console.warn('Scheduled silent refresh failed:', err);
        });
      }, Math.min(refreshDelayMs, 2147483647));
    }
  } catch (err) {
    console.warn('Failed to parse JWT for proactive refresh:', err);
  }
}

/**
 * Exchanges the HTTP-only refresh token cookie with /api/v1/auth/refresh for a new access token.
 * In-flight calls are deduplicated so parallel requests share a single refresh execution.
 */
export async function refreshAccessToken(): Promise<string> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const tokenBefore = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API_BASE_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const tokenAfter = localStorage.getItem('access_token');
        if (tokenBefore === tokenAfter) {
          logoutUser();
          window.dispatchEvent(new Event('auth_expired'));
        }
        throw new Error('SESSION_EXPIRED');
      }

      const data: AuthResponse = await res.json();
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        window.dispatchEvent(new Event('user_profile_updated'));
        scheduleProactiveRefresh(data.access_token);
        return data.access_token;
      }
      throw new Error('NO_TOKEN_IN_RESPONSE');
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

// Automatically bind refresh handler to guardedFetch for 401 retry handling
registerTokenRefreshHandler(refreshAccessToken);

export function initSilentRefresh(): void {
  scheduleProactiveRefresh();
}

/**
 * Hydrates the user session on application startup or window focus.
 * If access_token exists, schedules proactive refresh.
 * If missing, attempts silent refresh via HttpOnly refresh_token cookie.
 */
export async function hydrateSession(): Promise<boolean> {
  const token = localStorage.getItem('access_token');
  if (token) {
    scheduleProactiveRefresh(token);
    return true;
  }
  try {
    await refreshAccessToken();
    return true;
  } catch {
    return false;
  }
}

export async function syncGuestSessionsOnAuth(token: string): Promise<string | null> {
  const attempts = getGuestAttempts();
  if (!attempts || attempts.length === 0) return null;

  try {
    const res = await fetch('/api/v1/attempts/sync-guest-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sessions_payload: attempts }),
    });

    if (res.ok) {
      const data = await res.json();
      clearGuestAttempts();
      const latestId = data?.latest_attempt_id || null;
      if (latestId) {
        sessionStorage.setItem('latest_synced_attempt_id', latestId);
      }
      console.log('Successfully synced guest exam attempts to candidate account:', latestId);
      return latestId;
    } else {
      const errText = await res.text();
      console.warn('Sync guest sessions API returned error status:', res.status, errText);
    }

  } catch (err) {
    console.warn('Failed to sync guest exam attempts during authentication:', err);
  }
  return null;
}

export async function loginUser(email: string, password: string, role?: UserRole): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, role }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Authentication failed' }));
    const message = errorData.detail || 'Invalid email or password.';
    
    if (res.status === 401 || res.status === 404 || message.toLowerCase().includes('not found') || message.toLowerCase().includes('incorrect email')) {
      const err = new Error('USER_NOT_FOUND');
      (err as any).userFriendlyMessage = 'User not found! Please register first.';
      throw err;
    }
    throw new Error(message);
  }

  const data: AuthResponse = await res.json();
  if (data.access_token && data.user) {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    scheduleProactiveRefresh(data.access_token);
    await syncGuestSessionsOnAuth(data.access_token);
  }
  return data;
}

export interface ClerkUserInfo {
  email?: string;
  fullName?: string;
  profileImage?: string;
}

/**
 * Exchanges a Clerk OAuth session token for our own access/refresh tokens.
 * This is the only point where a Clerk-issued token is ever sent anywhere —
 * afterward the app behaves exactly like an email/password login (same
 * storage, same proactive refresh, same guest-session sync).
 */
export async function exchangeClerkToken(
  clerkToken: string,
  userInfo?: ClerkUserInfo
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/clerk-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      clerk_token: clerkToken,
      email: userInfo?.email,
      full_name: userInfo?.fullName,
      profile_image: userInfo?.profileImage,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Clerk exchange failed' }));
    throw new Error(errorData.detail || 'Could not complete sign-in.');
  }

  const data: AuthResponse = await res.json();
  if (data.access_token && data.user) {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    scheduleProactiveRefresh(data.access_token);
    await syncGuestSessionsOnAuth(data.access_token);
  }
  return data;
}

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  role: UserRole = UserRole.STUDENT,
  organizationName?: string,
  department?: string,
  preferredLanguage?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
      role,
      organization_name: organizationName,
      department,
      preferred_language: preferredLanguage,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(errorData.detail || 'Could not register user.');
  }

  const data: AuthResponse = await res.json();
  if (data.access_token && data.user) {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    scheduleProactiveRefresh(data.access_token);
    await syncGuestSessionsOnAuth(data.access_token);
  }
  return data;
}


export function logoutUser(): void {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
  activeRefreshPromise = null;

  const token = localStorage.getItem('access_token');
  try {
    fetch(`${API_BASE_URL}/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    }).catch((err) => {
      console.warn('Backend logout request failed:', err);
    });
  } catch {
    // Ignore network error on logout
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  localStorage.removeItem('latest_synced_attempt_id');
  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn("Error clearing sessionStorage during logout:", e);
  }
}

/**
 * Dual Authentication Service
 * 
 * Note on Token Expiration & Silent Refresh (HLD/LLD Frontend Part D Item 2):
 * - Clerk manages token refreshing automatically via its client session SDK.
 * - For custom backend JWTs, proactive silent refresh (scheduleProactiveRefresh) and
 *   guardedFetch 401 retry interceptor are fully active and wired to /api/v1/auth/refresh.
 */
export async function fetchCurrentUser(customToken?: string): Promise<any> {
  const token = customToken || localStorage.getItem('access_token');
  if (!token) throw new Error('No access token found');

  const res = await guardedFetch(`${API_BASE_URL}/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const data = await res.json();
  localStorage.setItem('user', JSON.stringify(data));
  return data;
}

export interface UserProfileUpdate {
  full_name?: string;
  profile_image?: string;
  email?: string;
  preferred_language?: string;
  phone?: string;
  target_exam?: string;
  target_year?: string;
  optional_subject?: string;
  weekly_hours?: string;
}

export async function updateUserProfile(updateData: UserProfileUpdate, customToken?: string): Promise<any> {
  const token = customToken || localStorage.getItem('access_token');
  if (!token) throw new Error('No access token found');

  const res = await fetch(`${API_BASE_URL}/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updateData)
  });

  if (!res.ok) {
    throw new Error('Failed to update user profile');
  }

  const data = await res.json();
  localStorage.setItem('user', JSON.stringify(data));
  window.dispatchEvent(new Event('user_profile_updated'));
  return data;
}

export interface OnboardingPayload {
  target_exam: string;
  target_year: string;
  optional_subject?: string;
  weekly_hours: string;
  preferred_language: string;
  subject_proficiency: Record<string, number>;
}

/** Saves the first-login questionnaire; the server locks the primary target from then on. */
export async function completeOnboarding(payload: OnboardingPayload): Promise<any> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No access token found');

  const res = await fetch(`${API_BASE_URL}/me/onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = typeof body?.detail === 'string' ? body.detail : Array.isArray(body?.detail) ? body.detail[0]?.msg : null;
    throw new Error(detail || 'Could not save your details. Please try again.');
  }
  const data = await res.json();
  localStorage.setItem('user', JSON.stringify(data));
  localStorage.setItem('preferred_language', data.preferred_language || payload.preferred_language);
  window.dispatchEvent(new Event('user_profile_updated'));
  return data;
}

export async function verifyEmail(token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Email verification failed' }));
    throw new Error(errorData.detail || 'Verification token is invalid or expired.');
  }

  return await res.json();
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(errorData.detail || 'Failed to send reset email.');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Reset failed' }));
    throw new Error(errorData.detail || 'Invalid or expired reset link.');
  }
}
