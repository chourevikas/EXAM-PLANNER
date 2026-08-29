export async function listBookmarks(): Promise<any[]> {
  const token = localStorage.getItem('access_token');
  const res = await fetch('/api/v1/users/me/bookmarks', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch bookmarks');
  return res.json();
}

export async function addBookmark(questionId: number | string): Promise<void> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`/api/v1/users/me/bookmarks/${questionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to add bookmark');
}

export async function removeBookmark(questionId: number | string): Promise<void> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`/api/v1/users/me/bookmarks/${questionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to remove bookmark');
}
