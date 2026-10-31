import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

/** The signed-in user's id and role, read when an error is sent (no name or email leaves the browser). */
function currentUser(): { id: string; role?: string } | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id != null ? { id: String(user.id), role: user.role } : null;
  } catch {
    return null;
  }
}

/** Error tracking. Off unless VITE_SENTRY_DSN was set at build time. */
export function initMonitoring() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    sendDefaultPii: false,
    // Errors only; no performance traces or session replays.
    tracesSampleRate: 0,
    ignoreErrors: [
      // Browser noise, not our bugs
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
    beforeSend(event) {
      const user = currentUser();
      if (user) {
        event.user = { id: user.id };
        event.tags = { ...event.tags, role: user.role || 'unknown' };
      }
      return event;
    },
  });
}

export const monitoringEnabled = Boolean(dsn);
