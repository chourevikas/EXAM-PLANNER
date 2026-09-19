import React, { useEffect, useState } from 'react';
import { Trophy, RefreshCw, Gift, X } from 'lucide-react';
import { TeacherLeaderboardEntry } from '../../../types/auth';
import { fetchTeacherLeaderboard, grantTeacherReward } from '../../../services/teacherService';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export function TeacherRewardsView() {
  const { isMobile } = useBreakpoint();
  const [teachers, setTeachers] = useState<TeacherLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);
  const [rewardTarget, setRewardTarget] = useState<TeacherLeaderboardEntry | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeacherLeaderboard();
      setTeachers(data.sort((a, b) => b.total_review_points - a.total_review_points));
    } catch (err: any) {
      setError(err.message || 'Failed to load teacher leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleGrant = async (title: string, description: string, pointsValue: string) => {
    if (!rewardTarget) return;
    try {
      await grantTeacherReward(rewardTarget.teacher_id, {
        title,
        description: description || undefined,
        points_value: pointsValue ? Number(pointsValue) : undefined,
      });
      showToast(`Reward granted to ${rewardTarget.full_name}`);
      setRewardTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to grant reward', true);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 0,
        padding: isMobile ? '20px 16px' : 32,
        boxShadow: '0 12px 36px -10px rgba(15, 29, 56, 0.08)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
            Teacher Rewards
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
            View teacher review-points leaderboard and grant rewards for their contributions.
          </p>
        </div>
        <button
          onClick={load}
          style={{
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 0,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-body)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {toast && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 0,
            fontSize: 13.5,
            fontWeight: 600,
            background: toast.isError ? 'rgba(var(--primary-red-rgb), 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: toast.isError ? 'var(--primary-red)' : '#3A8B53',
            border: `1px solid ${toast.isError ? 'rgba(var(--primary-red-rgb), 0.3)' : 'rgba(16,185,129,0.3)'}`,
          }}
        >
          {toast.text}
        </div>
      )}
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
          Loading teacher leaderboard...
        </div>
      ) : teachers.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-body)',
            borderRadius: 0,
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No teachers on the platform yet. Assign the Teacher role to a user to see them here.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: 0, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '16px 20px' }}>Teacher</th>
                <th style={{ padding: '16px 20px' }}>Reviews Completed</th>
                <th style={{ padding: '16px 20px' }}>Total Points</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, idx) => (
                <tr key={t.teacher_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {idx === 0 && <Trophy size={15} color="#F47B35" />}
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 14.5 }}>{t.full_name}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--primary-red)', fontWeight: 600, marginTop: 2 }}>{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '18px 20px', fontSize: 14, color: 'var(--text-main)' }}>
                    {t.reviews_completed_count}
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#F47B35',
                      }}
                    >
                      {t.total_review_points} pts
                    </span>
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => setRewardTarget(t)}
                      style={{
                        padding: '7px 14px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        borderRadius: 0,
                        border: '1px solid #3A8B53',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#3A8B53',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Gift size={13} />
                      <span>Grant Reward</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rewardTarget && (
        <GrantRewardModal
          teacherName={rewardTarget.full_name}
          onClose={() => setRewardTarget(null)}
          onSubmit={handleGrant}
        />
      )}
    </div>
  );
}

function GrantRewardModal({
  teacherName,
  onClose,
  onSubmit,
}: {
  teacherName: string;
  onClose: () => void;
  onSubmit: (title: string, description: string, pointsValue: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsValue, setPointsValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit(title.trim(), description.trim(), pointsValue.trim());
    setSubmitting(false);
  };

  return (
    <div
      className="auth-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="auth-modal-card"
        style={{ maxWidth: 440, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Grant Reward to {teacherName}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Top Reviewer of the Month"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13.5,
                borderRadius: 0,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13.5,
                borderRadius: 0,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontFamily: 'Inter, sans-serif',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Points Value (optional, informational)
            </label>
            <input
              type="number"
              value={pointsValue}
              onChange={(e) => setPointsValue(e.target.value)}
              placeholder="e.g. 500"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13.5,
                borderRadius: 0,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            style={{
              marginTop: 4,
              padding: '11px 20px',
              fontSize: 13.5,
              fontWeight: 700,
              borderRadius: 0,
              border: '1px solid #3A8B53',
              background: !title.trim() || submitting ? 'rgba(16,185,129,0.3)' : '#3A8B53',
              color: 'var(--bg-card)',
              cursor: !title.trim() || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Granting...' : 'Grant Reward'}
          </button>
        </div>
      </div>
    </div>
  );
}
