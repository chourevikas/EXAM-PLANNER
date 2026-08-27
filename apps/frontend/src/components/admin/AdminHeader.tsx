import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { Logo } from '../common/Logo';
import { logoutUser } from '../../services/authService';

export function AdminHeader() {
  const navigate = useNavigate();
  const clerk = useClerk();
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
        <button
          type="button"
          onClick={async () => {
            logoutUser();
            if (clerk && clerk.signOut) {
              try {
                await clerk.signOut();
              } catch (e) {
                console.warn('Clerk signout error:', e);
              }
            }
            window.location.href = '/';
          }}
          className="btn btn-ghost"
          style={{ padding: '7px 16px', fontSize: 13, borderRadius: 10, cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
