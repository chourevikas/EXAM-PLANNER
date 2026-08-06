import React from 'react';
import { Logo } from './Logo';
import { C } from '../../constants/theme';

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
        background: '#080E1A',
        borderTop: `1px solid ${C.slate800}`,
        padding: '56px 0 32px',
      }}
    >
      <div className="landing-container">
        <div
          className="flex flex-col lg:flex-row justify-between items-start gap-10 lg:gap-16"
          style={{ marginBottom: 48 }}
        >
          <div>
            <Logo inverted />
            <p
              style={{
                fontSize: 13,
                color: C.slate600,
                maxWidth: 240,
                lineHeight: 1.65,
                marginTop: 12,
              }}
            >
              AI-powered UPSC preparation for serious aspirants.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:gap-16 w-full lg:w-auto">
            {cols.map((col) => (
              <div key={col.h}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.slate500,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: 16,
                  }}
                >
                  {col.h}
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {col.links.map((l) => (
                    <a
                      key={l}
                      href="#"
                      style={{
                        fontSize: 14,
                        color: C.slate600,
                        textDecoration: 'none',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = C.slate400)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = C.slate600)
                      }
                    >
                      {l}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          className="flex flex-col sm:flex-row justify-between items-center gap-4"
          style={{
            borderTop: `1px solid ${C.slate800}`,
            paddingTop: 24,
          }}
        >
          <div style={{ fontSize: 13, color: C.slate600, textAlign: 'center' }}>
            © 2024 PrepAI UPSC. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Twitter', 'LinkedIn', 'YouTube', 'Telegram'].map((s) => (
              <a
                key={s}
                href="#"
                style={{
                  fontSize: 13,
                  color: C.slate600,
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = '#60A5FA')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = C.slate600)
                }
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

