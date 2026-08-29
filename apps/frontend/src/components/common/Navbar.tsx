import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Logo } from './Logo';
import { Ico } from './Icons';

interface NavbarProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function Navbar({ onLogin, onSignup }: NavbarProps) {
  const navigate = useNavigate();
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

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Lock body scroll when mobile menu is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Strip any URL hash to keep URL completely clean (http://localhost:3000/)
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleNavClick = (targetId: string) => {
    setMobileMenuOpen(false);
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

  const navItems = [
    { label: 'Platform', targetId: '#features' },
    { label: 'Methodology', targetId: '#how-it-works' },
    { label: 'Plans', targetId: '#pricing' },
    { label: 'About Us', targetId: '#footer' },
  ];

  return (
    <>
      <nav
        className={`glass-nav ${scrolled ? 'scrolled' : ''}`}
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
            paddingLeft: '24px',
            paddingRight: '24px',
            width: '100%',
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
                  padding: 0,
                  font: 'inherit',
                }}
                onClick={() => handleNavClick(item.targetId)}
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
              <button
                className="btn btn-primary anim-glow"
                style={{ padding: '10px 24px', fontSize: 14 }}
                onClick={onLogin}
              >
                Get Started
              </button>
            )}
          </div>

          {/* Mobile Right Actions (Hamburger Toggle) */}
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: 8 }}>
            <button
              className="theme-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
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
          />
          <div className="mobile-drawer-content md:hidden">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="nav-link"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '6px 0',
                    textAlign: 'left',
                    font: 'inherit',
                  }}
                  onClick={() => handleNavClick(item.targetId)}
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
                  <button
                    className="btn btn-primary anim-glow"
                    style={{ width: '100%', padding: '12px', fontSize: 15 }}
                    onClick={handleLoginClick}
                  >
                    Get Started
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

