import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { useTheme, Theme } from '../../hooks/useTheme';
import { Ico } from './Icons';

interface NavbarProps {
  onLogin: () => void;
  onSignup: () => void;
  theme?: Theme;
  onToggleTheme?: () => void;
}

export function Navbar({ onLogin, onSignup, theme: propTheme, onToggleTheme: propToggleTheme }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hookTheme = useTheme();

  const theme = propTheme ?? hookTheme.theme;
  const toggleTheme = propToggleTheme ?? hookTheme.toggleTheme;

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

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
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
    { label: 'Platform', href: '#features' },
    { label: 'Methodology', href: '#how-it-works' },
    { label: 'Target Exams', href: '#exams' },
    { label: 'Plans', href: '#pricing' },
    { label: 'About Us', href: '#about' },
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
              <a
                key={item.label}
                href={item.href}
                className="nav-link"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Desktop Action Buttons (Get Started CTA on far right) */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 14 }}>
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="btn btn-primary anim-glow"
              style={{ padding: '10px 24px', fontSize: 14 }}
              onClick={onSignup}
            >
              Get Started
            </button>
          </div>

          {/* Mobile Right Actions (Theme + Hamburger Toggle) */}
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: 8 }}>
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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
                <a
                  key={item.label}
                  href={item.href}
                  className="nav-link"
                  style={{ fontSize: 16, padding: '6px 0' }}
                  onClick={() => handleNavClick(item.href)}
                >
                  {item.label}
                </a>
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
                <button
                  className="btn btn-primary anim-glow"
                  style={{ width: '100%', padding: '12px', fontSize: 15 }}
                  onClick={handleSignupClick}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

