import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquareWarning, Check, ImagePlus } from 'lucide-react';
import { FEEDBACK_CATEGORIES, sendFeedback } from '../../services/feedbackService';
import type { FeedbackCategory } from '../../services/feedbackService';

const MAX_SCREENSHOT_MB = 5;

interface ReportProblemModalProps {
  onClose: () => void;
}

export function ReportProblemModal({ onClose }: ReportProblemModalProps) {
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSubmit = !!category && message.trim().length >= 5 && !submitting;

  const pickFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('The screenshot must be an image.');
      return;
    }
    if (file.size > MAX_SCREENSHOT_MB * 1024 * 1024) {
      setError(`The screenshot is too large (${MAX_SCREENSHOT_MB} MB at most).`);
      return;
    }
    setScreenshot(file);
  };

  const submit = async () => {
    if (!category) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendFeedback(category, message, screenshot);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not send your report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Portalled to <body>: it is opened from the sticky header, whose styles would otherwise clip it.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report a problem"
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
            <MessageSquareWarning size={17} color="var(--primary-red)" />
            Report a problem
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
            <div style={{ fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 4 }}>Thanks, we've got it</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Our team reads every report.</div>
            <button type="button" onClick={onClose} style={primaryBtn}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>What would you like to tell us?</div>
            <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {FEEDBACK_CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    border: `1px solid ${category === c.value ? 'var(--primary-red)' : 'var(--border-color)'}`,
                    background: category === c.value ? 'rgba(var(--primary-red-rgb), 0.06)' : 'transparent',
                  }}
                >
                  <input type="radio" name="feedback-category" checked={category === c.value} onChange={() => setCategory(c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="What happened, and what did you expect? (required)"
              aria-label="Describe the problem"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontFamily: 'inherit', resize: 'vertical' }}
            />

            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => fileInput.current?.click()} style={secondaryBtn}>
                <ImagePlus size={15} /> {screenshot ? 'Change screenshot' : 'Add a screenshot (optional)'}
              </button>
              {screenshot && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{screenshot.name}</span>
                  <button type="button" onClick={() => setScreenshot(null)} aria-label="Remove screenshot" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              We also send the page you're on and your browser, to help us find the problem.
            </div>

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
                {submitting ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
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

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 'var(--radius)',
  border: '1px dashed var(--border-color)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  minHeight: 40,
};
