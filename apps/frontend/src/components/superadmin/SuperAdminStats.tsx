import React from 'react';
import { ShieldAlert, Users, GraduationCap, Database, Activity } from 'lucide-react';
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
      badgeColor: '#f59e0b',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      icon: ShieldAlert,
    },
    {
      title: 'Active Admins',
      value: loading ? '...' : stats?.active_admins_count ?? 0,
      badge: 'Verified Accounts',
      badgeColor: '#10b981',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      icon: Users,
    },
    {
      title: 'Active Students',
      value: loading ? '...' : stats?.active_students_count ?? 0,
      badge: 'Registered Candidates',
      badgeColor: '#2563eb',
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.12)',
      icon: GraduationCap,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20, marginBottom: 28 }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 18,
              padding: 24,
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: card.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={20} color={card.color} />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 99,
                  color: card.badgeColor,
                  background: card.bg,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {card.badge}
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.5px',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-body)' }}>
                {card.title}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
