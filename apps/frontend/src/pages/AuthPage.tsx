import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthModal, AuthMode } from '../components/auth/AuthModal';
import { marketingUrl } from '../components/common/MarketingRedirect';

/**
 * Standalone /signin and /signup entry points. The landing page itself now lives on the Astro
 * marketing site, so this renders only the auth modal over a plain backdrop; closing it goes home.
 */
export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  useEffect(() => setMode(initialMode), [initialMode]);

  // Only accept an in-app relative path (starts with a single "/") as a post-login redirect target,
  // so a crafted `redirect=` query value can never send navigate() anywhere outside this SPA.
  const raw = new URLSearchParams(location.search).get('redirect');
  const redirectUrl = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined;

  return (
    <div className="landing-page" style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
      <AuthModal
        isOpen
        mode={mode}
        onClose={() => window.location.assign(marketingUrl('/'))}
        onSwitchMode={setMode}
        redirectUrl={redirectUrl}
      />
    </div>
  );
}
