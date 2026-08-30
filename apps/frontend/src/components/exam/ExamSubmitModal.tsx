import React from 'react';
import { Award, Loader2 } from 'lucide-react';

interface ExamSubmitModalProps {
  isOpen: boolean;
  answeredCount?: number;
  markedCount?: number;
  unattemptedCount?: number;
  summary?: {
    answered_count: number;
    marked_for_review_count: number;
    unattempted_count: number;
    total?: number;
  };
  isSubmitting?: boolean;
  onResume?: () => void;
  onClose?: () => void;
  onConfirmSubmit?: () => void;
  onConfirm?: () => void;
}

export function ExamSubmitModal({
  isOpen,
  answeredCount,
  markedCount,
  unattemptedCount,
  summary,
  isSubmitting = false,
  onResume,
  onClose,
  onConfirmSubmit,
  onConfirm,
}: ExamSubmitModalProps) {
  const isDark = false;
  const ans = answeredCount ?? summary?.answered_count ?? 0;
  const mrk = markedCount ?? summary?.marked_for_review_count ?? 0;
  const unatt = unattemptedCount ?? summary?.unattempted_count ?? 0;
  const handleClose = onResume || onClose || (() => {});
  const handleConfirm = onConfirmSubmit || onConfirm || (() => {});

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
          borderRadius: 0,
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0'}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          width: '100%',
          maxWidth: 440,
          padding: 28,
          color: isDark ? '#ffffff' : '#172033',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 0,
            backgroundColor: isDark ? 'rgba(227, 27, 35, 0.2)' : '#F8FAFC',
            border: '1px solid #E31B23',
            color: '#E31B23',
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
            borderRadius: 0,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            marginBottom: 24
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#3A8B53' }}>{ans}</div>
            <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>Answered</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F2B623' }}>{mrk}</div>
            <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>Review</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
              {unatt}
            </div>
            <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>Left</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 0,
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc',
              color: isDark ? '#ffffff' : '#172033',
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            Resume Test
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 0,
              border: 'none',
              backgroundColor: '#E31B23',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>Confirm Submit</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
