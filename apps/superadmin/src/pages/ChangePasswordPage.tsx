import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { User } from '../types/auth';
import { changePassword, logout } from '../services/authService';

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

interface Props {
  user: User;
  onChanged: () => void;
  onSignedOut: () => void;
}

export function ChangePasswordPage({ user, onChanged, onSignedOut }: Props) {
  const navigate = useNavigate();
  const mustChange = !!user.must_change_password;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      onChanged();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not change the password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    onSignedOut();
    navigate('/login', { replace: true });
  };

  const disabled = loading || !currentPassword || !newPassword || !confirmPassword;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)', padding: '36px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--deep-navy)', textAlign: 'center', marginBottom: 6 }}>
          {mustChange ? 'Choose your own password' : 'Change password'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
          {mustChange ? 'You signed in with a temporary password. Set a new one to continue.' : 'Enter your current password and choose a new one.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="sa-current" style={labelStyle}>{mustChange ? 'Temporary password' : 'Current password'}</label>
            <input id="sa-current" type="password" autoComplete="current-password" autoFocus required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="sa-new" style={labelStyle}>New password</label>
            <input id="sa-new" type="password" autoComplete="new-password" required placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="sa-confirm" style={labelStyle}>Confirm new password</label>
            <input
              id="sa-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ ...inputStyle, borderColor: confirmPassword && confirmPassword !== newPassword ? 'var(--primary-red)' : 'var(--border-color)' }}
            />
          </div>

          {error && (
            <div role="alert" style={{ padding: '10px 14px', background: '#FFF1F2', border: '1px solid #FECDD3', marginBottom: 16, fontSize: 13, color: '#BE123C' }}>
              {error}
            </div>
          )}

          <button
            id="sa-change-submit"
            type="submit"
            disabled={disabled}
            style={{
              width: '100%',
              height: 48,
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: disabled ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary-red), #C01019)',
              color: disabled ? '#94a3b8' : '#fff',
            }}
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
          <button type="button" onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
