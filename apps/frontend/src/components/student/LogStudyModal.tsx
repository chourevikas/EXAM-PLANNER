import React, { useState } from 'react';
import { Ico } from '../common/Icons';
import { logStudyActivity, LogActivityPayload } from '../../services/studyPlannerService';

interface LogStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSubject?: string;
  initialTopic?: string;
}

const SUBJECT_OPTIONS = [
  'Indian Polity & Governance',
  'Modern Indian History',
  'Indian Economy',
  'Geography & Environment',
  'Environment & Ecology',
  'Science & Technology',
  'Current Affairs & IR',
  'CSAT & Quantitative Aptitude'
];

// Values match the backend's StudyActivityType enum.
const ACTIVITY_TYPES = [
  { value: 'REVISION', label: '📖 Revision' },
  { value: 'NEW_TOPIC', label: '🆕 New Topic' },
  { value: 'PYQ', label: '📜 PYQ / MCQ Practice' },
  { value: 'MOCK_TEST', label: '📝 Mock Test' },
  { value: 'ANSWER_WRITING', label: '✍️ Answer Writing' },
  { value: 'CURRENT_AFFAIRS', label: '📰 Current Affairs' },
  { value: 'OTHER', label: '📌 Other' }
];

export function LogStudyModal({ isOpen, onClose, onSuccess, initialSubject = '', initialTopic = '' }: LogStudyModalProps) {
  const [subject, setSubject] = useState(initialSubject || SUBJECT_OPTIONS[0]);
  const [topic, setTopic] = useState(initialTopic);
  const [activityType, setActivityType] = useState('REVISION');
  const [hours, setHours] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(0);
  const [questionsAttempted, setQuestionsAttempted] = useState<string>('');
  const [questionsCorrect, setQuestionsCorrect] = useState<string>('');
  const [confidenceRating, setConfidenceRating] = useState<number>(4);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalMins = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (totalMins <= 0) {
      setErrorMsg('Please specify a valid duration.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload: LogActivityPayload = {
        subject,
        topic: topic || undefined,
        duration_minutes: totalMins,
        activity_type: activityType,
        questions_attempted: questionsAttempted ? parseInt(questionsAttempted, 10) : undefined,
        questions_correct: questionsCorrect ? parseInt(questionsCorrect, 10) : undefined,
        confidence_rating: confidenceRating,
        notes: notes || undefined
      };

      await logStudyActivity(payload);
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to log study session.');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: 16
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius)', padding: 28, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius)',
              backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Ico.Clock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Log Study Session</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Record actual study time & self-confidence</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <Ico.X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius)', backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-primary)', fontSize: 13, marginBottom: 16, border: '1px solid rgba(var(--primary-red-rgb), 0.2)'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Subject & Activity Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Subject *
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Activity Type
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Topic / Subtopic
            </label>
            <input
              type="text"
              placeholder="e.g. Fundamental Rights & Writs (Articles 12-35)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Duration */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Session Duration *
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hrs</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mins</span>
              </div>
            </div>
          </div>

          {/* Questions Attempted / Correct (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Questions Attempted (Optional)
              </label>
              <input
                type="number"
                placeholder="e.g. 30"
                value={questionsAttempted}
                onChange={(e) => setQuestionsAttempted(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Questions Correct (Optional)
              </label>
              <input
                type="number"
                placeholder="e.g. 24"
                value={questionsCorrect}
                onChange={(e) => setQuestionsCorrect(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Confidence Rating Picker */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Self-Confidence Rating (1 - 5 Stars)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setConfidenceRating(star)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 'var(--radius)',
                    border: confidenceRating >= star ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                    backgroundColor: confidenceRating >= star ? 'rgba(79,70,229,0.08)' : 'var(--bg-card)',
                    color: confidenceRating >= star ? '#F2B623' : 'var(--text-muted)',
                    fontSize: 16, cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Revision Notes / Key Formulas (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Need to re-read Article 32 vs 226 writ jurisdiction differences..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)',
                backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius)', border: 'none',
                backgroundColor: 'var(--accent-primary)', color: '#FFF', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Saving...' : 'Log Study Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
