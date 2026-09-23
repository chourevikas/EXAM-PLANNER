import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { login, MfaRequiredError } from '../services/authService';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 6,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 46,
  padding: '0 14px',
  border: '1.5px solid var(--border-color)',
  background: '#fff',
  fontSize: 14,
  color: 'var(--deep-navy)',
  outline: 'none',
  fontFamily: 'inherit',
};

export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email.trim(), password, needOtp ? otp : undefined);
      onSignedIn();
      navigate(user.must_change_password ? '/change-password' : '/', { replace: true });
    } catch (err: any) {
      if (err instanceof MfaRequiredError) {
        setNeedOtp(true);
        setError('');
      } else {
        setError(err.message || 'Could not sign in.');
        if (needOtp) setOtp('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)', padding: '36px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--deep-navy)', textAlign: 'center', marginBottom: 6 }}>Super Admin sign in</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
          Restricted area. Authorised personnel only.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="sa-email" style={labelStyle}>Email</label>
            <input id="sa-email" type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="sa-password" style={labelStyle}>Password</label>
            <input id="sa-password" type="password" autoComplete="current-password" required disabled={needOtp} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </div>

          {needOtp && (
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="sa-otp" style={labelStyle}>Authenticator code</label>
              <input
                id="sa-otp"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                required
                placeholder="6-digit code or a recovery code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={inputStyle}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Open your authenticator app and enter the current code.
              </div>
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: '10px 14px', background: '#FFF1F2', border: '1px solid #FECDD3', marginBottom: 16, fontSize: 13, color: '#BE123C' }}>
              {error}
            </div>
          )}

          <button
            id="sa-login-submit"
            type="submit"
            disabled={loading || !email || !password || (needOtp && !otp)}
            style={{
              width: '100%',
              height: 48,
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: loading || !email || !password || (needOtp && !otp) ? 'not-allowed' : 'pointer',
              background: loading || !email || !password || (needOtp && !otp) ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary-red), #C01019)',
              color: loading || !email || !password || (needOtp && !otp) ? '#94a3b8' : '#fff',
            }}
          >
            {loading ? 'Signing in…' : needOtp ? 'Verify & sign in' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
