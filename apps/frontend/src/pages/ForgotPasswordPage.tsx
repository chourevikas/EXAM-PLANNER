import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      // We never reveal whether the email exists — show success always
      // but surface actual API / network errors
      if (err.message === 'Failed to fetch') {
        setError('Network error. Please check your connection and try again.');
      } else {
        setSent(true); // security: always show success
      }
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
        background: 'var(--bg-card)',
        border: '1px solid #E2E8F0',
        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
        padding: '40px 36px',
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
          }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, var(--primary-red), #4F46E5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L2 7V18H8V13H12V18H18V7L10 2Z" fill="white" />
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--deep-navy)', letterSpacing: '-0.02em' }}>
              ExamPlanner
            </span>
          </div>

          {sent ? (
            <>
              <div style={{
                width: 56,
                height: 56,
                background: '#F0FDF4',
                border: '2px solid #86EFAC',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--deep-navy)', margin: '0 0 8px' }}>
                Check your email
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                If <strong>{email}</strong> is registered with ExamPlanner, you'll receive a password reset link shortly.
              </p>
            </>
          ) : (
            <>
              <div style={{
                width: 56,
                height: 56,
                background: '#FFF1F2',
                border: '2px solid #FECDD3',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--deep-navy)', margin: '0 0 8px' }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                Enter your registered email and we'll send you a secure reset link.
              </p>
            </>
          )}
        </div>

        {!sent && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#374151',
                marginBottom: 6,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}>
                Email address
              </label>
              <input
                id="forgot-password-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  height: 46,
                  padding: '0 14px',
                  border: error ? '2px solid var(--primary-red)' : '1.5px solid #E2E8F0',
                  background: 'var(--bg-subtle)',
                  fontSize: 14,
                  color: 'var(--deep-navy)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--primary-red)'; }}
                onBlur={(e) => { if (!error) e.target.style.borderColor = 'var(--border-color)'; }}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                background: '#FFF1F2',
                border: '1px solid #FECDD3',
                marginBottom: 16,
                fontSize: 13,
                color: '#BE123C',
              }}>
                {error}
              </div>
            )}

            <button
              id="forgot-password-submit"
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                width: '100%',
                height: 48,
                background: loading || !email.trim()
                  ? 'var(--border-color)'
                  : 'linear-gradient(135deg, var(--primary-red), #C01019)',
                color: loading || !email.trim() ? 'var(--text-disabled)' : 'var(--bg-card)',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Sending reset link…
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        )}

        {sent && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
              Didn't receive it? Check your spam folder or{' '}
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-red)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                try again
              </button>.
            </p>
          </div>
        )}

        <div style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: '1px solid #F1F5F9',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}>
          <Link to="/signin" style={{ color: 'var(--primary-red)', fontWeight: 600, textDecoration: 'none' }}>
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
