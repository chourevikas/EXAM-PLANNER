import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Daily allowance on the free plan, shown in the message. */
  limit?: number | null;
}

/** Shown when a free-plan student has used today's questions. */
export function FreePlanLimitModal({ open, onClose, limit }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-limit-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          padding: 24,
          boxShadow: '0 20px 48px rgba(15, 23, 42, 0.25)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}
        >
          <X size={18} />
        </button>
        <div style={{ display: 'inline-flex', padding: 10, borderRadius: 'var(--radius)', backgroundColor: '#FFFBEB', color: '#D97706', marginBottom: 12 }}>
          <Crown size={22} />
        </div>
        <h2 id="free-limit-title" style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
          You've used today's free questions
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
          The free plan includes {limit ?? 20} questions a day. Your count resets at midnight. You can still submit this
          test to see your score, answers and explanations, or upgrade to Pro for unlimited practice and full analysis.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            to="/billing"
            style={{
              padding: '11px 18px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--primary-red)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Upgrade to Pro
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '11px 18px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Continue tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}
