import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { useTheme, Theme } from '../../hooks/useTheme';

interface NavbarProps {
  onLogin: () => void;
  onSignup: () => void;
  theme?: Theme;
  onToggleTheme?: () => void;
}

export function Navbar({ onLogin, onSignup, theme: propTheme, onToggleTheme: propToggleTheme }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const hookTheme = useTheme();

  const theme = propTheme ?? hookTheme.theme;
  const toggleTheme = propToggleTheme ?? hookTheme.toggleTheme;

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav
      className="glass-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: 'box-shadow 0.25s ease, background 0.3s ease',
        boxShadow: scrolled ? '0 1px 32px rgba(15,23,42,0.12)' : 'none',
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '0 52px',
          height: 66,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          {['Features', 'How It Works', 'Exams', 'About'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s/g, '-')}`}
              className="nav-link"
            >
              {item}
            </a>
          ))}
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Pricing
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                background: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                padding: '2px 7px',
                borderRadius: 99,
                letterSpacing: '0.4px',
                border: '1px solid var(--border-color)',
              }}
            >
              SOON
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '9px 20px', fontSize: 14 }}
            onClick={onLogin}
          >
            Login
          </button>
          <button
            className="btn btn-primary anim-glow"
            style={{ padding: '9px 20px', fontSize: 14 }}
            onClick={onSignup}
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}
