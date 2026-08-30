import {
  HumanReviewTaskSummary,
  TeacherPointsSummary,
  TeacherReward,
  TeacherLeaderboardEntry,
} from '../types/auth';

const API_BASE_URL = '/api/v1';

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

export async function fetchReviewTasks(onlyFlagged = false): Promise<HumanReviewTaskSummary[]> {
  const res = await fetch(`${API_BASE_URL}/admin/review/tasks?only_flagged=${onlyFlagged}`, {
    headers: getAuthHeader(),
  });
  return handle(res, 'Could not fetch the review queue.');
}

export async function fetchReviewTaskDetail(questionId: number | string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/admin/review/tasks/${questionId}`, {
    headers: getAuthHeader(),
  });
  return handle(res, 'Could not fetch question review detail.');
}

export async function approveReviewTask(
  questionId: number | string,
  payload: { reviewer_notes?: string; correct_option_label?: string } = {}
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/admin/review/tasks/${questionId}/approve`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  return handle(res, 'Could not approve this question.');
}

export async function rejectReviewTask(
  questionId: number | string,
  rejectionReason: string,
  reviewerNotes?: string
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/admin/review/tasks/${questionId}/reject`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ rejection_reason: rejectionReason, reviewer_notes: reviewerNotes }),
  });
  return handle(res, 'Could not reject this question.');
}

/* --- Teacher self-service: points & rewards --- */

export async function fetchMyPoints(): Promise<TeacherPointsSummary> {
  const res = await fetch(`${API_BASE_URL}/teacher/points`, { headers: getAuthHeader() });
  return handle(res, 'Could not fetch your points.');
}

export async function fetchMyRewards(): Promise<TeacherReward[]> {
  const res = await fetch(`${API_BASE_URL}/teacher/rewards`, { headers: getAuthHeader() });
  return handle(res, 'Could not fetch your rewards.');
}

/* --- Admin: teacher leaderboard & reward granting --- */

export async function fetchTeacherLeaderboard(): Promise<TeacherLeaderboardEntry[]> {
  const res = await fetch(`${API_BASE_URL}/admin/teachers`, { headers: getAuthHeader() });
  return handle(res, 'Could not fetch the teacher leaderboard.');
}

export async function fetchTeacherRewardHistory(teacherId: number | string): Promise<TeacherReward[]> {
  const res = await fetch(`${API_BASE_URL}/admin/teachers/${teacherId}/rewards`, {
    headers: getAuthHeader(),
  });
  return handle(res, 'Could not fetch this teacher\'s reward history.');
}

export async function grantTeacherReward(
  teacherId: number | string,
  payload: { title: string; description?: string; points_value?: number }
): Promise<TeacherReward> {
  const res = await fetch(`${API_BASE_URL}/admin/teachers/${teacherId}/rewards`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  return handle(res, 'Could not grant reward.');
}
