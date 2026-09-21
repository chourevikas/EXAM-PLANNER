import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { changePassword, logoutUser } from '../services/authService';

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
  background: 'var(--bg-subtle)',
  fontSize: 14,
  color: 'var(--deep-navy)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!localStorage.getItem('access_token')) {
    return <Navigate to="/signin" replace />;
  }

  const mustChange = (() => {
    try {
      return !!JSON.parse(localStorage.getItem('user') || '{}').must_change_password;
    } catch {
      return false;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      navigate(res.redirect_url || '/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not change the password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    logoutUser();
    navigate('/signin', { replace: true });
  };

  const disabled = loading || !currentPassword || !newPassword || !confirmPassword;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Inter', 'Outfit', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--bg-card)',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
          padding: '40px 36px',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--deep-navy)', margin: '0 0 8px', textAlign: 'center' }}>
          {mustChange ? 'Choose your own password' : 'Change password'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 28px', textAlign: 'center' }}>
          {mustChange
            ? 'You signed in with a temporary password. Set a new one to continue.'
            : 'Enter your current password and choose a new one.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="change-password-current" style={labelStyle}>
              {mustChange ? 'Temporary password' : 'Current password'}
            </label>
            <input
              id="change-password-current"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="change-password-new" style={labelStyle}>New password</label>
            <input
              id="change-password-new"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="change-password-confirm" style={labelStyle}>Confirm new password</label>
            <input
              id="change-password-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                ...inputStyle,
                borderColor: confirmPassword && confirmPassword !== newPassword ? 'var(--primary-red)' : 'var(--border-color)',
              }}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p style={{ fontSize: 12, color: 'var(--primary-red)', margin: '4px 0 0' }}>Passwords don't match</p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              style={{ padding: '10px 14px', background: '#FFF1F2', border: '1px solid #FECDD3', marginBottom: 16, fontSize: 13, color: '#BE123C' }}
            >
              {error}
            </div>
          )}

          <button
            id="change-password-submit"
            type="submit"
            disabled={disabled}
            style={{
              width: '100%',
              height: 48,
              background: disabled ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary-red), #C01019)',
              color: disabled ? 'var(--text-disabled)' : 'var(--bg-card)',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #F1F5F9', textAlign: 'center', fontSize: 13 }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
