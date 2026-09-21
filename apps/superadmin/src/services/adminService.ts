import { AdminApprovalRequest, AdminApprovalLog, SystemStats, User, UserDirectoryItem } from '../types/auth';
import { apiFetch, errorMessage } from './http';

const API_BASE_URL = '/api/v1/admin';

export async function fetchPendingAdminRequests(): Promise<AdminApprovalRequest[]> {
  const res = await apiFetch(`${API_BASE_URL}/pending-requests`, );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch pending requests' }));
    throw new Error(errorData.detail || 'Could not fetch pending admin requests.');
  }
  return await res.json();
}

export async function fetchActiveAdmins(): Promise<AdminApprovalRequest[]> {
  const res = await apiFetch(`${API_BASE_URL}/active-admins`, );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch active admins' }));
    throw new Error(errorData.detail || 'Could not fetch active admins.');
  }
  return await res.json();
}

export async function approveAdminRequest(userId: number | string): Promise<User> {
  const res = await apiFetch(`${API_BASE_URL}/approve/${userId}`, {
    method: 'POST',
      });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to approve admin request' }));
    throw new Error(errorData.detail || 'Approval failed.');
  }
  return await res.json();
}

export async function rejectAdminRequest(userId: number | string, reason?: string): Promise<User> {
  const res = await apiFetch(`${API_BASE_URL}/reject/${userId}`, {
    method: 'POST',
        body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to reject admin request' }));
    throw new Error(errorData.detail || 'Rejection failed.');
  }
  return await res.json();
}

export async function suspendAdmin(userId: number | string): Promise<User> {
  const res = await apiFetch(`${API_BASE_URL}/suspend/${userId}`, {
    method: 'POST',
      });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to suspend admin' }));
    throw new Error(errorData.detail || 'Suspend failed.');
  }
  return await res.json();
}

export async function reactivateAdmin(userId: number | string): Promise<User> {
  const res = await apiFetch(`${API_BASE_URL}/reactivate/${userId}`, {
    method: 'POST',
      });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to reactivate admin' }));
    throw new Error(errorData.detail || 'Reactivation failed.');
  }
  return await res.json();
}

export async function fetchAuditLogs(): Promise<AdminApprovalLog[]> {
  const res = await apiFetch(`${API_BASE_URL}/audit-logs`, );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch audit logs' }));
    throw new Error(errorData.detail || 'Could not fetch audit logs.');
  }
  return await res.json();
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const res = await apiFetch(`${API_BASE_URL}/system-stats`, );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch system stats' }));
    throw new Error(errorData.detail || 'Could not fetch system stats.');
  }
  return await res.json();
}

export async function fetchPlatformUsers(): Promise<UserDirectoryItem[]> {
  const res = await apiFetch(`${API_BASE_URL}/all-users`, );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch platform users' }));
    throw new Error(errorData.detail || 'Could not fetch user directory.');
  }
  return await res.json();
}

export async function updateUserRole(userId: number | string, newRole: string): Promise<User> {
  const res = await apiFetch(`${API_BASE_URL}/users/${userId}/role`, {
    method: 'POST',
        body: JSON.stringify({ new_role: newRole }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update user role' }));
    throw new Error(errorData.detail || 'Could not update user role.');
  }
  return await res.json();
}



export interface StaffCreatePayload {
  email: string;
  full_name: string;
  role: 'ADMIN' | 'TEACHER';
  // Sub-admin: an ADMIN limited to the permissions of this custom role.
  custom_role_id?: number | null;
}

export interface StaffCreateResult {
  user: User;
  // False when the welcome email could not be sent; use resendStaffCredentials to retry.
  email_sent: boolean;
}

/** Create an Admin/Teacher/sub-admin. The server emails them a temporary password. */
export async function createStaffUser(payload: StaffCreatePayload): Promise<StaffCreateResult> {
  const res = await apiFetch('/api/v1/users', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not create the user.'));
  return await res.json();
}

/** Issue a new temporary password to an existing Admin/Teacher and email it. */
export async function resendStaffCredentials(userId: number | string): Promise<StaffCreateResult> {
  const res = await apiFetch(`/api/v1/users/${userId}/resend-credentials`, { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not resend the credentials.'));
  return await res.json();
}


export interface AdminActionLogEntry {
  id: number;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export async function fetchActionLogs(action?: string): Promise<AdminActionLogEntry[]> {
  const query = action ? `?action=${encodeURIComponent(action)}&limit=200` : '?limit=200';
  const res = await apiFetch(`${API_BASE_URL}/action-logs${query}`);
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load the activity log.'));
  return await res.json();
}
