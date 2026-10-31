import { guardedFetch } from '../utils/apiGuard';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  state: string | null;
  xp: number;
  correct_answers: number;
  /** Places gained (+) or lost (−) since the previous daily snapshot; null when not ranked then. */
  rank_change: number | null;
  is_me: boolean;
}

export interface LeaderboardResponse {
  snapshot_date: string | null;
  scope: 'national' | 'state';
  exam: string | null;
  state: string | null;
  exams: string[];
  total: number;
  page: number;
  page_size: number;
  rows: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  profile_incomplete: { state: boolean; username: boolean };
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchLeaderboard(params: {
  scope: 'national' | 'state';
  exam?: string | null;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<LeaderboardResponse> {
  const q = new URLSearchParams({ scope: params.scope });
  if (params.exam) q.set('exam', params.exam);
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('page_size', String(params.pageSize));
  const res = await guardedFetch(`/api/v1/leaderboard?${q.toString()}`, { headers: authHeaders(), signal: params.signal });
  if (!res.ok) throw new Error('Failed to load the leaderboard');
  return res.json();
}

export async function checkUsername(username: string): Promise<{ available: boolean; reason: string | null }> {
  const res = await guardedFetch(`/api/v1/users/username-available?u=${encodeURIComponent(username)}`, { headers: authHeaders() });
  if (!res.ok) return { available: false, reason: 'Could not check right now' };
  return res.json();
}
