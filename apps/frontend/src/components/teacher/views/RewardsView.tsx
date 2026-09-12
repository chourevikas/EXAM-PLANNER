import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { TeacherReward } from '../../../types/auth';
import { fetchMyRewards } from '../../../services/teacherService';

export function RewardsView() {
  const [rewards, setRewards] = useState<TeacherReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyRewards()
      .then(setRewards)
      .catch((err) => setError(err.message || 'Failed to load rewards.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 0,
        padding: 32,
        boxShadow: '0 12px 36px -10px rgba(15, 29, 56, 0.08)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
        My Rewards
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px 0' }}>
        Rewards granted to you by an admin based on your review activity.
      </p>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 0,
            background: 'rgba(var(--primary-red-rgb), 0.1)',
            color: 'var(--primary-red)',
            border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
            fontSize: 13.5,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading your rewards...
        </div>
      ) : rewards.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-body)',
            borderRadius: 0,
            border: '1px solid var(--border-color)',
          }}
        >
          <Gift size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No rewards yet. Keep reviewing questions to earn points and recognition.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rewards.map((reward) => (
            <div
              key={reward.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: 18,
                background: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: 0,
              }}
            >
              <div style={{ padding: 10, background: 'rgba(244, 123, 53, 0.12)', color: '#F47B35', flexShrink: 0 }}>
                <Gift size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{reward.title}</span>
                  {reward.points_value != null && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 0,
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#3A8B53',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      {reward.points_value} pts
                    </span>
                  )}
                </div>
                {reward.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{reward.description}</div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 6 }}>
                  {new Date(reward.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
