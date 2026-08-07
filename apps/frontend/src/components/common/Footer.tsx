import React from 'react';
import { Logo } from './Logo';

export function Footer() {
  const cols = [
    {
      h: 'Platform',
      links: ['Features', 'How It Works', 'Dashboard', 'Pricing'],
    },
    {
      h: 'Legal',
      links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'],
    },
    {
      h: 'Support',
      links: ['Contact Us', 'Help Center', 'Community', 'Telegram'],
    },
  ];

  return (
    <footer
      style={{
        background: '#07112a',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '36px 0 24px',
        color: '#94a3b8',
      }}
    >
      <div className="landing-container">
        {/* Main compact flex layout */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 32,
            paddingBottom: 28,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Brand Info */}
          <div style={{ maxWidth: 280 }}>
            <Logo inverted />
            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                marginTop: 10,
                lineHeight: 1.6,
              }}
            >
              AI-powered exam preparation platform for serious aspirants.
            </p>
          </div>

          {/* Links Grid */}
          <div
            style={{
              display: 'flex',
              gap: '48px',
              flexWrap: 'wrap',
            }}
          >
            {cols.map((col) => (
              <div key={col.h}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#f8fafc',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {col.h}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.links.map((l) => (
                    <a
                      key={l}
                      href="#"
                      style={{
                        fontSize: 13,
                        color: '#94a3b8',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#60a5fa')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      {l}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom compact row */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            paddingTop: 20,
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b' }}>
            © {new Date().getFullYear()} RankEdge. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Twitter', 'LinkedIn', 'YouTube', 'Telegram'].map((s) => (
              <a
                key={s}
                href="#"
                style={{
                  fontSize: 12,
                  color: '#94a3b8',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#60a5fa')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
