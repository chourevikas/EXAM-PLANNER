import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { exchangeClerkToken } from '../../services/authService';

/**
 * Clerk is used only for the OAuth handshake ("Continue with Google").
 * clerk.openSignIn() is fire-and-forget — on success it hard-redirects the
 * browser rather than resolving a promise in the calling component — so this
 * is mounted once at the app root and reacts to isSignedIn instead of being
 * wired into the sign-in button itself.
 *
 * When a Clerk session exists but we don't have our own session yet, it
 * exchanges the Clerk token for our own access/refresh tokens via
 * POST /auth/clerk-exchange, once. From that point on, every part of the app
 * behaves exactly like an email/password login (see authService.ts).
 */
export function ClerkExchangeBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (exchangedRef.current) return;
    if (localStorage.getItem('access_token')) return;

    exchangedRef.current = true;
    (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) {
          exchangedRef.current = false;
          return;
        }
        await exchangeClerkToken(clerkToken);
        sessionStorage.removeItem('pending_guest_sync');
        sessionStorage.removeItem('latest_synced_attempt_id');
      } catch (err) {
        console.warn('Clerk token exchange failed:', err);
        exchangedRef.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
