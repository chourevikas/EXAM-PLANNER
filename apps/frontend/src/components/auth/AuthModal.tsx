import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import { Ico } from '../common/Icons';
import { loginUser, registerUser } from '../../services/authService';

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showApprovalPending, setShowApprovalPending] = useState(false);
  
  const navigate = useNavigate();

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
        setSuccessMsg('Signed in successfully! Redirecting...');
        setTimeout(() => {
          onClose();
          navigate(res.redirect_url || '/dashboard');
        }, 800);
      } else {
        const res = await registerUser(
          email,
          password,
          fullName
        );

        if (res.is_pending_approval) {
          setShowApprovalPending(true);
        } else {
          setSuccessMsg('🎉 Account created! Redirecting to dashboard...');
          setTimeout(() => {
            onClose();
            navigate(res.redirect_url || '/dashboard');
          }, 1200);
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

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setErrorMsg('');
    try {
      if (mode === 'login') {
        const res = await loginUser('student@examplanner.com', 'demo123');
        setSuccessMsg('Signed in with Google!');
        setTimeout(() => {
          onClose();
          navigate(res.redirect_url || '/dashboard');
        }, 800);
      } else {
        const res = await registerUser('aspirant.google@examplanner.com', 'googlePass123', 'Google Aspirant');
        if (res.is_pending_approval) {
          setShowApprovalPending(true);
        } else {
          setSuccessMsg('🎉 Registered with Google!');
          setTimeout(() => {
            onClose();
            navigate(res.redirect_url || '/dashboard');
          }, 1000);
        }
      }
    } catch (err: any) {
      setErrorMsg('Google authentication failed.');
    } finally {
      setGoogleLoading(false);
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
        background: 'rgba(9, 13, 22, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          borderRadius: 24,
          padding: 36,
          width: '100%',
          maxWidth: 440,
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          border: '1px solid var(--border-color)',
          transition: 'background-color 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'var(--bg-secondary)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          <X size={18} />
        </button>

        {showApprovalPending ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                fontSize: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              ⏳
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
              Registration Submitted!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: 24 }}>
              Your account registration has been received. Please wait for <strong>Super Admin approval & role assignment</strong> before signing in.
            </p>
            <button
              onClick={() => {
                setShowApprovalPending(false);
                onSwitchMode('login');
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: 14 }}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
                {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {mode === 'login'
                  ? 'Sign in to access your dashboard'
                  : 'Start your adaptive exam preparation'}
              </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            {/* Success Banner */}
            {successMsg && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: 'var(--emerald)',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✅</span> {successMsg}
              </div>
            )}

            {/* Google OAuth / Clerk Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: 14,
                fontWeight: 600,
                cursor: googleLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
                marginBottom: 16
              }}
            >
              <Ico.Google />
              <span>{googleLoading ? 'Connecting to Google...' : (mode === 'login' ? 'Continue with Google' : 'Sign up with Google')}</span>
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, color: 'var(--text-muted)', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
              <span style={{ padding: '0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                    minLength={mode === 'signup' ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 40px 12px 16px',
                      borderRadius: 12,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {loading
                  ? (mode === 'login' ? 'Signing In...' : 'Creating Account...')
                  : (mode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      onSwitchMode('signup');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--royal)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: 0,
                    }}
                  >
                    Create Account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      onSwitchMode('login');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--royal)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: 0,
                    }}
                  >
                    Sign In
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
