import { guardedFetch } from '../utils/apiGuard';

/** Free plan: 20 answered questions a day (IST) across tests and practice; Premium and staff are unlimited. */
export interface DailyUsage {
  limited: boolean;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  /** ISO time the daily count resets (midnight IST). */
  resets_at: string;
}

export const DAILY_LIMIT_CODE = 'FREE_DAILY_LIMIT_REACHED';
export const ANALYSIS_LOCKED_CODE = 'FREE_PLAN_ANALYSIS_LOCKED';

/** Thrown when the server refuses a new answer because today's free questions are used up. */
export class DailyLimitReachedError extends Error {
  constructor(message = 'Daily free question limit reached') {
    super(message);
    this.name = 'DailyLimitReachedError';
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

/** Today's usage, or null when it can't be loaded (callers then don't block anything client-side). */
export async function fetchDailyUsage(): Promise<DailyUsage | null> {
  try {
    const res = await guardedFetch('/api/v1/users/me/daily-usage', { headers: authHeaders() });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Records a practice-page answer for a signed-in student and returns the updated usage.
 * Throws DailyLimitReachedError when today's free questions are used up.
 */
export async function recordPracticeAnswer(questionId: number | string, selectedOptionId?: number | string | null): Promise<DailyUsage | null> {
  const res = await guardedFetch('/api/v1/practice/answers', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      question_id: Number(questionId),
      selected_option_id: selectedOptionId != null && selectedOptionId !== '' ? Number(selectedOptionId) : null,
    }),
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (body?.detail?.code === DAILY_LIMIT_CODE) throw new DailyLimitReachedError(body.detail.message);
  }
  if (!res.ok) return null; // not limit-related: don't stop the student from practising
  const body = await res.json();
  return body?.usage ?? null;
}
