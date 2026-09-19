import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../../common/StatusBadge';
import { fetchReviewTaskDetail, approveReviewTask, rejectReviewTask } from '../../../services/teacherService';

interface ReviewTaskDetailViewProps {
  questionId: number;
  onBack: () => void;
  onDecided: () => void;
}

interface OptionDetail {
  option_id: string;
  option_label: string;
  is_correct: boolean;
  translations: { language: string; text: string }[];
}

export function ReviewTaskDetailView({ questionId, onBack, onDecided }: ReviewTaskDetailViewProps) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [correctLabel, setCorrectLabel] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchReviewTaskDetail(questionId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        const existingCorrect = (data.options || []).find((o: OptionDetail) => o.is_correct);
        setCorrectLabel(existingCorrect ? existingCorrect.option_label : null);
      })
      .catch((err) => !cancelled && setError(err.message || 'Failed to load question.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  const englishText = (translations: any[] = []) =>
    translations.find((t) => t.language === 'ENGLISH')?.question_text
    || translations[0]?.question_text
    || '';

  const optionText = (opt: OptionDetail) =>
    opt.translations?.find((t) => t.language === 'ENGLISH')?.text
    || opt.translations?.[0]?.text
    || '';

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await approveReviewTask(questionId, {
        reviewer_notes: reviewerNotes || undefined,
        correct_option_label: correctLabel || undefined,
      });
      onDecided();
    } catch (err: any) {
      setError(err.message || 'Failed to approve question.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await rejectReviewTask(questionId, rejectionReason, reviewerNotes || undefined);
      onDecided();
    } catch (err: any) {
      setError(err.message || 'Failed to reject question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: 32,
        boxShadow: '0 12px 36px -10px rgba(15, 29, 56, 0.08)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 20,
          padding: 0,
        }}
      >
        <ArrowLeft size={15} />
        <span>Back to Review Queue</span>
      </button>

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading question...
        </div>
      ) : !detail ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          {error || 'Question not found.'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Question #{detail.question_number}
            </h2>
            <StatusBadge status={detail.status === 'PUBLISHED' ? 'completed' : 'in-progress'} label={detail.status} showIcon={false} />
            {detail.audit_flagged && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius)',
                  color: '#F47B35',
                  background: 'rgba(249, 115, 22, 0.12)',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertTriangle size={12} />
                Flagged by validator
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {detail.section_code} · {detail.difficulty} · {detail.marks} marks
            {detail.failure_reasons && detail.failure_reasons.length > 0 && (
              <span> · Issues: {detail.failure_reasons.join(', ')}</span>
            )}
          </div>

          {detail.passage && (
            <div
              style={{
                padding: 16,
                marginBottom: 20,
                background: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text-main)',
              }}
            >
              {detail.passage.translations?.[0]?.passage_text}
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginBottom: 20, lineHeight: 1.5 }}>
            {englishText(detail.translations)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {(detail.options || []).map((opt: OptionDetail) => {
              const isSelected = correctLabel === opt.option_label;
              return (
                <label
                  key={opt.option_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${isSelected ? '#3A8B53' : 'var(--border-color)'}`,
                    background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-body)',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <input
                    type="radio"
                    name="correct-option"
                    checked={isSelected}
                    onChange={() => setCorrectLabel(opt.option_label)}
                  />
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', minWidth: 20 }}>{opt.option_label}.</span>
                  <span style={{ color: 'var(--text-main)', flex: 1 }}>{optionText(opt)}</span>
                  {isSelected && <CheckCircle2 size={16} color="#3A8B53" />}
                </label>
              );
            })}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Reviewer Notes (optional)
            </label>
            <textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={3}
              placeholder="Any notes about this question's accuracy..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13.5,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontFamily: 'Inter, sans-serif',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '12px 16px',
                marginBottom: 16,
                borderRadius: 'var(--radius)',
                background: 'rgba(var(--primary-red-rgb), 0.1)',
                color: 'var(--primary-red)',
                border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
                fontSize: 13.5,
              }}
            >
              {error}
            </div>
          )}

          {showRejectForm && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Rejection Reason (required)
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Option text is incomplete, correct answer unclear..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 13.5,
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-body)',
                  color: 'var(--text-main)',
                  fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handleApprove}
              disabled={submitting}
              style={{
                padding: '11px 22px',
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 'var(--radius)',
                border: '1px solid #3A8B53',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#3A8B53',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={15} />
              <span>Approve & Publish</span>
            </button>

            {!showRejectForm ? (
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={submitting}
                style={{
                  padding: '11px 22px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--primary-red)',
                  background: 'rgba(var(--primary-red-rgb), 0.1)',
                  color: 'var(--primary-red)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <XCircle size={15} />
                <span>Reject</span>
              </button>
            ) : (
              <button
                onClick={handleReject}
                disabled={submitting}
                style={{
                  padding: '11px 22px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--primary-red)',
                  background: 'var(--primary-red)',
                  color: 'var(--bg-card)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <XCircle size={15} />
                <span>Confirm Rejection</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
