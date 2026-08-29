import React, { useState } from 'react';
import { Star, Send, CheckCircle2, MessageSquarePlus } from 'lucide-react';
import { submitTestimonial } from '../../services/testimonialService';

interface StudentTestimonialFormProps {
  userExamDefault?: string;
}

export function StudentTestimonialForm({ userExamDefault = 'UPSC CSE 2026 Aspirant' }: StudentTestimonialFormProps) {
  const [examBadge, setExamBadge] = useState(userExamDefault);
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote.trim() || quote.trim().length < 10) {
      setErrorMessage('Please write at least 10 characters describing your preparation experience.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await submitTestimonial({
        quote: quote.trim(),
        user_exam: examBadge.trim() || userExamDefault,
        rating: rating,
      });

      setSuccessMessage('Thank you for sharing your experience! Your testimonial has been submitted and is currently queued for Super Admin review.');
      setQuote('');
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit testimonial. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 32,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 24,
        padding: '32px 36px',
        boxShadow: 'var(--shadow-color-base)',
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.04) 0%, rgba(139, 92, 246, 0.04) 100%)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          <MessageSquarePlus size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Share Your Exam Preparation Journey
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            Submit your feedback and testimonial to be featured on the national ExamPlanner landing page.
          </p>
        </div>
      </div>

      {successMessage ? (
        <div
          style={{
            marginTop: 20,
            padding: '20px 24px',
            borderRadius: 16,
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <CheckCircle2 size={24} color="#059669" />
          <div>{successMessage}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#dc2626',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                Target Exam / Title Badge
              </label>
              <input
                type="text"
                value={examBadge}
                onChange={(e) => setExamBadge(e.target.value)}
                placeholder="e.g. UPSC CSE 2026 Aspirant"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-body, #ffffff)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                Your Platform Rating
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                  >
                    <Star
                      size={26}
                      fill={star <= rating ? '#f59e0b' : 'transparent'}
                      color={star <= rating ? '#f59e0b' : 'var(--text-muted)'}
                    />
                  </button>
                ))}
                <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                  {rating} / 5 Stars
                </span>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
              Your Success Story & Experience
            </label>
            <textarea
              rows={4}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Describe how ExamPlanner helped improve your accuracy, weak area revision, or weekly study consistency..."
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-body, #ffffff)',
                color: 'var(--text-primary)',
                fontSize: 14,
                lineHeight: 1.6,
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '12px 28px',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <Send size={16} />
              <span>{submitting ? 'Submitting Story...' : 'Submit Story for Super Admin Review'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
