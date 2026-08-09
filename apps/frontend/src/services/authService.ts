import { UserRole, AuthResponse } from '../types/auth';

const API_BASE_URL = '/api/v1/auth';

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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
  }
  return data;
}

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  role: UserRole = UserRole.STUDENT
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
      role
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
  }
  return data;
}

export function logoutUser(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export async function fetchCurrentUser(): Promise<any> {
  const token = localStorage.getItem('access_token');
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
