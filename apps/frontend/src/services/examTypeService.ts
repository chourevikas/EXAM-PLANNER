import { ExamType, ExamTypeCreatePayload, ExamTypeUpdatePayload } from '../types/examType';
import { guardedFetch } from '../utils/apiGuard';

const API_BASE = '/api/v1';

function getAuthHeader(): Record<string, string> {
  let token = localStorage.getItem('access_token');
  if (!token) {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        token = parsed.access_token || parsed.token || null;
      } catch (e) {}
    }
  }
  return {
    'Authorization': `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let activeExamTypesCache: CacheEntry<ExamType[]> | null = null;

export function invalidateActiveExamTypesCache(): void {
  activeExamTypesCache = null;
}

/**
 * Public list of active exam types (single source of truth across candidate and admin UI).
 * Cached in-memory for 5 minutes with fallback safety.
 */
export async function fetchActiveExamTypes(forceRefresh: boolean = false): Promise<ExamType[]> {
  const now = Date.now();
  if (!forceRefresh && activeExamTypesCache && (now - activeExamTypesCache.timestamp < CACHE_TTL_MS)) {
    return activeExamTypesCache.data;
  }
  try {
    const res = await guardedFetch(`${API_BASE}/exam-types`);
    if (!res.ok) {
      throw new Error('Failed to fetch active exam types.');
    }
    const data = await res.json();
    activeExamTypesCache = { data, timestamp: now };
    return data;
  } catch (err) {
    if (activeExamTypesCache) {
      return activeExamTypesCache.data;
    }
    console.warn('Could not fetch active exam types, using fallback:', err);
    return [
      {
        id: 1,
        type: 'upsc',
        name: 'UPSC Civil Services Examination',
        total_duration: 120,
        number_of_questions: 100,
        total_marks: 200,
        negative_marks: 0.66,
        positive_marks: 2.0,
        is_active: true,
      },
    ];
  }
}

/**
 * Admin list of all exam types with associated exam counts.
 */
export async function adminFetchExamTypes(includeInactive: boolean = true): Promise<ExamType[]> {
  const res = await guardedFetch(`${API_BASE}/admin/exam-types?include_inactive=${includeInactive}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch exam types' }));
    throw new Error(errorData.detail || 'Could not fetch exam types.');
  }
  return await res.json();
}

/**
 * Admin: Create new exam type.
 */
export async function adminCreateExamType(payload: ExamTypeCreatePayload): Promise<ExamType> {
  const res = await guardedFetch(`${API_BASE}/admin/exam-types`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to create exam type' }));
    throw new Error(errorData.detail || 'Creation failed.');
  }
  invalidateActiveExamTypesCache();
  return await res.json();
}

/**
 * Admin: Update exam type.
 */
export async function adminUpdateExamType(
  id: number,
  payload: ExamTypeUpdatePayload
): Promise<ExamType> {
  const res = await guardedFetch(`${API_BASE}/admin/exam-types/${id}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update exam type' }));
    throw new Error(errorData.detail || 'Update failed.');
  }
  invalidateActiveExamTypesCache();
  return await res.json();
}

/**
 * Admin: Delete exam type.
 */
export async function adminDeleteExamType(id: number): Promise<{ success: boolean; message: string }> {
  const res = await guardedFetch(`${API_BASE}/admin/exam-types/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to delete exam type' }));
    throw new Error(errorData.detail || 'Deletion failed.');
  }
  invalidateActiveExamTypesCache();
  return await res.json();
}

