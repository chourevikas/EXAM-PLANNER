import { useEffect, useRef, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { exchangeClerkToken } from '../../services/authService';

/**
 * Clerk is used only for the OAuth handshake ("Continue with Google").
 * clerk.openSignIn() is fire-and-forget — on success it hard-redirects the
 * browser rather than resolving a promise in the calling component — so this
 * is mounted once at the app root and reacts to isSignedIn instead of being
 * wired into the sign-in button itself.
 *
 * When a Clerk session exists, it exchanges the Clerk token along with the
 * student's verified profile details (name, email, profile picture) for our own
 * session tokens via POST /auth/clerk-exchange.
 * It also automatically heals existing sessions if they contain synthetic
 * "@clerk.local" emails or placeholder "Clerk Sync User" names.
 */
const MAX_EXCHANGE_RETRIES = 5;

export function ClerkExchangeBridge() {
  const { isLoaded: isAuthLoaded, isSignedIn, getToken } = useAuth();
  const { isLoaded: isUserLoaded, user: clerkUser } = useUser();
  const exchangedRef = useRef(false);
  // Bumped after a failed exchange so the effect re-runs. Without it a transient failure (Clerk
  // returning no token right after the OAuth redirect, a 5xx while a new account is created)
  // left ProtectedRoute on "Loading account..." until a hard refresh.
  const [retryTick, setRetryTick] = useState(0);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!isAuthLoaded || !isUserLoaded || !isSignedIn || !clerkUser) return;

    const existingToken = localStorage.getItem('access_token');
    const existingUserRaw = localStorage.getItem('user');
    let hasPlaceholderInfo = false;

    if (existingUserRaw) {
      try {
        const u = JSON.parse(existingUserRaw);
        if (
          !u.full_name ||
          u.full_name === 'Clerk Sync User' ||
          u.full_name === 'Clerk Account' ||
          u.full_name.startsWith('Candidate #') ||
          !u.email ||
          u.email.includes('@clerk.local')
        ) {
          hasPlaceholderInfo = true;
        }
      } catch {
        hasPlaceholderInfo = true;
      }
    }

    // If we already have a clean session and do not need to heal placeholder data, exit
    if (existingToken && !hasPlaceholderInfo) return;

    if (exchangedRef.current) return;
    exchangedRef.current = true;

    (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) throw new Error('Clerk returned no session token');

        const email =
          clerkUser.primaryEmailAddress?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress;
        const fullName =
          clerkUser.fullName ||
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
          undefined;
        const profileImage = clerkUser.imageUrl || undefined;

        await exchangeClerkToken(clerkToken, {
          email,
          fullName,
          profileImage,
        });

        attemptsRef.current = 0;
        sessionStorage.removeItem('pending_guest_sync');
        sessionStorage.removeItem('latest_synced_attempt_id');

        window.dispatchEvent(new Event('user_profile_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.warn('Clerk token exchange failed:', err);
        exchangedRef.current = false;
        if (attemptsRef.current < MAX_EXCHANGE_RETRIES) {
          const delay = Math.min(1000 * 2 ** attemptsRef.current, 8000);
          attemptsRef.current += 1;
          setTimeout(() => setRetryTick((t) => t + 1), delay);
        }
      }
    })();
  }, [isAuthLoaded, isUserLoaded, isSignedIn, clerkUser, getToken, retryTick]);

  return null;
}
