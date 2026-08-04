import { AdminApprovalRequest, AdminApprovalLog, SystemStats, User } from '../types/auth';

const API_BASE_URL = 'http://localhost:8000/api/v1/admin';

function getAuthHeader() {
  const token = localStorage.getItem('access_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchPendingAdminRequests(): Promise<AdminApprovalRequest[]> {
  const res = await fetch(`${API_BASE_URL}/pending-requests`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch pending requests' }));
    throw new Error(errorData.detail || 'Could not fetch pending admin requests.');
  }
  return await res.json();
}

export async function fetchActiveAdmins(): Promise<AdminApprovalRequest[]> {
  const res = await fetch(`${API_BASE_URL}/active-admins`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch active admins' }));
    throw new Error(errorData.detail || 'Could not fetch active admins.');
  }
  return await res.json();
}

export async function approveAdminRequest(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/approve/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to approve admin request' }));
    throw new Error(errorData.detail || 'Approval failed.');
  }
  return await res.json();
}

export async function rejectAdminRequest(userId: string, reason?: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/reject/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to reject admin request' }));
    throw new Error(errorData.detail || 'Rejection failed.');
  }
  return await res.json();
}

export async function suspendAdmin(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/suspend/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to suspend admin' }));
    throw new Error(errorData.detail || 'Suspend failed.');
  }
  return await res.json();
}

export async function reactivateAdmin(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/reactivate/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to reactivate admin' }));
    throw new Error(errorData.detail || 'Reactivation failed.');
  }
  return await res.json();
}

export async function fetchAuditLogs(): Promise<AdminApprovalLog[]> {
  const res = await fetch(`${API_BASE_URL}/audit-logs`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch audit logs' }));
    throw new Error(errorData.detail || 'Could not fetch audit logs.');
  }
  return await res.json();
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE_URL}/system-stats`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch system stats' }));
    throw new Error(errorData.detail || 'Could not fetch system stats.');
  }
  return await res.json();
}
