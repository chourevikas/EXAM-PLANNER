import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';

export function SignOutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    logoutUser();
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
