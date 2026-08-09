import React from 'react';
import { Award } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ExamSubmitModalProps {
  isOpen: boolean;
  answeredCount: number;
  markedCount: number;
  unattemptedCount: number;
  onResume: () => void;
  onConfirmSubmit: () => void;
}

export function ExamSubmitModal({
  isOpen,
  answeredCount,
  markedCount,
  unattemptedCount,
  onResume,
  onConfirmSubmit,
}: ExamSubmitModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        style={{
          backgroundColor: isDark ? '#0f1e3c' : '#ffffff',
          borderRadius: 20,
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0'}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          width: '100%',
          maxWidth: 440,
          padding: 28,
          color: isDark ? '#ffffff' : '#0f172a',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
            border: '1px solid #3b82f6',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}
        >
          <Award size={30} />
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px 0' }}>Submit Test Confirmation</h3>
        <p style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          Are you sure you want to finish and submit your exam?
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            padding: 14,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            marginBottom: 24
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{answeredCount}</div>
            <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>Answered</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{markedCount}</div>
            <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>Review</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
              {unattemptedCount}
            </div>
            <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>Left</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onResume}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
              color: isDark ? '#ffffff' : '#0f172a',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Resume Test
          </button>
          <button
            onClick={onConfirmSubmit}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Confirm Submit
          </button>
        </div>
      </div>
    </div>
  );
}
