import { useState } from 'react';
import { X, Flag, Check } from 'lucide-react';
import { REPORT_REASONS, reportQuestion } from '../../services/questionReportService';
import type { ReportReason } from '../../services/questionReportService';

interface ReportQuestionModalProps {
  questionId: number | string;
  onClose: () => void;
}

export function ReportQuestionModal({ questionId, onClose }: ReportQuestionModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const needsText = reason === 'OTHER';
  const canSubmit = !!reason && (!needsText || description.trim().length > 0) && !submitting;

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportQuestion(questionId, reason, description);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not submit your report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report this question"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.45)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--deep-navy)' }}>
            <Flag size={17} color="var(--primary-red)" />
            Report this question
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', margin: '0 auto 12px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={22} />
            </div>
            <div style={{ fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 4 }}>Thanks for letting us know</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Our team will review this question.</div>
            <button type="button" onClick={onClose} style={primaryBtn}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>What is wrong with this question?</div>
            <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    border: `1px solid ${reason === r.value ? 'var(--primary-red)' : 'var(--border-color)'}`,
                    background: reason === r.value ? 'rgba(var(--primary-red-rgb), 0.06)' : 'transparent',
                  }}
                >
                  <input type="radio" name="report-reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={needsText ? 'Please describe the problem (required)' : 'Add details (optional)'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontFamily: 'inherit', resize: 'vertical' }}
            />
            {error && (
              <div role="alert" style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius)', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={onClose} style={{ ...primaryBtn, background: 'transparent', color: 'var(--deep-navy)', border: '1px solid var(--border-color)' }}>
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={!canSubmit} style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                {submitting ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '9px 18px',
  fontSize: 13.5,
  fontWeight: 700,
  borderRadius: 'var(--radius)',
  border: '1px solid var(--primary-red)',
  background: 'var(--primary-red)',
  color: '#fff',
  cursor: 'pointer',
};
