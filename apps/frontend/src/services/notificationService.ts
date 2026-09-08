/**
 * Notification Service
 * Handles all API calls for the admin-managed broadcast notifications system.
 */

const API_BASE = '/api/v1';

export interface BroadcastNotification {
  id: number;
  title: string;
  description?: string | null;
  contentType: string; // 'video' | 'pdf' | 'article' | 'other'
  link?: string | null;
  attachment?: string | null;
  status: string; // 'draft' | 'published' | 'rejected'
  createdById?: number | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface NotificationListResponse {
  items: BroadcastNotification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateNotificationPayload {
  title: string;
  description?: string;
  contentType?: string;
  link?: string;
  attachment?: string;
}

export interface UpdateNotificationPayload {
  title?: string;
  description?: string;
  contentType?: string;
  link?: string;
  attachment?: string;
}

function getAuthHeaders(): Record<string, string> {
  let token = localStorage.getItem('access_token');
  if (!token) {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed.access_token || parsed.token || null;
      }
    } catch {}
  }
  return {
    Authorization: `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

export async function adminListNotifications(params: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<NotificationListResponse> {
  const { page = 1, limit = 10, status } = params;
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'all') qs.set('status', status);
  const res = await fetch(`${API_BASE}/admin/notifications?${qs}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<NotificationListResponse>(res);
}

export async function adminGetNotification(id: number): Promise<BroadcastNotification> {
  const res = await fetch(`${API_BASE}/admin/notifications/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<BroadcastNotification>(res);
}

export async function adminCreateNotification(
  payload: CreateNotificationPayload,
): Promise<BroadcastNotification> {
  const body = {
    title: payload.title,
    description: payload.description,
    contentType: payload.contentType || 'other',
    link: payload.link,
    attachment: payload.attachment,
  };
  const res = await fetch(`${API_BASE}/admin/notifications`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<BroadcastNotification>(res);
}

export async function adminUpdateNotification(
  id: number,
  payload: UpdateNotificationPayload,
): Promise<BroadcastNotification> {
  const body = {
    title: payload.title,
    description: payload.description,
    contentType: payload.contentType,
    link: payload.link,
    attachment: payload.attachment,
  };
  const res = await fetch(`${API_BASE}/admin/notifications/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<BroadcastNotification>(res);
}

export async function adminPublishNotification(id: number): Promise<BroadcastNotification> {
  const res = await fetch(`${API_BASE}/admin/notifications/${id}/publish`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  return handleResponse<BroadcastNotification>(res);
}

export async function adminRejectNotification(id: number): Promise<BroadcastNotification> {
  const res = await fetch(`${API_BASE}/admin/notifications/${id}/reject`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  return handleResponse<BroadcastNotification>(res);
}

export async function adminDeleteNotification(id: number): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/admin/notifications/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse<{ message: string }>(res);
}

// ─── User-Facing Endpoints ────────────────────────────────────────────────────

export async function fetchPublishedNotifications(params: {
  page?: number;
  limit?: number;
  contentType?: string;
  date?: string;
}): Promise<NotificationListResponse & { unread_count: number; notifications: any[] }> {
  const { page = 1, limit = 10, contentType, date } = params;
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (contentType && contentType !== 'all') qs.set('contentType', contentType);
  if (date) qs.set('date', date);
  const res = await fetch(`${API_BASE}/notifications?${qs}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function fetchNotificationDetail(id: number): Promise<BroadcastNotification> {
  const res = await fetch(`${API_BASE}/notifications/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<BroadcastNotification>(res);
}
