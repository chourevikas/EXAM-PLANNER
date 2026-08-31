import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/authService';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
    }
  }, [token]);

  const passwordStrength = (() => {
    if (password.length === 0) return null;
    if (password.length < 6) return { label: 'Too short', color: '#EF4444', width: '25%' };
    if (password.length < 8) return { label: 'Weak', color: '#F97316', width: '50%' };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Fair', color: '#EAB308', width: '70%' };
    return { label: 'Strong', color: '#22C55E', width: '100%' };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/signin'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', 'Outfit', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
        padding: '40px 36px',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, #E31B23, #4F46E5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L2 7V18H8V13H12V18H18V7L10 2Z" fill="white" />
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#172033', letterSpacing: '-0.02em' }}>ExamPlanner</span>
          </div>

          {success ? (
            <>
              <div style={{
                width: 56, height: 56, background: '#F0FDF4',
                border: '2px solid #86EFAC', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#172033', margin: '0 0 8px' }}>Password reset!</h1>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
                Your password has been updated. Redirecting you to sign in…
              </p>
            </>
          ) : (
            <>
              <div style={{
                width: 56, height: 56, background: '#FFF1F2',
                border: '2px solid #FECDD3', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E31B23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#172033', margin: '0 0 8px' }}>Set a new password</h1>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
                Choose a strong password for your ExamPlanner account.
              </p>
            </>
          )}
        </div>

        {!success && (
          <form onSubmit={handleSubmit}>
            {/* New Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 700,
                color: '#374151', marginBottom: 6,
                letterSpacing: '0.03em', textTransform: 'uppercase',
              }}>
                New password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reset-password-new"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="At least 8 characters"
                  disabled={!token}
                  style={{
                    width: '100%', height: 46, padding: '0 44px 0 14px',
                    border: '1.5px solid #E2E8F0', background: '#FAFAFA',
                    fontSize: 14, color: '#172033', outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#E31B23'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94A3B8',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>

              {/* Strength bar */}
              {passwordStrength && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: passwordStrength.width,
                      background: passwordStrength.color,
                      transition: 'width 0.3s ease, background 0.3s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: passwordStrength.color, fontWeight: 600 }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 700,
                color: '#374151', marginBottom: 6,
                letterSpacing: '0.03em', textTransform: 'uppercase',
              }}>
                Confirm password
              </label>
              <input
                id="reset-password-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat your new password"
                disabled={!token}
                style={{
                  width: '100%', height: 46, padding: '0 14px',
                  border: confirmPassword && confirmPassword !== password
                    ? '1.5px solid #E31B23'
                    : '1.5px solid #E2E8F0',
                  background: '#FAFAFA', fontSize: 14, color: '#172033',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#E31B23'; }}
                onBlur={(e) => {
                  e.target.style.borderColor = confirmPassword && confirmPassword !== password ? '#E31B23' : '#E2E8F0';
                }}
              />
              {confirmPassword && confirmPassword !== password && (
                <p style={{ fontSize: 12, color: '#E31B23', marginTop: 4, marginBottom: 0 }}>
                  Passwords don't match
                </p>
              )}
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', background: '#FFF1F2',
                border: '1px solid #FECDD3', marginBottom: 16,
                fontSize: 13, color: '#BE123C',
              }}>
                {error}
              </div>
            )}

            <button
              id="reset-password-submit"
              type="submit"
              disabled={loading || !token || !password || !confirmPassword}
              style={{
                width: '100%', height: 48,
                background: loading || !token || !password || !confirmPassword
                  ? '#E2E8F0'
                  : 'linear-gradient(135deg, #E31B23, #C01019)',
                color: loading || !token || !password || !confirmPassword ? '#94A3B8' : '#FFFFFF',
                border: 'none', fontSize: 14, fontWeight: 700,
                cursor: loading || !token ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em', transition: 'all 0.15s ease',
                fontFamily: 'inherit', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Resetting password…
                </>
              ) : 'Reset Password'}
            </button>
          </form>
        )}

        {success && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Link to="/signin" style={{
              display: 'inline-block', padding: '12px 28px',
              background: 'linear-gradient(135deg, #E31B23, #C01019)',
              color: '#FFFFFF', fontWeight: 700, fontSize: 14,
              textDecoration: 'none', letterSpacing: '0.02em',
            }}>
              Go to Sign In
            </Link>
          </div>
        )}

        <div style={{
          marginTop: 28, paddingTop: 20,
          borderTop: '1px solid #F1F5F9',
          textAlign: 'center', fontSize: 13, color: '#64748B',
        }}>
          <Link to="/signin" style={{ color: '#E31B23', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
