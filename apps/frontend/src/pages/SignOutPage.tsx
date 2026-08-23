import React, { useEffect } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { logoutUser } from '../services/authService';

export function SignOutPage() {
  const clerk = useClerk();

  useEffect(() => {
    async function doLogout() {
      logoutUser();
      if (clerk && clerk.signOut) {
        try {
          await clerk.signOut();
        } catch (e) {
          console.warn('Clerk signout error:', e);
        }
      }
      window.location.href = '/';
    }
    doLogout();
  }, [clerk]);

  return null;
}
