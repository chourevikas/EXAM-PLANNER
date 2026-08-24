import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ico } from '../common/Icons';
import { UserRole } from '../../types/auth';
import { loginUser, registerUser } from '../../services/authService';
import { useClerk } from '@clerk/clerk-react';

export type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (newMode: AuthMode) => void;
}

export function AuthModal({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
}: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showApprovalPending, setShowApprovalPending] = useState(false);
  
  const navigate = useNavigate();
  const clerk = useClerk();
  const { isSignedIn } = clerk;

  React.useEffect(() => {
    if (isSignedIn && isOpen) {
      onClose();
      const syncedId = sessionStorage.getItem('latest_synced_attempt_id');
      if (syncedId) {
        sessionStorage.removeItem('latest_synced_attempt_id');
        navigate(`/analytics?attemptId=${syncedId}`);
      } else {
        navigate('/dashboard');
      }
    }
  }, [isSignedIn, isOpen, navigate, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowApprovalPending(false);

    try {
      if (mode === 'login') {
        const res = await loginUser(email, password);
        setSuccessMsg('Signed in successfully! Loading diagnostic analysis...');
        setTimeout(() => {
          onClose();
          const syncedId = sessionStorage.getItem('latest_synced_attempt_id');
          if (syncedId) {
            sessionStorage.removeItem('latest_synced_attempt_id');
            navigate(`/analytics?attemptId=${syncedId}`);
          } else {
            navigate(res.redirect_url || '/dashboard');
          }
        }, 800);
      } else {
        const res = await registerUser(
          email,
          password,
          fullName,
          UserRole.STUDENT
        );

        if (res.is_pending_approval) {
          setShowApprovalPending(true);
        } else {
          setSuccessMsg('🎉 Account created! Generating your psychometric report...');
          setTimeout(() => {
            onClose();
            const syncedId = sessionStorage.getItem('latest_synced_attempt_id');
            if (syncedId) {
              sessionStorage.removeItem('latest_synced_attempt_id');
              navigate(`/analytics?attemptId=${syncedId}`);
            } else {
              navigate(res.redirect_url || '/dashboard');
            }
          }, 1000);
        }
      }
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        setErrorMsg('User not found! Please register first.');
        setTimeout(() => {
          setErrorMsg('');
          onSwitchMode('signup');
        }, 1800);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '24px 16px',
        fontFamily: "'Manrope', -apple-system, system-ui, sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 24,
          padding: '36px 32px 32px 32px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 40px -15px rgba(23, 37, 84, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          position: 'relative',
          border: '1px solid #E2E8F0',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748B',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F1F5F9';
            e.currentTarget.style.color = '#172033';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#64748B';
          }}
        >
          <Ico.X />
        </button>

        {showApprovalPending ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#EFF6FF',
                color: '#334EAC',
                fontSize: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '1px solid #BFDBFE',
              }}
            >
              ⌛
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#172033', marginBottom: 10, letterSpacing: '-0.02em' }}>
              Registration submitted
            </h2>
            <p style={{ fontSize: 14, color: '#64748B', lineHeight: '1.55', marginBottom: 24, fontWeight: 400 }}>
              Your account registration has been received. Please wait for administrator approval before signing in.
            </p>
            <button
              onClick={() => {
                setShowApprovalPending(false);
                onSwitchMode('login');
              }}
              type="button"
              style={{
                width: '100%',
                height: 52,
                borderRadius: 12,
                background: '#334EAC',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#273C87';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#334EAC';
              }}
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 26 }}>
              <h2
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: '#172033',
                  marginBottom: 6,
                  letterSpacing: '-0.025em',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                {mode === 'login' ? 'Welcome back' : 'Create an account'}
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: '#64748B',
                  margin: 0,
                  fontWeight: 400,
                  lineHeight: '1.45',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                {mode === 'login'
                  ? 'Enter your credentials to access your portal'
                  : 'Complete your profile to get started'}
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  fontSize: 13.5,
                  fontWeight: 500,
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#059669',
                  fontSize: 13.5,
                  fontWeight: 500,
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✅</span> {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {mode === 'signup' && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: '#172033',
                      marginBottom: 6,
                    }}
                  >
                    Full name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Arjun Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{
                        width: '100%',
                        height: 52,
                        borderRadius: 12,
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        padding: '0 16px',
                        fontSize: 14.5,
                        fontWeight: 400,
                        color: '#172033',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                        fontFamily: "'Manrope', sans-serif",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#334EAC';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(51, 78, 172, 0.12)';
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: '#172033',
                    marginBottom: 6,
                  }}
                >
                  Email address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: 52,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      padding: '0 16px',
                      fontSize: 14.5,
                      fontWeight: 400,
                      color: '#172033',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease',
                      fontFamily: "'Manrope', sans-serif",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#334EAC';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(51, 78, 172, 0.12)';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: '#172033',
                    marginBottom: 6,
                  }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      height: 52,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      padding: '0 44px 0 16px',
                      fontSize: 14.5,
                      fontWeight: 400,
                      color: '#172033',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease',
                      fontFamily: "'Manrope', sans-serif",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#334EAC';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(51, 78, 172, 0.12)';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 2,
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ico.Eye show={showPassword} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: '#334EAC',
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: 600,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 6,
                  transition: 'all 0.15s ease',
                  fontFamily: "'Manrope', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#273C87';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#334EAC';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Processing...
                  </>
                ) : mode === 'login' ? (
                  'Sign in'
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            <div style={{ margin: '22px 0', textAlign: 'center', position: 'relative' }}>
              <div style={{ borderTop: '1px solid #E2E8F0' }} />
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: '#FFFFFF',
                  padding: '0 12px',
                  fontSize: 12,
                  color: '#64748B',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Or
              </span>
            </div>

            <button
              type="button"
              style={{
                width: '100%',
                height: 52,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#172033',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.15s ease',
                fontFamily: "'Manrope', sans-serif",
              }}
              onClick={() => {
                sessionStorage.setItem('pending_guest_sync', 'true');
                onClose();
                clerk.openSignIn({ fallbackRedirectUrl: '/dashboard' });
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
                e.currentTarget.style.borderColor = '#CBD5E1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }}
            >
              <Ico.Google />
              <span>Continue with Google</span>
            </button>

            <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#64748B', fontWeight: 400 }}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMode('signup')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#334EAC',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Manrope', sans-serif",
                      padding: 0,
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#334EAC',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Manrope', sans-serif",
                      padding: 0,
                    }}
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
