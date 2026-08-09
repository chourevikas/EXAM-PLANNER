import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';

export function SignOutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    logoutUser();
    window.dispatchEvent(new Event('storage'));
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
