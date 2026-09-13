import {
  HumanReviewTaskSummary,
  TeacherPointsSummary,
  TeacherReward,
  TeacherLeaderboardEntry,
} from '../types/auth';
import { guardedFetch } from '../utils/apiGuard';

const API_BASE_URL = '/api/v1';

// Client-side in-memory caches for Domain 12
const _reviewTasksCache = new Map<string, { data: HumanReviewTaskSummary[]; timestamp: number }>();
const _reviewTaskDetailCache = new Map<string, { data: any; timestamp: number }>();
let _myPointsCache: { data: TeacherPointsSummary; timestamp: number } | null = null;
let _myRewardsCache: { data: TeacherReward[]; timestamp: number } | null = null;
let _teacherLeaderboardCache: { data: TeacherLeaderboardEntry[]; timestamp: number } | null = null;
const _teacherRewardHistoryCache = new Map<string, { data: TeacherReward[]; timestamp: number }>();

const REVIEW_CACHE_TTL = 45 * 1000; // 45 seconds
const TEACHER_STATS_CACHE_TTL = 90 * 1000; // 90 seconds

export function invalidateReviewTasksCache(): void {
  _reviewTasksCache.clear();
}

export function invalidateReviewTaskDetailCache(questionId?: number | string): void {
  if (questionId !== undefined) {
    _reviewTaskDetailCache.delete(String(questionId));
  } else {
    _reviewTaskDetailCache.clear();
  }
}

export function invalidateTeacherPointsCache(): void {
  _myPointsCache = null;
}

export function invalidateTeacherRewardsCache(): void {
  _myRewardsCache = null;
  _teacherRewardHistoryCache.clear();
}

export function invalidateTeacherLeaderboardCache(): void {
  _teacherLeaderboardCache = null;
}

export function clearTeacherServiceCache(): void {
  _reviewTasksCache.clear();
  _reviewTaskDetailCache.clear();
  _myPointsCache = null;
  _myRewardsCache = null;
  _teacherLeaderboardCache = null;
  _teacherRewardHistoryCache.clear();
}

function getAuthHeader() {
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

async function handle<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: fallback }));
    throw new Error(errorData.detail || fallback);
  }
  return await res.json();
}

/* --- Review queue (reused HITL pipeline, now opened up to Teacher) --- */

export async function fetchReviewTasks(onlyFlagged = false, forceRefresh = false): Promise<HumanReviewTaskSummary[]> {
  const cacheKey = `flagged_${onlyFlagged}`;
  if (!forceRefresh) {
    const cached = _reviewTasksCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REVIEW_CACHE_TTL) {
      return cached.data;
    }
  }

  const res = await guardedFetch(`${API_BASE_URL}/admin/review/tasks?only_flagged=${onlyFlagged}`, {
    headers: getAuthHeader(),
  });
  const data = await handle<HumanReviewTaskSummary[]>(res, 'Could not fetch the review queue.');
  _reviewTasksCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function fetchReviewTaskDetail(questionId: number | string, forceRefresh = false): Promise<any> {
  const key = String(questionId);
  if (!forceRefresh) {
    const cached = _reviewTaskDetailCache.get(key);
    if (cached && Date.now() - cached.timestamp < REVIEW_CACHE_TTL) {
      return cached.data;
    }
  }

  const res = await guardedFetch(`${API_BASE_URL}/admin/review/tasks/${questionId}`, {
    headers: getAuthHeader(),
  });
  const data = await handle<any>(res, 'Could not fetch question review detail.');
  _reviewTaskDetailCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function approveReviewTask(
  questionId: number | string,
  payload: { reviewer_notes?: string; correct_option_label?: string } = {}
): Promise<any> {
  const res = await guardedFetch(`${API_BASE_URL}/admin/review/tasks/${questionId}/approve`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  const data = await handle(res, 'Could not approve this question.');

  // Invalidate HITL review caches and teacher points
  invalidateReviewTasksCache();
  invalidateReviewTaskDetailCache(questionId);
  invalidateTeacherPointsCache();

  return data;
}

export async function rejectReviewTask(
  questionId: number | string,
  rejectionReason: string,
  reviewerNotes?: string
): Promise<any> {
  const res = await guardedFetch(`${API_BASE_URL}/admin/review/tasks/${questionId}/reject`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ rejection_reason: rejectionReason, reviewer_notes: reviewerNotes }),
  });
  const data = await handle(res, 'Could not reject this question.');

  // Invalidate HITL review caches and teacher points
  invalidateReviewTasksCache();
  invalidateReviewTaskDetailCache(questionId);
  invalidateTeacherPointsCache();

  return data;
}

/* --- Teacher self-service: points & rewards --- */

export async function fetchMyPoints(forceRefresh = false): Promise<TeacherPointsSummary> {
  if (!forceRefresh && _myPointsCache && Date.now() - _myPointsCache.timestamp < TEACHER_STATS_CACHE_TTL) {
    return _myPointsCache.data;
  }

  const res = await guardedFetch(`${API_BASE_URL}/teacher/points`, { headers: getAuthHeader() });
  const data = await handle<TeacherPointsSummary>(res, 'Could not fetch your points.');
  _myPointsCache = { data, timestamp: Date.now() };
  return data;
}

export async function fetchMyRewards(forceRefresh = false): Promise<TeacherReward[]> {
  if (!forceRefresh && _myRewardsCache && Date.now() - _myRewardsCache.timestamp < TEACHER_STATS_CACHE_TTL) {
    return _myRewardsCache.data;
  }

  const res = await guardedFetch(`${API_BASE_URL}/teacher/rewards`, { headers: getAuthHeader() });
  const data = await handle<TeacherReward[]>(res, 'Could not fetch your rewards.');
  _myRewardsCache = { data, timestamp: Date.now() };
  return data;
}

/* --- Admin: teacher leaderboard & reward granting --- */

export async function fetchTeacherLeaderboard(forceRefresh = false): Promise<TeacherLeaderboardEntry[]> {
  if (!forceRefresh && _teacherLeaderboardCache && Date.now() - _teacherLeaderboardCache.timestamp < TEACHER_STATS_CACHE_TTL) {
    return _teacherLeaderboardCache.data;
  }

  const res = await guardedFetch(`${API_BASE_URL}/admin/teachers`, { headers: getAuthHeader() });
  const data = await handle<TeacherLeaderboardEntry[]>(res, 'Could not fetch the teacher leaderboard.');
  _teacherLeaderboardCache = { data, timestamp: Date.now() };
  return data;
}

export async function fetchTeacherRewardHistory(teacherId: number | string, forceRefresh = false): Promise<TeacherReward[]> {
  const key = String(teacherId);
  if (!forceRefresh) {
    const cached = _teacherRewardHistoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < TEACHER_STATS_CACHE_TTL) {
      return cached.data;
    }
  }

  const res = await guardedFetch(`${API_BASE_URL}/admin/teachers/${teacherId}/rewards`, {
    headers: getAuthHeader(),
  });
  const data = await handle<TeacherReward[]>(res, 'Could not fetch this teacher\'s reward history.');
  _teacherRewardHistoryCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function grantTeacherReward(
  teacherId: number | string,
  payload: { title: string; description?: string; points_value?: number }
): Promise<TeacherReward> {
  const res = await guardedFetch(`${API_BASE_URL}/admin/teachers/${teacherId}/rewards`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  const data = await handle<TeacherReward>(res, 'Could not grant reward.');

  // Invalidate leaderboard and reward caches
  invalidateTeacherLeaderboardCache();
  invalidateTeacherRewardsCache();

  return data;
}
