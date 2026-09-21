import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { User } from './types/auth';
import { restoreSession } from './services/authService';
import { MFA_SETUP_REQUIRED_EVENT, PASSWORD_CHANGE_REQUIRED_EVENT, SESSION_EXPIRED_EVENT, getStoredUser } from './services/http';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { MfaSetupPage } from './pages/MfaSetupPage';
import { SuperAdminPage } from './pages/SuperAdminPage';

type SessionState = { status: 'loading' } | { status: 'ready'; user: User | null };

/** Where a signed-in user must go before the portal is usable. */
function nextStep(user: User): string {
  if (user.must_change_password) return '/change-password';
  if (user.mfa_setup_required) return '/mfa-setup';
  return '/';
}

export default function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  // Pages call this after login / password change so routing sees the new session.
  const syncSession = () => setSession({ status: 'ready', user: getStoredUser() });

  useEffect(() => {
    restoreSession().then((user) => setSession({ status: 'ready', user }));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setSession({ status: 'ready', user: null });
      navigate('/login', { replace: true });
    };
    const onPasswordChange = () => navigate('/change-password', { replace: true });
    const onMfaSetup = () => navigate('/mfa-setup', { replace: true });
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChange);
    window.addEventListener(MFA_SETUP_REQUIRED_EVENT, onMfaSetup);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChange);
      window.removeEventListener(MFA_SETUP_REQUIRED_EVENT, onMfaSetup);
    };
  }, [navigate]);

  if (session.status === 'loading') return null;
  const user = session.user;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={nextStep(user)} replace /> : <LoginPage onSignedIn={syncSession} />}
      />
      <Route
        path="/change-password"
        element={user ? <ChangePasswordPage user={user} onChanged={syncSession} onSignedOut={syncSession} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/mfa-setup"
        element={
          !user ? <Navigate to="/login" replace /> : <MfaSetupPage user={user} onEnrolled={syncSession} onSignedOut={syncSession} />
        }
      />
      <Route
        path="/"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : nextStep(user) !== '/' ? (
            <Navigate to={nextStep(user)} replace />
          ) : (
            <SuperAdminPage onSignedOut={syncSession} />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
