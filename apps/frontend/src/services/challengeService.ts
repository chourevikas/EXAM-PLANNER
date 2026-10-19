import { guardedFetch } from '../utils/apiGuard';

const API_BASE_URL = '/api/v1';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export type ChallengeDuration = 'ONE_DAY' | 'THREE_DAYS' | 'ONE_WEEK' | 'TWO_WEEKS' | 'ONE_MONTH' | 'NO_LIMIT';

export const CHALLENGE_DURATION_OPTIONS: { value: ChallengeDuration; label: string }[] = [
  { value: 'ONE_DAY', label: '1 Day' },
  { value: 'THREE_DAYS', label: '3 Days' },
  { value: 'ONE_WEEK', label: '1 Week' },
  { value: 'TWO_WEEKS', label: '2 Weeks' },
  { value: 'ONE_MONTH', label: '1 Month' },
  { value: 'NO_LIMIT', label: 'No Limit' },
];

export interface ChallengeSummary {
  id: number;
  title: string;
  description?: string | null;
  question_count: number;
  time_limit_minutes: number;
  visibility: 'INVITE_ONLY' | 'PUBLIC';
  status: 'ACTIVE' | 'ARCHIVED';
  share_token: string;
  creator_id: number;
  creator_name?: string | null;
  created_at: string;
  expires_at?: string | null;
  attempt_count: number;
  my_best_score?: number | null;
  subject_name?: string | null;
  subject_names?: string[];
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | null;
  exam_name?: string | null;
  years?: number[];
  /** Each user gets one attempt per challenge; true once it has been submitted. */
  has_attempted?: boolean;
  has_in_progress?: boolean;
}

export interface ChallengeExamOption {
  id: number;
  name: string;
  years: number[];
  /** subject name -> years in which this exam has published questions for it */
  subject_years: Record<string, number[]>;
}

export interface ChallengeOptions {
  exams: ChallengeExamOption[];
  years: number[];
  subject_years: Record<string, number[]>;
}

export interface ChallengePublicPreview {
  id: number;
  title: string;
  description?: string | null;
  question_count: number;
  time_limit_minutes: number;
  creator_name?: string | null;
  share_token: string;
  expires_at?: string | null;
  is_expired: boolean;
}

export interface CreateChallengePayload {
  title: string;
  description?: string;
  question_count: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  subject_names?: string[];
  exam_type_ids?: number[];
  years?: number[];
  time_limit_minutes: number;
  visibility: 'INVITE_ONLY' | 'PUBLIC';
  duration: ChallengeDuration;
}

export interface ChallengeQuestionOption {
  option_id: number;
  option_label: string;
  text: string;
}

export interface ChallengeQuestionOut {
  question_id: number;
  order_index: number;
  text: string;
  options: ChallengeQuestionOption[];
}

export interface StartChallengeAttemptResponse {
  attempt_id: number;
  challenge_id: number;
  questions: ChallengeQuestionOut[];
  time_limit_minutes: number;
}

export interface SubmitChallengeAttemptResponse {
  attempt_id: number;
  total_score: number;
  total_correct: number;
  total_incorrect: number;
  total_unattempted: number;
  time_spent_seconds: number;
}

export interface LeaderboardEntry {
  user_id: number;
  user_name: string;
  total_score: number;
  total_correct: number;
  time_spent_seconds: number;
  submitted_at?: string | null;
  is_current_user: boolean;
}

export interface ChallengeLimitError {
  code: 'CHALLENGE_LIMIT_REACHED';
  message: string;
  limit: number;
}

export class ChallengeQuotaError extends Error {
  limit: number;
  constructor(detail: ChallengeLimitError) {
    super(detail.message);
    this.limit = detail.limit;
  }
}

async function parseJsonOrThrow(response: Response): Promise<any> {
  if (response.status === 403) {
    const body = await response.json().catch(() => null);
    if (body?.detail?.code === 'CHALLENGE_LIMIT_REACHED') {
      throw new ChallengeQuotaError(body.detail);
    }
    throw new Error(body?.detail?.message || body?.detail || 'Forbidden');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return await response.json();
}

export async function createChallenge(payload: CreateChallengePayload): Promise<ChallengeSummary> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return await parseJsonOrThrow(response);
}

export async function fetchChallengeOptions(): Promise<ChallengeOptions> {
  try {
    const response = await guardedFetch(`${API_BASE_URL}/challenges/options`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) return { exams: [], years: [], subject_years: {} };
    return await response.json();
  } catch {
    return { exams: [], years: [], subject_years: {} };
  }
}

export async function listMyChallenges(): Promise<ChallengeSummary[]> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return (await parseJsonOrThrow(response)) || [];
}

export async function getChallenge(challengeId: number | string): Promise<ChallengeSummary> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges/${encodeURIComponent(String(challengeId))}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return await parseJsonOrThrow(response);
}

export async function getPublicChallengePreview(shareToken: string): Promise<ChallengePublicPreview> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges/public/${encodeURIComponent(shareToken)}`, {
    method: 'GET',
  });
  return await parseJsonOrThrow(response);
}

export async function inviteUserToChallenge(challengeId: number, email: string): Promise<void> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges/${challengeId}/invite`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ email }),
  });
  await parseJsonOrThrow(response);
}

export async function getLeaderboard(challengeId: number | string): Promise<LeaderboardEntry[]> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges/${encodeURIComponent(String(challengeId))}/leaderboard`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return (await parseJsonOrThrow(response)) || [];
}

export async function startChallengeAttempt(idOrToken: string): Promise<StartChallengeAttemptResponse> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges/${encodeURIComponent(idOrToken)}/attempts/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return await parseJsonOrThrow(response);
}

export async function saveChallengeResponse(
  attemptId: number,
  questionId: number,
  selectedOptionId: number | null,
  timeSpentSeconds: number
): Promise<void> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges/attempts/${attemptId}/responses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      question_id: questionId,
      selected_option_id: selectedOptionId,
      time_spent_seconds: timeSpentSeconds,
    }),
  });
  await parseJsonOrThrow(response);
}

export async function submitChallengeAttempt(attemptId: number): Promise<SubmitChallengeAttemptResponse> {
  const response = await guardedFetch(`${API_BASE_URL}/challenges/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return await parseJsonOrThrow(response);
}

export interface UserLookupResult {
  id: number;
  full_name: string;
  email: string;
}

/** Renders a short human label for a challenge's remaining/closed status. */
export function formatChallengeExpiry(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const expiryDate = new Date(expiresAt);
  const diffMs = expiryDate.getTime() - Date.now();
  if (diffMs <= 0) return 'Closed';

  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `Closes in ${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Closes in ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `Closes in ${diffDays}d`;
}

export function isChallengeExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function fetchSubjectNames(): Promise<string[]> {
  try {
    const response = await guardedFetch(`${API_BASE_URL}/questions/taxonomy`, { method: 'GET' });
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.subjects || []).filter((s: string) => s !== 'All Subjects');
  } catch {
    return [];
  }
}

export async function lookupUserByEmail(email: string): Promise<UserLookupResult | null> {
  const response = await guardedFetch(`${API_BASE_URL}/users/lookup?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) return null;
  return await response.json();
}
