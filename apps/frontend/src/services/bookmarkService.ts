import { guardedFetch } from '../utils/apiGuard';

export interface BookmarkItem {
  bookmark_id: string;
  question_id: string;
  question_text: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | string;
  created_at: string | null;
}

interface CacheEntry {
  data: BookmarkItem[];
  timestamp: number;
}

let bookmarksCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory client cache

export function invalidateBookmarksClientCache(): void {
  bookmarksCache = null;
}

export async function listBookmarks(options?: {
  forceRefresh?: boolean;
  limit?: number;
  skip?: number;
  signal?: AbortSignal;
}): Promise<BookmarkItem[]> {
  const now = Date.now();
  const isDefaultQuery = !options?.limit && !options?.skip;

  if (!options?.forceRefresh && isDefaultQuery && bookmarksCache && now - bookmarksCache.timestamp < CACHE_TTL_MS) {
    return bookmarksCache.data;
  }

  const token = localStorage.getItem('access_token');
  const queryParams = new URLSearchParams();
  if (options?.limit) queryParams.set('limit', String(options.limit));
  if (options?.skip) queryParams.set('skip', String(options.skip));
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const res = await guardedFetch(`/api/v1/users/me/bookmarks${queryString}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: options?.signal,
  });
  if (!res.ok) throw new Error('Failed to fetch bookmarks');
  const data: BookmarkItem[] = await res.json();

  if (isDefaultQuery) {
    bookmarksCache = { data, timestamp: now };
  }
  return data;
}

export async function addBookmark(questionId: number | string): Promise<void> {
  invalidateBookmarksClientCache();
  const token = localStorage.getItem('access_token');
  const res = await guardedFetch(`/api/v1/users/me/bookmarks/${questionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to add bookmark');
}

export async function removeBookmark(questionId: number | string): Promise<void> {
  invalidateBookmarksClientCache();
  const token = localStorage.getItem('access_token');
  const res = await guardedFetch(`/api/v1/users/me/bookmarks/${questionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove bookmark');
}
