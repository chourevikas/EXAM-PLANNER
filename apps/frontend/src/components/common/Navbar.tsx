import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Logo } from './Logo';
import { Ico } from './Icons';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface NavbarProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function Navbar({ onLogin, onSignup }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  useEffect(() => {
    const hasCustomToken = !!localStorage.getItem('access_token');
    if (isLoaded && (isSignedIn || hasCustomToken)) {
      setIsUserLoggedIn(true);
    }
  }, [isLoaded, isSignedIn]);
  const { isTabletOrBelow } = useBreakpoint();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('scroll-lock');
    } else {
      document.body.classList.remove('scroll-lock');
    }
    return () => {
      document.body.classList.remove('scroll-lock');
    };
  }, [mobileMenuOpen]);

  // Auto close mobile drawer on desktop resize
  useEffect(() => {
    if (!isTabletOrBelow && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isTabletOrBelow, mobileMenuOpen]);

  // Strip any URL hash to keep URL clean
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleNavClick = (targetId: string) => {
    setMobileMenuOpen(false);
    // These anchors only exist on the landing page - navigate home first if elsewhere,
    // and let LandingPage's hash-scroll effect handle the actual scroll on arrival.
    if (location.pathname !== '/') {
      navigate(`/${targetId}`);
      return;
    }
    const element = document.querySelector(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    onLogin();
  };

  const handleSignupClick = () => {
    setMobileMenuOpen(false);
    onSignup();
  };

  const navItems: Array<{ label: string; targetId?: string; to?: string }> = [
    { label: 'Platform', targetId: '#features' },
    { label: 'Methodology', targetId: '#how-it-works' },
    { label: 'Plans', to: '/plans' },
    { label: 'About Us', to: '/about' },
    { label: 'Contact Us', to: '/contact' },
  ];

  const handleNavItemClick = (item: { targetId?: string; to?: string }) => {
    if (item.to) {
      setMobileMenuOpen(false);
      navigate(item.to);
      return;
    }
    if (item.targetId) {
      handleNavClick(item.targetId);
    }
  };

  return (
    <>
      <nav
        className={`glass-nav ${scrolled ? 'scrolled' : ''}`}
        role="navigation"
        aria-label="Main Navigation"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: 66,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 'clamp(16px, 4vw, 32px)',
            paddingRight: 'clamp(16px, 4vw, 32px)',
            width: '100%',
            maxWidth: 1320,
            margin: '0 auto',
          }}
        >
          <Logo />

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 32 }}>
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="nav-link"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  font: 'inherit',
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => handleNavItemClick(item)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Desktop Action Buttons (Get Started CTA on far right) */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 14 }}>
            {isUserLoggedIn ? (
              <button
                className="btn btn-primary anim-glow"
                style={{ padding: '10px 24px', fontSize: 14 }}
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  className="btn btn-ghost touch-target"
                  style={{ padding: '10px 20px', fontSize: 14 }}
                  onClick={onLogin}
                >
                  Login
                </button>
                <button
                  className="btn btn-primary anim-glow touch-target"
                  style={{ padding: '10px 24px', fontSize: 14 }}
                  onClick={onSignup}
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Right Actions (Hamburger Toggle) */}
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: 8 }}>
            <button
              className="theme-toggle-btn touch-target"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={mobileMenuOpen}
              style={{ fontSize: 18 }}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-drawer-overlay md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="mobile-drawer-content md:hidden" role="dialog" aria-modal="true" aria-label="Mobile Navigation Menu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="nav-link touch-target"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '10px 0',
                    textAlign: 'left',
                    font: 'inherit',
                    width: '100%',
                    justifyContent: 'flex-start',
                  }}
                  onClick={() => handleNavItemClick(item)}
                >
                  {item.label}
                </button>
              ))}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 12,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                {isUserLoggedIn ? (
                  <button
                    className="btn btn-primary anim-glow"
                    style={{ width: '100%', padding: '12px', fontSize: 15 }}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/dashboard');
                    }}
                  >
                    Go to Dashboard
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost"
                      style={{ width: '100%', padding: '12px', fontSize: 15 }}
                      onClick={handleLoginClick}
                    >
                      Login
                    </button>
                    <button
                      className="btn btn-primary anim-glow"
                      style={{ width: '100%', padding: '12px', fontSize: 15 }}
                      onClick={handleSignupClick}
                    >
                      Get Started
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
