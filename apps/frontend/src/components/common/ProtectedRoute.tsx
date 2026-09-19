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

  if (!isLoaded || isCheckingRecovery) return null;

  const isCustomAuth = !!(token && userJson);
  const isClerkAuth = !!isSignedIn;

  // If no token or user in localStorage AND not signed in via Clerk, redirect to signin
  if (!isCustomAuth && !isClerkAuth) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // If Clerk is signed in but we don't have our custom token yet, wait for ClerkExchangeBridge to finish
  if (isClerkAuth && !isCustomAuth) {
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
