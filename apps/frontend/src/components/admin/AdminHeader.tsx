import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../common/Logo';
import { useTheme } from '../../hooks/useTheme';

export function AdminHeader() {
  const { theme, toggleTheme } = useTheme();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <header className="glass-nav admin-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo />
        <span className="admin-badge">ADMIN PORTAL</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Welcome, <strong>{user.full_name || 'Admin'}</strong>
        </span>
        <Link to="/signout" className="btn btn-ghost" style={{ padding: '7px 16px', fontSize: 13, borderRadius: 10 }}>
          Sign Out
        </Link>
      </div>
    </header>
  );
}
