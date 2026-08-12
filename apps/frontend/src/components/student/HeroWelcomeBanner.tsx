import React from 'react';
import { Link } from 'react-router-dom';
import { Ico } from '../common/Icons';

interface HeroWelcomeBannerProps {
  user: any;
}

export function HeroWelcomeBanner({ user }: HeroWelcomeBannerProps) {
  return (
    <section style={{
      marginBottom: 32,
      padding: '24px',
      borderRadius: 24,
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-color-base)',
      backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(219,39,119,0.04) 50%, rgba(16,185,129,0.06) 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 20, marginBottom: 12 }}>
            <Ico.Sparkles size={14} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target: UPSC CSE 2026 • 184 Days
            </span>
          </div>
          <h1 style={{ fontSize: 'calc(20px + 0.8vw)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Welcome back, {user?.full_name?.split(' ')[0] || 'Aspirant'}! 👋
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}><Ico.Brain /></div>
            <span><strong style={{ color: 'var(--text-primary)' }}>AI Tip:</strong> Polity accuracy up +12%! Focus on Economy next.</span>
          </div>
        </div>

        {/* Quick Action Grid */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
          <Link to="/exam/pyq_2022" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
            backgroundColor: 'var(--accent-primary)', color: '#FFF', borderRadius: 12,
            textDecoration: 'none', fontSize: 13, fontWeight: 700,
            boxShadow: '0 4px 12px var(--shadow-color-accent)', transition: 'transform 0.2s',
            flex: '1 1 auto', justifyContent: 'center'
          }}>
            <Ico.Zap size={16} /> Resume Practice
          </Link>
          <Link to="/mocks" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
            backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', borderRadius: 12,
            border: '1px solid var(--border-default)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
            flex: '1 1 auto', justifyContent: 'center'
          }}>
            <Ico.Brain size={16} /> Take Mock
          </Link>
          <Link to="/pyq" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
            backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', borderRadius: 12,
            border: '1px solid var(--border-default)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
            flex: '1 1 auto', justifyContent: 'center'
          }}>
            <Ico.Book size={16} /> Solve PYQs
          </Link>
        </div>
      </div>
    </section>
  );
}
