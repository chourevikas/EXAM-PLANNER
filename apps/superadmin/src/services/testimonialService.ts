import { apiFetch, errorMessage } from './http';

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

export async function fetchAllTestimonialsForAdmin(): Promise<TestimonialItem[]> {
  const res = await apiFetch(`${API_BASE}/admin/all`);
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch testimonials directory.'));
  return await res.json();
}

export async function approveTestimonial(id: number | string): Promise<TestimonialItem> {
  const res = await apiFetch(`${API_BASE}/admin/${id}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to approve testimonial.'));
  return await res.json();
}

export async function rejectTestimonial(id: number | string, reason?: string): Promise<TestimonialItem> {
  const res = await apiFetch(`${API_BASE}/admin/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to reject testimonial.'));
  return await res.json();
}

export async function deleteTestimonial(id: number | string): Promise<{ message: string }> {
  const res = await apiFetch(`${API_BASE}/admin/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to delete testimonial.'));
  return await res.json();
}
