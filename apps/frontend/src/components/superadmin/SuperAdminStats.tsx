import React from 'react';
import { ShieldAlert, Users, GraduationCap } from 'lucide-react';
import { SystemStats } from '../../types/auth';

interface SuperAdminStatsProps {
  stats: SystemStats | null;
  loading: boolean;
}

export function SuperAdminStats({ stats, loading }: SuperAdminStatsProps) {
  const cards = [
    {
      title: 'Pending Approvals',
      value: loading ? '...' : stats?.pending_admins_count ?? 0,
      badge: 'Action Required',
      badgeColor: '#f97316',
      color: '#f97316',
      bg: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.25)',
      icon: ShieldAlert,
    },
    {
      title: 'Active Admins',
      value: loading ? '...' : stats?.active_admins_count ?? 0,
      badge: 'Verified Accounts',
      badgeColor: '#10b981',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
      icon: Users,
    },
    {
      title: 'Active Students',
      value: loading ? '...' : stats?.active_students_count ?? 0,
      badge: 'Registered Candidates',
      badgeColor: '#3b82f6',
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.25)',
      icon: GraduationCap,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 20,
              padding: '24px 26px',
              boxShadow: '0 10px 30px -10px rgba(15, 29, 56, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 16px 36px -12px rgba(15, 29, 56, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.borderColor = card.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(15, 29, 56, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            {/* Background Ambient Glow */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: card.bg,
                filter: 'blur(30px)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: card.bg,
                  border: `1px solid ${card.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                }}
              >
                <Icon size={20} color={card.color} />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 99,
                  color: card.badgeColor,
                  background: card.bg,
                  border: `1px solid ${card.border}`,
                  letterSpacing: '0.04em',
                }}
              >
                {card.badge}
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginBottom: 6,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                {card.title}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
