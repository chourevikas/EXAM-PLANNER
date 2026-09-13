import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Ico } from '../components/common/Icons';
import { UserRole } from '../types/auth';
import { loginUser } from '../services/authService';
import { useClerk, useSignIn } from '@clerk/clerk-react';

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();
  const clerk = useClerk();
  const { isSignedIn } = clerk;
  const { signIn } = useSignIn();

  React.useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F7FB', fontFamily: "'Manrope', -apple-system, system-ui, sans-serif" }}>
      <header style={{ padding: '20px 48px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 0,
            padding: '36px 32px 32px 32px',
            width: '100%',
            maxWidth: 420,
            boxShadow: '0 20px 40px -15px rgba(23, 37, 84, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.8)',
            border: '1px solid #E2E8F0',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ marginBottom: 26, textAlign: 'left' }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: '#172033', marginBottom: 6, letterSpacing: '-0.025em', fontFamily: "'Manrope', sans-serif" }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 15, color: '#64748B', margin: 0, fontWeight: 400, lineHeight: '1.45' }}>
              Sign in to access your student dashboard
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 0,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: 13.5,
                fontWeight: 500,
                marginBottom: 20,
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
                borderRadius: 0,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#3A8B53',
                fontSize: 13.5,
                fontWeight: 500,
                marginBottom: 20,
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
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: '#172033', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 0,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  padding: '0 16px',
                  fontSize: 14.5,
                  fontWeight: 400,
                  color: '#172033',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease',
                  fontFamily: "'Manrope', sans-serif",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#334EAC';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(51, 78, 172, 0.12)';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: '#172033', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    height: 52,
                    borderRadius: 0,
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    padding: '0 44px 0 16px',
                    fontSize: 14.5,
                    fontWeight: 400,
                    color: '#172033',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease',
                    fontFamily: "'Manrope', sans-serif",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#334EAC';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(51, 78, 172, 0.12)';
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2,
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ico.Eye show={showPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 0,
                backgroundColor: '#334EAC',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 600,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.8 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 6,
                transition: 'all 0.15s ease',
                fontFamily: "'Manrope', sans-serif",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#273C87';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#334EAC';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Processing...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div style={{ margin: '22px 0', textAlign: 'center', position: 'relative' }}>
            <div style={{ borderTop: '1px solid #E2E8F0' }} />
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#FFFFFF',
                padding: '0 12px',
                fontSize: 12,
                color: '#64748B',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Or
            </span>
          </div>

          <button
            type="button"
            style={{
              width: '100%',
              height: 52,
              borderRadius: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#172033',
              fontSize: 14.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.15s ease',
              fontFamily: "'Manrope', sans-serif",
            }}
            onClick={async () => {
              sessionStorage.setItem('pending_guest_sync', 'true');
              const redirectTarget = `${window.location.origin}/dashboard`;
              try {
                // Goes straight to Google's consent screen instead of opening
                // Clerk's own hosted sign-in modal (which would show a second,
                // redundant "Continue with Google" button).
                await signIn?.authenticateWithRedirect({
                  strategy: 'oauth_google',
                  redirectUrl: `${window.location.origin}/sso-callback`,
                  redirectUrlComplete: redirectTarget,
                });
              } catch (err) {
                console.error('Failed to start Google sign-in:', err);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.borderColor = '#CBD5E1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            <Ico.Google />
            <span>Continue with Google</span>
          </button>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#64748B', fontWeight: 400 }}>
            Don't have an account?{' '}
            <Link
              to="/signup"
              style={{ color: '#334EAC', fontWeight: 600, textDecoration: 'none' }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
