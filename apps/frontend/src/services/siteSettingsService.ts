const API_BASE_URL = '/api/v1/site-settings';

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

export interface ThemeSettings {
  theme_name: string;
  updated_at: string;
}

export async function fetchActiveTheme(): Promise<ThemeSettings> {
  const res = await fetch(`${API_BASE_URL}/theme`);
  if (!res.ok) {
    throw new Error('Could not fetch active theme.');
  }
  return await res.json();
}

export async function updateActiveTheme(themeName: string): Promise<ThemeSettings> {
  const res = await fetch(`${API_BASE_URL}/theme`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ theme_name: themeName }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update theme' }));
    throw new Error(errorData.detail || 'Could not update theme.');
  }
  return await res.json();
}
