import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Ico } from '../components/common/Icons';
import { UserRole } from '../types/auth';
import { loginUser } from '../services/authService';
import { SignInButton } from '@clerk/clerk-react';

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await loginUser(email, password, selectedRole);
      setSuccessMsg('Signed in successfully! Redirecting...');
      setTimeout(() => {
        navigate(res.redirect_url || '/dashboard');
      }, 800);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        if (selectedRole === UserRole.SUPER_ADMIN) {
          setErrorMsg('Invalid Super Admin credentials.');
        } else {
          setErrorMsg('User not found! Redirecting to register page...');
          setTimeout(() => {
            navigate('/signup');
          }, 1800);
        }
      } else {
        setErrorMsg(err.message || 'Failed to sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>
      <header style={{ padding: '20px 52px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 24,
            padding: 40,
            width: '100%',
            maxWidth: 440,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>Welcome Back</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sign in to access your dashboard</p>
          </div>

          {/* Role Selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
              Select Role
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                background: 'var(--bg-secondary)',
                padding: 4,
                borderRadius: 12,
                border: '1px solid var(--border-color)',
              }}
            >
              {[
                { role: UserRole.STUDENT, label: 'Student', emoji: '🎓' },
                { role: UserRole.ADMIN, label: 'Admin', emoji: '⚙️' },
                { role: UserRole.SUPER_ADMIN, label: 'Super Admin', emoji: '👑' },
              ].map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => handleRoleChange(item.role)}
                  style={{
                    padding: '8px 4px',
                    fontSize: 12,
                    fontWeight: selectedRole === item.role ? 700 : 500,
                    color: selectedRole === item.role ? '#ffffff' : 'var(--text-muted)',
                    background: selectedRole === item.role ? 'var(--royal)' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <span>{item.emoji}</span> {item.label}
                </button>
              ))}
            </div>
          </div>

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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-body)',
                  color: 'var(--text-main)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Password</label>
                <a href="#" style={{ fontSize: 12, color: 'var(--royal)', textDecoration: 'none', fontWeight: 600 }}>
                  Forgot Password?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-body)',
                    color: 'var(--text-main)',
                    fontSize: 14,
                    outline: 'none',
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
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                  }}
                >
                  <Ico.Eye show={showPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 6 }}
            >
              {loading ? 'Signing In...' : `Sign In as ${selectedRole.replace('_', ' ')}`}
            </button>
          </form>

          {/* Social Sign In (Only for non Super Admin) */}
          {selectedRole !== UserRole.SUPER_ADMIN && (
            <>
              <div style={{ margin: '24px 0', textAlign: 'center', position: 'relative' }}>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
                <span
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'var(--bg-card)',
                    padding: '0 12px',
                    fontSize: 12,
                    color: 'var(--text-subtle)',
                    fontWeight: 500,
                  }}
                >
                  OR
                </span>
              </div>

              <SignInButton mode="modal">
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: '100%', padding: '12px', fontSize: 14, gap: 10 }}
                >
                  <Ico.Google /> Continue with Clerk
                </button>
              </SignInButton>
            </>
          )}

          {/* Sign Up Link - Hidden for Super Admin */}
          {selectedRole !== UserRole.SUPER_ADMIN && (
            <div style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: 'var(--royal)', fontWeight: 700, textDecoration: 'none' }}>
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
