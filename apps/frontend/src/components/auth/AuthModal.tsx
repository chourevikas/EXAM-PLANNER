import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ico } from '../common/Icons';
import { UserRole } from '../../types/auth';
import { loginUser, registerUser } from '../../services/authService';
import { SignInButton } from '@clerk/clerk-react';

export type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (newMode: AuthMode) => void;
}

export function AuthModal({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
}: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showApprovalPending, setShowApprovalPending] = useState(false);
  
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg('');
    if (role === UserRole.SUPER_ADMIN && mode === 'signup') {
      onSwitchMode('login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowApprovalPending(false);

    try {
      if (mode === 'login') {
        const res = await loginUser(email, password, selectedRole);
        setSuccessMsg('Signed in successfully! Redirecting...');
        setTimeout(() => {
          onClose();
          navigate(res.redirect_url || '/dashboard');
        }, 800);
      } else {
        const res = await registerUser(
          email,
          password,
          fullName,
          selectedRole,
          selectedRole === UserRole.ADMIN ? organizationName : undefined,
          selectedRole === UserRole.ADMIN ? department : undefined
        );

        if (res.is_pending_approval) {
          setShowApprovalPending(true);
        } else {
          setSuccessMsg('🎉 Account created! Redirecting to dashboard...');
          setTimeout(() => {
            onClose();
            navigate(res.redirect_url || '/dashboard');
          }, 1200);
        }
      }
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        if (selectedRole === UserRole.SUPER_ADMIN) {
          setErrorMsg('Invalid Super Admin credentials.');
        } else {
          setErrorMsg('User not found! Please register first.');
          setTimeout(() => {
            setErrorMsg('');
            onSwitchMode('signup');
          }, 1800);
        }
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(9, 13, 22, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          borderRadius: 24,
          padding: 36,
          width: '100%',
          maxWidth: 440,
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          border: '1px solid var(--border-color)',
          transition: 'background-color 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'var(--bg-secondary)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          <Ico.X />
        </button>

        {showApprovalPending ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'var(--blue50)',
                color: 'var(--royal)',
                fontSize: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              ⌛
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
              Registration Submitted!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: 24 }}>
              Your Admin account application has been received. Please wait for <strong>Super Admin approval</strong> before signing in.
            </p>
            <button
              onClick={() => {
                setShowApprovalPending(false);
                onSwitchMode('login');
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: 14 }}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
                {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {mode === 'login'
                  ? 'Select your role and enter credentials to sign in.'
                  : 'Select your account role and complete registration.'}
              </p>
            </div>

            {/* Role Enum Selector Tabs */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                Account Role
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

            {/* Error Banner */}
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

            {/* Success Banner */}
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arjun Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
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
              )}

              {/* Extra Admin Fields in SignUp Mode */}
              {mode === 'signup' && selectedRole === UserRole.ADMIN && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PrepAI IAS Academy"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
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
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      Department / Role Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Content Lead"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
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
                </>
              )}

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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
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
                style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 8 }}
              >
                {loading
                  ? 'Processing...'
                  : mode === 'login'
                  ? `Sign In as ${selectedRole.replace('_', ' ')}`
                  : `Create ${selectedRole.replace('_', ' ')} Account`}
              </button>
            </form>

            {/* Social Sign-In (Hidden for Super Admin) */}
            {selectedRole !== UserRole.SUPER_ADMIN && (
              <>
                <div style={{ margin: '20px 0', textAlign: 'center', position: 'relative' }}>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
                  <span
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'var(--bg-modal)',
                      padding: '0 12px',
                      fontSize: 12,
                      color: 'var(--text-subtle)',
                      fontWeight: 500,
                    }}
                  >
                    OR
                  </span>
                </div>

                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ width: '100%', padding: '11px', fontSize: 14, gap: 10 }}
                  >
                    <Ico.Google /> Continue with Clerk
                  </button>
                </SignInButton>
              </>
            )}

            {/* Switch Mode Link (Hidden for Super Admin) */}
            {selectedRole !== UserRole.SUPER_ADMIN && (
              <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      onClick={() => onSwitchMode('signup')}
                      style={{ background: 'none', border: 'none', color: 'var(--royal)', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      onClick={() => onSwitchMode('login')}
                      style={{ background: 'none', border: 'none', color: 'var(--royal)', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Log In
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
