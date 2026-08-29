import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Ico } from '../components/common/Icons';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { registerUser } from '../services/authService';

export function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await registerUser(
        email,
        password,
        fullName
      );

      if (res.is_pending_approval) {
        setShowApprovalModal(true);
      } else {
        setSuccessMsg('🎉 Account registered successfully! Logging you in...');
        setTimeout(() => {
          navigate(res.redirect_url || '/dashboard');
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setErrorMsg('');
    try {
      const res = await registerUser(
        'aspirant.google@examplanner.com',
        'googlePass123',
        'Google Aspirant'
      );
      if (res.is_pending_approval) {
        setShowApprovalModal(true);
      } else {
        setSuccessMsg('🎉 Signed up with Google!');
        setTimeout(() => {
          navigate(res.redirect_url || '/dashboard');
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google signup failed. Please use email.');
    } finally {
      setGoogleLoading(false);
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
            borderRadius: 0,
            padding: 40,
            width: '100%',
            maxWidth: 440,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>Create Account</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Start your exam preparation</p>
          </div>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(227, 27, 35, 0.1)',
                border: '1px solid rgba(227, 27, 35, 0.3)',
                color: '#ef4444',
                padding: '12px 16px',
                borderRadius: 0,
                marginBottom: 20,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
                padding: '12px 16px',
                borderRadius: 0,
                marginBottom: 20,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google Sign Up Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 0,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: 14,
              fontWeight: 600,
              cursor: googleLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s ease',
              marginBottom: 20
            }}
          >
            <Ico.Google />
            <span>{googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}</span>
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, color: 'var(--text-muted)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
            <span style={{ padding: '0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 0,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@example.com"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 0,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 16px',
                    borderRadius: 0,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
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
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 0,
                border: 'none',
                background: 'var(--royal)',
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(227, 27, 35, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/signin" style={{ color: 'var(--royal)', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>
      </main>

      {/* Pending Approval Modal */}
      {showApprovalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 0,
              padding: 36,
              maxWidth: 460,
              width: '100%',
              textAlign: 'center',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 0,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F2B623',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 28,
              }}
            >
              ⏳
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>
              Application Submitted
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              Your account registration has been submitted and is currently pending review and role assignment by Super Admin.
            </p>

            <button
              onClick={() => {
                setShowApprovalModal(false);
                navigate('/signin');
              }}
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: 0,
                border: 'none',
                background: 'var(--royal)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
