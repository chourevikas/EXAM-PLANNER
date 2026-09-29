import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from '../../types/auth';
import { useAuth } from '@clerk/clerk-react';
import { refreshAccessToken } from '../../services/authService';
import { Spinner } from './Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [userJson, setUserJson] = useState<string | null>(() => localStorage.getItem('user'));
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const [isCheckingRecovery, setIsCheckingRecovery] = useState<boolean>(() => !localStorage.getItem('access_token') && !isSignedIn);

  useEffect(() => {
    // If token is missing and not Clerk authenticated, attempt silent session recovery from HttpOnly cookie
    if (!token && !isSignedIn) {
      refreshAccessToken()
        .then((newToken) => {
          setToken(newToken);
          setUserJson(localStorage.getItem('user'));
          setIsCheckingRecovery(false);
        })
        .catch(() => {
          setIsCheckingRecovery(false);
        });
    } else {
      setIsCheckingRecovery(false);
    }

    const handleAuthExpired = () => {
      if (token && signOut) {
        signOut().catch((e: unknown) => console.warn('Clerk auto-signout error:', e));
      }
      setToken(null);
      setUserJson(null);
    };

    const handleAuthSuccess = () => {
      setToken(localStorage.getItem('access_token'));
      setUserJson(localStorage.getItem('user'));
    };

    window.addEventListener('auth_expired', handleAuthExpired);
    window.addEventListener('user_profile_updated', handleAuthSuccess);
    window.addEventListener('storage', handleAuthSuccess);
    return () => {
      window.removeEventListener('auth_expired', handleAuthExpired);
      window.removeEventListener('user_profile_updated', handleAuthSuccess);
      window.removeEventListener('storage', handleAuthSuccess);
    };
  }, [token, isSignedIn, signOut]);

  const isCustomAuth = !!(token && userJson);
  const isClerkAuth = !!isSignedIn;
  const awaitingExchange = isLoaded && !isCheckingRecovery && isClerkAuth && !isCustomAuth;
  const [exchangeStalled, setExchangeStalled] = useState(false);

  // While ClerkExchangeBridge finishes, re-read localStorage instead of relying solely on its
  // events: a missed event (or an exchange that only succeeds on retry) otherwise left this
  // spinner up until a hard refresh. After a while, offer a way out instead of spinning forever.
  useEffect(() => {
    if (!awaitingExchange) {
      setExchangeStalled(false);
      return;
    }
    const poll = window.setInterval(() => {
      const storedToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUserJson(storedUser);
      }
    }, 500);
    const stall = window.setTimeout(() => setExchangeStalled(true), 20000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stall);
    };
  }, [awaitingExchange]);

  if (!isLoaded || isCheckingRecovery) return null;

  // If no token or user in localStorage AND not signed in via Clerk, redirect to signin
  if (!isCustomAuth && !isClerkAuth) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // If Clerk is signed in but we don't have our custom token yet, wait for ClerkExchangeBridge to finish
  if (isClerkAuth && !isCustomAuth) {
    if (exchangeStalled) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>We couldn't finish signing you in.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '9px 18px', border: 'none', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-red)', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
            >
              Retry
            </button>
            <button
              onClick={() => signOut?.().catch(() => undefined)}
              style={{ padding: '9px 18px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={48} label="Loading account..." />
      </div>
    );
  }

  let userRole: UserRole | null = null;

  if (isCustomAuth) {
    try {
      const user = JSON.parse(userJson!);
      userRole = user.role;
      // Emailed temporary password: nothing else is usable until the user picks their own.
      if (user.must_change_password) {
        return <Navigate to="/change-password" replace />;
      }
    } catch (err) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (!isClerkAuth) {
        return <Navigate to="/signin" state={{ from: location }} replace />;
      }
    }
  }

  if (isClerkAuth && !userRole) {
    userRole = UserRole.STUDENT; // Default Clerk users to student if not yet assigned/stored
  }

  // If specific roles are required, verify user's role
  if (allowedRoles && allowedRoles.length > 0 && userRole && !allowedRoles.includes(userRole)) {
    // If role unauthorized, redirect to student dashboard or landing page
    if (userRole === UserRole.STUDENT) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
