import { useEffect } from 'react';
import { fetchCurrentUser } from '../services/authService';

/**
 * Re-reads the signed-in user when the tab regains focus, so changes made
 * elsewhere (e.g. an admin switching the subscription plan) show up without
 * a manual reload.
 */
export function useRefreshUserOnFocus(onUser: (user: any) => void): void {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden' || !localStorage.getItem('access_token')) return;
      fetchCurrentUser().then(data => data && onUser(data)).catch(() => {});
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
