import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../services/authService';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Verification token missing from URL. Please check your link.');
      return;
    }

    const verifyToken = async () => {
      try {
        await verifyEmail(token);
        setStatus('success');
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(
          err?.message || 'Verification token is invalid or has expired. Please request a new link.'
        );
      }
    };

    verifyToken();
  }, [token, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-primary)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: 20
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        backgroundColor: 'var(--bg-card)',
        padding: 40,
        borderRadius: 0,
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        textAlign: 'center'
      }}>
        {status === 'verifying' && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px 0' }}>Verifying Your Email...</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Please wait while we validate your verification magic link.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px 0', color: '#16A34A' }}>Email Verified Successfully!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Your account is now fully verified. Redirecting to your student dashboard...
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 0,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Go to Dashboard Now
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px 0', color: '#DC2626' }}>Verification Failed</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              {errorMessage}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 0,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
