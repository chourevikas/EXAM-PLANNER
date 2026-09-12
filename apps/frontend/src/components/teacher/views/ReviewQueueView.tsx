import React, { useEffect, useState } from 'react';
import { ClipboardCheck, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { HumanReviewTaskSummary } from '../../../types/auth';
import { fetchReviewTasks } from '../../../services/teacherService';

interface ReviewQueueViewProps {
  onOpenQuestion: (questionId: number) => void;
}

export function ReviewQueueView({ onOpenQuestion }: ReviewQueueViewProps) {
  const [tasks, setTasks] = useState<HumanReviewTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReviewTasks(onlyFlagged);
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyFlagged]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Question Review Queue
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 0,
                background: 'rgba(var(--primary-red-rgb), 0.12)',
                color: 'var(--primary-red)',
                border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
              }}
            >
              {tasks.length} Pending
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
            Review AI-extracted questions for accuracy before they're published. You earn points for every question you review.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setOnlyFlagged((v) => !v)}
            style={{
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 0,
              border: `1px solid ${onlyFlagged ? '#F47B35' : 'var(--border-color)'}`,
              background: onlyFlagged ? 'rgba(249, 115, 22, 0.12)' : 'var(--bg-body)',
              color: onlyFlagged ? '#F47B35' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={14} />
            <span>Flagged Only</span>
          </button>
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
      </div>

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
          Loading review queue...
        </div>
      ) : tasks.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-body)',
            borderRadius: 0,
            border: '1px solid var(--border-color)',
          }}
        >
          <ClipboardCheck size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No questions pending review right now. Check back later.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 0, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '16px 20px' }}>Question</th>
                <th style={{ padding: '16px 20px' }}>Exam</th>
                <th style={{ padding: '16px 20px' }}>Flags</th>
                <th style={{ padding: '16px 20px' }}>Created</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '18px 20px', fontWeight: 700, color: 'var(--text-main)' }}>
                    #{task.question_id}
                  </td>
                  <td style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                    Exam #{task.exam_id}
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    {task.is_flagged_by_validator ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 0,
                          color: '#F47B35',
                          background: 'rgba(249, 115, 22, 0.12)',
                          border: '1px solid rgba(249, 115, 22, 0.25)',
                        }}
                      >
                        Flagged
                      </span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--text-subtle)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '18px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {new Date(task.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => onOpenQuestion(task.question_id)}
                      style={{
                        padding: '7px 14px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        borderRadius: 0,
                        border: '1px solid var(--primary-red)',
                        background: 'rgba(var(--primary-red-rgb), 0.1)',
                        color: 'var(--primary-red)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>Review</span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
