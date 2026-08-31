import { UserRole, AuthResponse } from '../types/auth';
import { getGuestAttempts, clearGuestAttempts } from '../utils/guestStorage';

const API_BASE_URL = '/api/v1/auth';

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
  department?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
      role,
      organization_name: organizationName,
      department
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
    await syncGuestSessionsOnAuth(data.access_token);
  }
  return data;
}


export function logoutUser(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  localStorage.removeItem('latest_synced_attempt_id');
  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn("Error clearing sessionStorage during logout:", e);
  }
}

export async function fetchCurrentUser(customToken?: string): Promise<any> {
  const token = customToken || localStorage.getItem('access_token');
  if (!token) throw new Error('No access token found');

  const res = await fetch(`${API_BASE_URL}/me`, {
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

export async function updateUserProfile(updateData: { full_name?: string; profile_image?: string }, customToken?: string): Promise<any> {
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
