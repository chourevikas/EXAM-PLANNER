import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Logo } from '../components/common/Logo';
import { User } from '../types/auth';
import { MfaSetup, confirmMfaSetup, logout, refreshCurrentUser, startMfaSetup } from '../services/authService';

interface Props {
  user: User;
  onEnrolled: () => void;
  onSignedOut: () => void;
}

const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: 'var(--bg-card)',
  border: '1px solid #E2E8F0',
  boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
  padding: '36px 32px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 46,
  padding: '0 14px',
  border: '1.5px solid var(--border-color)',
  background: '#fff',
  fontSize: 18,
  letterSpacing: '0.3em',
  textAlign: 'center',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

export function MfaSetupPage({ user, onEnrolled, onSignedOut }: Props) {
  const navigate = useNavigate();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user.mfa_enabled) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    startMfaSetup()
      .then(async (s) => {
        if (cancelled) return;
        setSetup(s);
        setQr(await QRCode.toDataURL(s.otpauth_uri, { margin: 1, width: 200 }));
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not start setup.'));
    return () => {
      cancelled = true;
    };
  }, [user.mfa_enabled, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      setRecoveryCodes(await confirmMfaSetup(code.trim()));
    } catch (err: any) {
      setError(err.message || 'That code is not valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    await refreshCurrentUser();
    onEnrolled();
    navigate('/', { replace: true });
  };

  const handleSignOut = async () => {
    await logout();
    onSignedOut();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)' }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo />
        </div>

        {recoveryCodes ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--deep-navy)', textAlign: 'center', marginBottom: 6 }}>Save your recovery codes</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
              Each code works once if you lose your authenticator. They are shown only now, so store them somewhere safe.
            </p>
            <div id="sa-recovery-codes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 14, textAlign: 'center' }}>
              {recoveryCodes.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
                style={{ flex: 1, height: 40, border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
              >
                Copy codes
              </button>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '18px 0', cursor: 'pointer' }}>
              <input id="sa-recovery-saved" type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              I have saved these recovery codes
            </label>
            <button
              id="sa-mfa-finish"
              type="button"
              disabled={!saved}
              onClick={handleFinish}
              style={{ width: '100%', height: 48, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: saved ? 'pointer' : 'not-allowed', background: saved ? 'linear-gradient(135deg, var(--primary-red), #C01019)' : 'var(--border-color)', color: saved ? '#fff' : '#94a3b8' }}
            >
              Continue to the portal
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--deep-navy)', textAlign: 'center', marginBottom: 6 }}>Set up your authenticator</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
              Super Admin accounts need a second sign-in step. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code it shows.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', minHeight: 200, marginBottom: 10 }}>
              {qr ? <img id="sa-mfa-qr" src={qr} alt="Authenticator QR code" width={200} height={200} /> : <div style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{error ? '' : 'Preparing…'}</div>}
            </div>
            {setup && (
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Can't scan? Enter this key manually:</div>
                <code id="sa-mfa-secret" style={{ fontSize: 14, letterSpacing: '0.08em', userSelect: 'all' }}>{groupSecret(setup.secret)}</code>
              </div>
            )}

            <form onSubmit={handleVerify}>
              <label htmlFor="sa-mfa-code" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                6-digit code
              </label>
              <input id="sa-mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
              {error && (
                <div role="alert" style={{ padding: '10px 14px', background: '#FFF1F2', border: '1px solid #FECDD3', margin: '14px 0 0', fontSize: 13, color: '#BE123C' }}>
                  {error}
                </div>
              )}
              <button
                id="sa-mfa-verify"
                type="submit"
                disabled={loading || code.length !== 6 || !setup}
                style={{ width: '100%', height: 48, marginTop: 16, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer', background: loading || code.length !== 6 || !setup ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary-red), #C01019)', color: loading || code.length !== 6 || !setup ? '#94a3b8' : '#fff' }}
              >
                {loading ? 'Checking…' : 'Verify and turn on'}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
          <button type="button" onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
