import { guardedFetch } from '../utils/apiGuard';

export interface TestimonialItem {
  id: number | string;
  user_name: string;
  user_exam: string;
  user_photo?: string | null;
  rating: number;
  quote: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string | null;
  created_at: string;
}

const API_BASE = '/api/v1/testimonials';

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let approvedTestimonialsCache: CacheEntry<TestimonialItem[]> | null = null;

export function invalidateApprovedTestimonialsCache(): void {
  approvedTestimonialsCache = null;
}

export async function fetchApprovedTestimonials(forceRefresh: boolean = false): Promise<TestimonialItem[]> {
  const now = Date.now();
  if (!forceRefresh && approvedTestimonialsCache && (now - approvedTestimonialsCache.timestamp < CACHE_TTL_MS)) {
    return approvedTestimonialsCache.data;
  }
  try {
    const res = await guardedFetch(`${API_BASE}/approved`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch approved testimonials');
    const data = await res.json();
    approvedTestimonialsCache = { data, timestamp: now };
    return data;
  } catch (err) {
    if (approvedTestimonialsCache) {
      return approvedTestimonialsCache.data;
    }
    console.error('fetchApprovedTestimonials error:', err);
    return [];
  }
}

export async function submitTestimonial(payload: {
  quote: string;
  user_exam: string;
  rating?: number;
}): Promise<TestimonialItem> {
  const res = await guardedFetch(`${API_BASE}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit testimonial.');
  }

  invalidateApprovedTestimonialsCache();
  return await res.json();
}

// Super Admin Management APIs
export async function fetchAllTestimonialsForAdmin(): Promise<TestimonialItem[]> {
  const res = await guardedFetch(`${API_BASE}/admin/all`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch testimonials directory.');
  }

  return await res.json();
}

export async function approveTestimonial(id: number | string): Promise<TestimonialItem> {
  const res = await guardedFetch(`${API_BASE}/admin/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to approve testimonial.');
  }

  invalidateApprovedTestimonialsCache();
  return await res.json();
}

export async function rejectTestimonial(id: number | string, reason?: string): Promise<TestimonialItem> {
  const res = await guardedFetch(`${API_BASE}/admin/${id}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reject testimonial.');
  }

  invalidateApprovedTestimonialsCache();
  return await res.json();
}

export async function deleteTestimonial(id: number | string): Promise<{ message: string }> {
  const res = await guardedFetch(`${API_BASE}/admin/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete testimonial.');
  }

  invalidateApprovedTestimonialsCache();
  return await res.json();
}

