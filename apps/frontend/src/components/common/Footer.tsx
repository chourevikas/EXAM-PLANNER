import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from './Logo';

export function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const cols = [
    {
      h: 'Platform',
      links: ['Features', 'How It Works', 'Plans'],
    },
    {
      h: 'Company',
      links: ['About Us', 'Contact Us'],
    },
  ];

  return (
    <footer
      id="footer"
      className="safe-area-bottom"
      style={{
        background: '#07112a',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: 'clamp(28px, 5vw, 48px) 0 clamp(20px, 4vw, 32px)',
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
            gap: 'clamp(24px, 4vw, 40px)',
            paddingBottom: 28,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Brand Info */}
          <div style={{ maxWidth: 320, width: '100%' }}>
            <Logo inverted />
            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                marginTop: 10,
                lineHeight: 1.6,
              }}
            >
              Master your UPSC preparation with actual PYQs and AI-driven analytics.
            </p>
          </div>

          {/* Links Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 'clamp(20px, 3vw, 48px)',
              flex: '1 1 300px',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {col.links.map((l) => {
                    const handleFooterClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();

                      if (l === 'Plans') return navigate('/plans');
                      if (l === 'About Us') return navigate('/about');
                      if (l === 'Contact Us') return navigate('/contact');

                      // Features / How It Works: anchors on the landing page only.
                      let targetId = '';
                      if (l === 'Features') targetId = '#features';
                      else if (l === 'How It Works') targetId = '#how-it-works';
                      if (!targetId) return;

                      if (location.pathname !== '/') {
                        navigate(`/${targetId}`);
                        return;
                      }
                      const el = document.querySelector(targetId);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                      if (window.location.hash) {
                        window.history.replaceState(null, '', window.location.pathname);
                      }
                    };

                    return (
                      <a
                        key={l}
                        href="#"
                        onClick={handleFooterClick}
                        style={{
                          fontSize: 13,
                          color: '#94a3b8',
                          textDecoration: 'none',
                          transition: 'color 0.2s ease',
                          padding: '6px 0',
                          display: 'inline-block',
                          minHeight: 32,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#60a5fa')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        {l}
                      </a>
                    );
                  })}
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
            © {new Date().getFullYear()} ExamPlanner. All rights reserved.
          </div>
          {/* TODO: Add real social media links once available */}
          {/* <div style={{ display: 'flex', gap: 'clamp(12px, 3vw, 24px)', flexWrap: 'wrap' }}>
              {['Twitter', 'LinkedIn', 'YouTube'].map((s) => (
                <a
                  key={s}
                  href="#"
                  style={{
                    fontSize: 12,
                    color: '#94a3b8',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                  padding: '6px 0',
                  minHeight: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#60a5fa')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  {s}
                </a>
              ))}
            </div> */}
        </div>
      </div>
    </footer>
  );
}
