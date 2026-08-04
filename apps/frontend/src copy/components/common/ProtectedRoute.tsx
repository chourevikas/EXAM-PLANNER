import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem('access_token');
  const userJson = localStorage.getItem('user');

  // If no token or user in localStorage, redirect to signin
  if (!token || !userJson) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  let user: User | null = null;
  try {
    user = JSON.parse(userJson);
  } catch (err) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // If specific roles are required, verify user's role
  if (allowedRoles && allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    // If role unauthorized, redirect to student dashboard or landing page
    if (user.role === UserRole.STUDENT) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
