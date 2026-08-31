import React, { useState, useEffect } from 'react';
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
  onSuccess?: () => void;
  redirectUrl?: string;
}

export function AuthModal({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
  onSuccess,
  redirectUrl
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

  useEffect(() => {
    if (isSignedIn && isOpen) {
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    }
  }, [isSignedIn, isOpen, navigate, onClose, onSuccess]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('scroll-lock');
    } else {
      document.body.classList.remove('scroll-lock');
    }
    return () => {
      document.body.classList.remove('scroll-lock');
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
        setSuccessMsg('Signed in successfully! Loading your dashboard...');
        setTimeout(() => {
          onClose();
          if (onSuccess) {
            onSuccess();
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
          setSuccessMsg('🎉 Account created! Opening your dashboard...');
          setTimeout(() => {
            onClose();
            if (onSuccess) {
              onSuccess();
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
      className="auth-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          className="touch-target"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            cursor: 'pointer',
            color: '#64748B',
            transition: 'all 0.15s ease',
            zIndex: 10,
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
                borderRadius: 0,
                background: '#F8FAFC',
                color: '#E31B23',
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
            <h2 id="auth-modal-title" style={{ fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 700, color: '#172033', marginBottom: 10, letterSpacing: '-0.02em' }}>
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
              className="touch-target"
              style={{
                width: '100%',
                height: 52,
                borderRadius: 0,
                background: '#E31B23',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#C1121F';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#E31B23';
              }}
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2
                id="auth-modal-title"
                style={{
                  fontSize: 'clamp(24px, 5vw, 30px)',
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
                  fontSize: 'clamp(13.5px, 2.5vw, 15px)',
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
                  borderRadius: 0,
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
                  borderRadius: 0,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#3A8B53',
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-fullname-input"
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
                      id="auth-fullname-input"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Arjun Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{
                        width: '100%',
                        height: 52,
                        borderRadius: 0,
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
                        e.currentTarget.style.borderColor = '#E31B23';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(227, 27, 35, 0.12)';
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
                  htmlFor="auth-email-input"
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
                    id="auth-email-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: 52,
                      borderRadius: 0,
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
                      e.currentTarget.style.borderColor = '#E31B23';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(227, 27, 35, 0.12)';
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
                  htmlFor="auth-password-input"
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
                    id="auth-password-input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      height: 52,
                      borderRadius: 0,
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
                      e.currentTarget.style.borderColor = '#E31B23';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(227, 27, 35, 0.12)';
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
                    className="touch-target"
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 8,
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ico.Eye show={showPassword} />
                  </button>
                </div>
              </div>

              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: 4, marginBottom: 2 }}>
                  <a
                    href="/forgot-password"
                    onClick={(e) => { e.preventDefault(); onClose(); navigate('/forgot-password'); }}
                    style={{
                      fontSize: 12.5,
                      color: '#E31B23',
                      fontWeight: 600,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    Forgot password?
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="touch-target"
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 0,
                  backgroundColor: '#E31B23',
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
                    e.currentTarget.style.backgroundColor = '#C1121F';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#E31B23';
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

            <div style={{ margin: '20px 0', textAlign: 'center', position: 'relative' }}>
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
              className="touch-target"
              style={{
                width: '100%',
                height: 52,
                borderRadius: 0,
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
                const redirectTarget = redirectUrl
                  ? `${window.location.origin}${redirectUrl}`
                  : `${window.location.origin}/dashboard`;
                clerk.openSignIn({
                  fallbackRedirectUrl: redirectTarget,
                  signUpFallbackRedirectUrl: redirectTarget,
                });
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

            <div style={{ marginTop: 22, textAlign: 'center', fontSize: 14, color: '#64748B', fontWeight: 400 }}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMode('signup')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#E31B23',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Manrope', sans-serif",
                      padding: '4px 0',
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
                      color: '#E31B23',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Manrope', sans-serif",
                      padding: '4px 0',
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
