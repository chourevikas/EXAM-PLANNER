import React, { useEffect, useState } from 'react';
import { Trophy, CheckCircle2, XCircle } from 'lucide-react';
import { TeacherPointsSummary } from '../../../types/auth';
import { fetchMyPoints } from '../../../services/teacherService';

export function PointsView() {
  const [summary, setSummary] = useState<TeacherPointsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyPoints()
      .then(setSummary)
      .catch((err) => setError(err.message || 'Failed to load points.'))
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
        My Review Points
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px 0' }}>
        Earn points every time you approve or reject a question in the review queue. Admins may grant rewards based on your total.
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
          Loading your points...
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            <div
              style={{
                flex: '1 1 200px',
                padding: 20,
                background: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, background: 'rgba(244, 123, 53, 0.12)', color: '#F47B35' }}>
                <Trophy size={22} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)' }}>
                  {summary?.total_review_points ?? 0}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Total Points</div>
              </div>
            </div>

            <div
              style={{
                flex: '1 1 200px',
                padding: 20,
                background: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#3A8B53' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)' }}>
                  {summary?.reviews_completed_count ?? 0}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Questions Reviewed</div>
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
            Recent Activity
          </h3>

          {!summary?.recent_logs || summary.recent_logs.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5, background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
              No review activity yet. Head to the Review Queue to get started.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '12px 16px' }}>Question</th>
                    <th style={{ padding: '12px 16px' }}>Action</th>
                    <th style={{ padding: '12px 16px' }}>Points</th>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent_logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>
                        {log.question_id ? `#${log.question_id}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 9px',
                            color: log.action === 'APPROVE' ? '#3A8B53' : 'var(--primary-red)',
                            background: log.action === 'APPROVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(var(--primary-red-rgb), 0.1)',
                            border: `1px solid ${log.action === 'APPROVE' ? 'rgba(16,185,129,0.25)' : 'rgba(var(--primary-red-rgb), 0.25)'}`,
                          }}
                        >
                          {log.action === 'APPROVE' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#F47B35' }}>+{log.points}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
