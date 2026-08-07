import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from '../../types/auth';
import { useAuth } from '@clerk/clerk-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem('access_token');
  const userJson = localStorage.getItem('user');
  
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;

  const isCustomAuth = !!(token && userJson);
  const isClerkAuth = !!isSignedIn;

  // If no token or user in localStorage AND not signed in via Clerk, redirect to signin
  if (!isCustomAuth && !isClerkAuth) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
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

  if (isClerkAuth) {
    userRole = UserRole.STUDENT; // Default Clerk users to student
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
