import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Sparkles, UserPlus } from 'lucide-react';

interface GuestScoreModalProps {
  isOpen: boolean;
  scoreData: {
    score: number;
    totalMarksPossible: number;
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    accuracy: number;
    totalQuestions: number;
    topicName: string;
    subtopicName: string;
    targetExam: string;
    targetYear: string;
  };
  onClose: () => void;
  onRetake: () => void;
}

export function GuestScoreModal({ isOpen, scoreData, onClose, onRetake }: GuestScoreModalProps) {
  const navigate = useNavigate();

  if (!isOpen || !scoreData) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: '28px 30px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: '#EFF6FF',
            color: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
          }}
        >
          <Trophy size={24} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>
          Guest Mock Performance
        </h2>

        <p style={{ fontSize: 12.5, color: '#64748B', margin: '0 0 16px 0' }}>
          {scoreData.targetExam} · {scoreData.topicName} ({scoreData.subtopicName})
        </p>

        {/* Estimated Score Pill */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            padding: '14px',
            marginBottom: 16,
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Score
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', margin: '2px 0' }}>
            {scoreData.score}{' '}
            <span style={{ fontSize: 16, color: '#64748B', fontWeight: 600 }}>/ {scoreData.totalMarksPossible}</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#059669' }}>
            Accuracy: {scoreData.accuracy}%
          </div>
        </div>

        {/* Breakdown Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>CORRECT</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>{scoreData.correctCount}</div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>WRONG</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>{scoreData.incorrectCount}</div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>UNATTEMPTED</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#64748B' }}>{scoreData.unattemptedCount}</div>
          </div>
        </div>

        {/* CTA Banner */}
        <div
          style={{
            background: '#EFF6FF',
            borderRadius: 10,
            padding: 14,
            marginBottom: 18,
            border: '1px solid #DBEAFE',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#2563EB', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={14} /> Save Performance & Track Weak Areas
          </div>
          <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.45 }}>
            Create a free account to track historical progress, unlock psychometric analytics, and follow adaptive study plans.
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <UserPlus size={15} /> Create Account
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back Home
          </button>
        </div>
      </div>
    </div>
  );
}
