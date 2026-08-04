import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { C } from '../constants/theme';
import { logoutUser } from '../services/authService';

export function SignOutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    logoutUser();

    const timer = setTimeout(() => {
      navigate('/');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.ivory }}>
      <header style={{ padding: '20px 52px', borderBottom: `1px solid ${C.border}`, background: '#fff' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: 40,
            width: '100%',
            maxWidth: 440,
            textAlign: 'center',
            boxShadow: '0 20px 40px -15px rgba(15,23,42,0.08)',
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: C.blue50,
              color: C.royal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 24,
            }}
          >
            👋
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, marginBottom: 8 }}>Signed Out</h1>
          <p style={{ fontSize: 14, color: C.grey, marginBottom: 24 }}>
            You have been successfully signed out. Your session has ended.
          </p>

          <Link to="/" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14 }}>
            Return to Home Now
          </Link>
        </div>
      </main>
    </div>
  );
}
