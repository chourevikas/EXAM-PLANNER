import { guardedFetch } from '../utils/apiGuard';

export type FeedbackCategory = 'BUG' | 'CONTENT' | 'IDEA' | 'OTHER';
export type FeedbackStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'BUG', label: 'Something is broken' },
  { value: 'CONTENT', label: 'A question or content problem' },
  { value: 'IDEA', label: 'A suggestion' },
  { value: 'OTHER', label: 'Something else' },
];

export const categoryLabel = (c: string) => FEEDBACK_CATEGORIES.find((x) => x.value === c)?.label || c;

export interface FeedbackItem {
  id: number;
  category: FeedbackCategory;
  message: string;
  page_url: string | null;
  user_agent: string | null;
  has_screenshot: boolean;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  user: { id: number; name: string | null; email: string | null };
}

export interface FeedbackPage {
  items: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
}

function authHeaders(json = true): Record<string, string> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg : null;
    throw new Error(detail || fallback);
  }
  return res.json();
}

/** Student: send a problem report or suggestion, with an optional screenshot. */
export async function sendFeedback(category: FeedbackCategory, message: string, screenshot?: File | null) {
  const form = new FormData();
  form.append('category', category);
  form.append('message', message.trim());
  form.append('page_url', window.location.pathname + window.location.search);
  form.append('user_agent', navigator.userAgent.slice(0, 300));
  if (screenshot) form.append('screenshot', screenshot);
  // No Content-Type header: the browser sets the multipart boundary.
  const res = await guardedFetch('/api/v1/feedback', { method: 'POST', headers: authHeaders(false), body: form });
  return unwrap<{ id: number; status: string }>(res, 'Could not send your report.');
}

/** Admin */
export async function fetchFeedback(status: FeedbackStatus | 'ALL' = 'OPEN', page = 1, limit = 20): Promise<FeedbackPage> {
  const res = await guardedFetch(`/api/v1/admin/feedback?status=${status}&page=${page}&limit=${limit}`, { headers: authHeaders() });
  return unwrap<FeedbackPage>(res, 'Could not load feedback.');
}

export async function fetchFeedbackSummary(): Promise<{ open: number }> {
  const res = await guardedFetch('/api/v1/admin/feedback/summary', { headers: authHeaders() });
  return unwrap(res, 'Could not load the feedback summary.');
}

/** The screenshot needs the auth header, so it is fetched as a blob and shown through an object URL. */
export async function fetchFeedbackScreenshot(id: number): Promise<string> {
  const res = await guardedFetch(`/api/v1/admin/feedback/${id}/screenshot`, { headers: authHeaders(false) });
  if (!res.ok) throw new Error('Could not load the screenshot.');
  return URL.createObjectURL(await res.blob());
}

async function act(id: number, action: 'resolve' | 'dismiss' | 'reopen', note?: string) {
  const res = await guardedFetch(`/api/v1/admin/feedback/${id}/${action}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ note: note?.trim() || undefined }),
  });
  return unwrap<{ id: number; status: FeedbackStatus }>(res, `Could not ${action} this report.`);
}

export const resolveFeedback = (id: number, note?: string) => act(id, 'resolve', note);
export const dismissFeedback = (id: number, note?: string) => act(id, 'dismiss', note);
export const reopenFeedback = (id: number) => act(id, 'reopen');
