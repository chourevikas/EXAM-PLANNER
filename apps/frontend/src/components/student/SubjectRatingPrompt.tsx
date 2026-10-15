import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { updateUserProfile } from '../../services/authService';
import { SubjectRatingEditor } from './SubjectRatingEditor';

interface SubjectRatingPromptProps {
  isOpen: boolean;
  /** Called after the ratings are saved (true) or the student skips (false). */
  onDone: (saved: boolean) => void;
}

/** Asks a student to rate their subjects before their first study plan is generated. */
export function SubjectRatingPrompt({ isOpen, onDone }: SubjectRatingPromptProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const ratedCount = Object.keys(ratings).length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile({ subject_proficiency: ratings });
      onDone(true);
    } catch {
      setError('Could not save your ratings. Please try again, or skip for now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-prompt-title"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius)', width: '100%', maxWidth: 600,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: 'clamp(16px, 3vw, 24px)', paddingBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 'var(--radius)', flexShrink: 0,
              backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)', color: 'var(--primary-red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 id="rating-prompt-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              Rate your subjects
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Before we build your study plan, tell us how confident you feel in each subject, from 1 (just starting)
              to 5 (expert). Skip any you are unsure about. You can change these later from your profile.
            </p>
          </div>
        </div>

        <div style={{ padding: '0 clamp(16px, 3vw, 24px)', overflowY: 'auto', flex: 1 }}>
          <SubjectRatingEditor value={ratings} onChange={setRatings} disabled={saving} />
        </div>

        {error && (
          <div role="alert" style={{ padding: '10px clamp(16px, 3vw, 24px) 0', color: '#d32f2f', fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div
          style={{
            padding: 'clamp(16px, 3vw, 24px)', paddingTop: 16, display: 'flex',
            justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border-default)', marginTop: 12,
          }}
        >
          <button
            type="button"
            onClick={() => onDone(false)}
            disabled={saving}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)',
              backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || ratedCount === 0}
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none',
              backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving || ratedCount === 0 ? 'default' : 'pointer',
              opacity: saving || ratedCount === 0 ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save & generate plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
