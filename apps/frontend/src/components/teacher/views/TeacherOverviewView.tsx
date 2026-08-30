import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Trophy, Gift, ArrowRight } from 'lucide-react';
import { fetchReviewTasks, fetchMyPoints, fetchMyRewards } from '../../../services/teacherService';

interface TeacherOverviewViewProps {
  user?: any;
  onNavigate: (view: string) => void;
}

export function TeacherOverviewView({ user, onNavigate }: TeacherOverviewViewProps) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [rewardsCount, setRewardsCount] = useState<number | null>(null);

  useEffect(() => {
    fetchReviewTasks().then((t) => setPendingCount(t.length)).catch(() => setPendingCount(0));
    fetchMyPoints().then((p) => setTotalPoints(p.total_review_points)).catch(() => setTotalPoints(0));
    fetchMyRewards().then((r) => setRewardsCount(r.length)).catch(() => setRewardsCount(0));
  }, []);

  const cards = [
    {
      id: 'review',
      icon: ClipboardCheck,
      label: 'Pending Reviews',
      value: pendingCount,
      color: '#E31B23',
      bg: 'rgba(227, 27, 35, 0.1)',
    },
    {
      id: 'points',
      icon: Trophy,
      label: 'Total Points',
      value: totalPoints,
      color: '#F47B35',
      bg: 'rgba(244, 123, 53, 0.1)',
    },
    {
      id: 'rewards',
      icon: Gift,
      label: 'Rewards Earned',
      value: rewardsCount,
      color: '#3A8B53',
      bg: 'rgba(16, 185, 129, 0.1)',
    },
  ];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 0,
          padding: '28px 32px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#E31B23',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '4px 12px',
            borderRadius: 0,
            background: 'rgba(227, 27, 35, 0.1)',
            border: '1px solid rgba(227, 27, 35, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
          }}
        >
          TEACHER PORTAL
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
          Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, margin: '8px 0 0 0' }}>
          Review pending questions, track your points, and see rewards granted to you.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              style={{
                flex: '1 1 220px',
                textAlign: 'left',
                padding: 22,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ padding: 12, background: card.bg, color: card.color }}>
                <Icon size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)' }}>
                  {card.value ?? '—'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{card.label}</div>
              </div>
              <ArrowRight size={16} color="var(--text-muted)" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
