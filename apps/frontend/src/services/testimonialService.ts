export interface TestimonialItem {
  id: string;
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

export async function fetchApprovedTestimonials(): Promise<TestimonialItem[]> {
  try {
    const res = await fetch(`${API_BASE}/approved`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch approved testimonials');
    return await res.json();
  } catch (err) {
    console.error('fetchApprovedTestimonials error:', err);
    return [];
  }
}

export async function submitTestimonial(payload: {
  quote: string;
  user_exam: string;
  rating?: number;
}): Promise<TestimonialItem> {
  const res = await fetch(`${API_BASE}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit testimonial.');
  }

  return await res.json();
}

// Super Admin Management APIs
export async function fetchAllTestimonialsForAdmin(): Promise<TestimonialItem[]> {
  const res = await fetch(`${API_BASE}/admin/all`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch testimonials directory.');
  }

  return await res.json();
}

export async function approveTestimonial(id: string): Promise<TestimonialItem> {
  const res = await fetch(`${API_BASE}/admin/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to approve testimonial.');
  }

  return await res.json();
}

export async function rejectTestimonial(id: string, reason?: string): Promise<TestimonialItem> {
  const res = await fetch(`${API_BASE}/admin/${id}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reject testimonial.');
  }

  return await res.json();
}

export async function deleteTestimonial(id: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/admin/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete testimonial.');
  }

  return await res.json();
}
