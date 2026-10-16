import { guardedFetch } from '../utils/apiGuard';
import type { QuestionSolutionData } from '../components/exam/QuestionSolutionMarkdownCard';

export interface BookmarkItem {
  bookmark_id: string;
  question_id: string;
  question_text: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | string;
  created_at: string | null;
  /** Short exam tag such as "UPSC"; null when the question has no paper. */
  exam_name: string | null;
  exam_full_name: string | null;
  source_year: number | null;
}

export interface BookmarkPage {
  items: BookmarkItem[];
  total: number;
}

export async function listBookmarks(options?: {
  skip?: number;
  limit?: number;
  q?: string;
  difficulty?: string;
  signal?: AbortSignal;
}): Promise<BookmarkPage> {
  const token = localStorage.getItem('access_token');
  const queryParams = new URLSearchParams();
  if (options?.limit) queryParams.set('limit', String(options.limit));
  if (options?.skip) queryParams.set('skip', String(options.skip));
  if (options?.q?.trim()) queryParams.set('q', options.q.trim());
  if (options?.difficulty) queryParams.set('difficulty', options.difficulty);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const res = await guardedFetch(`/api/v1/users/me/bookmarks${queryString}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: options?.signal,
  });
  if (!res.ok) throw new Error('Failed to fetch bookmarks');
  return res.json();
}

export async function addBookmark(questionId: number | string): Promise<void> {
  const token = localStorage.getItem('access_token');
  const res = await guardedFetch(`/api/v1/users/me/bookmarks/${questionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to add bookmark');
}

export async function removeBookmark(questionId: number | string): Promise<void> {
  const token = localStorage.getItem('access_token');
  const res = await guardedFetch(`/api/v1/users/me/bookmarks/${questionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove bookmark');
}

// Solutions don't change while the page is open, so keep each one after its first load.
const solutionCache = new Map<string, QuestionSolutionData>();

export async function getBookmarkSolution(questionId: string): Promise<QuestionSolutionData> {
  const cached = solutionCache.get(questionId);
  if (cached) return cached;
  const token = localStorage.getItem('access_token');
  const res = await guardedFetch(`/api/v1/questions/${questionId}/solution`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Failed to fetch question details');
  const data: QuestionSolutionData = await res.json();
  solutionCache.set(questionId, data);
  return data;
}
