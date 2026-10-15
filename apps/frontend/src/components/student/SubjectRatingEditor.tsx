import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSubjectNames } from '../../services/challengeService';
import { PROFICIENCY_LABELS, FALLBACK_SUBJECTS } from '../../constants/onboarding';
import { Spinner } from '../common/Spinner';

// Word variants the taxonomy uses for the same subject ("Science & Tech", "Economics").
const WORD_ALIASES: Record<string, string> = { tech: 'technology', economic: 'economy' };

/**
 * Key used to spot near-duplicate subject names coming from the taxonomy,
 * e.g. "Art & Culture", "Arts & Culture" and "Arts and Culture".
 */
export function subjectKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
    .map((word) => WORD_ALIASES[word] || word)
    .join(' ');
}

/**
 * Collapse near-duplicate subject names, keeping one display name per subject.
 * Names the student has already rated win, so saved ratings keep showing up.
 */
export function dedupeSubjectNames(names: string[], preferred: string[] = []): string[] {
  const byKey = new Map<string, string>();
  for (const name of preferred) {
    const key = subjectKey(name);
    if (key && !byKey.has(key)) byKey.set(key, name);
  }
  for (const raw of names) {
    const name = raw.trim();
    const key = subjectKey(name);
    if (key && !byKey.has(key)) byKey.set(key, name);
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

interface SubjectRatingEditorProps {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  /** Override the subject list; by default it is loaded from the syllabus taxonomy. */
  subjects?: string[];
  disabled?: boolean;
}

/** Rows of 1-5 buttons, one per subject. Clicking the selected rating again clears it. */
export function SubjectRatingEditor({ value, onChange, subjects: subjectsProp, disabled }: SubjectRatingEditorProps) {
  const [loaded, setLoaded] = useState<string[] | null>(subjectsProp ?? null);

  useEffect(() => {
    if (subjectsProp) {
      setLoaded(subjectsProp);
      return;
    }
    let cancelled = false;
    fetchSubjectNames()
      .then((names) => !cancelled && setLoaded(names.length ? names : FALLBACK_SUBJECTS))
      .catch(() => !cancelled && setLoaded(FALLBACK_SUBJECTS));
    return () => {
      cancelled = true;
    };
  }, [subjectsProp]);

  // Remember every name rated while the editor is open, so clearing a rating doesn't swap
  // the row's label to another spelling (e.g. "Arts & Culture" -> "Art & Culture") mid-edit.
  const pinnedNames = useRef<Set<string>>(new Set());
  Object.keys(value).forEach((name) => pinnedNames.current.add(name));
  const pinned = Array.from(pinnedNames.current);
  const subjects = useMemo(
    () => (loaded ? dedupeSubjectNames(loaded, pinned) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, pinned.join('|')],
  );

  if (!loaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spinner size={28} label="Loading subjects…" />
      </div>
    );
  }

  const setRating = (subject: string, n: number) => {
    const next = { ...value };
    if (value[subject] === n) delete next[subject];
    else next[subject] = n;
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {subjects.map((subject) => {
        const rating = value[subject];
        return (
          <div
            key={subject}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ minWidth: 0, flex: '1 1 160px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{subject}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', minHeight: 16 }}>
                {rating ? `${rating}/5 · ${PROFICIENCY_LABELS[rating]}` : 'Not rated'}
              </div>
            </div>
            <div role="radiogroup" aria-label={`${subject} proficiency`} style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${subject}: ${n} of 5`}
                  disabled={disabled}
                  onClick={() => setRating(subject, n)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius)',
                    cursor: disabled ? 'default' : 'pointer',
                    fontWeight: 800,
                    fontSize: 14,
                    border: rating === n ? '2px solid var(--primary-red)' : '1px solid var(--border-default)',
                    backgroundColor: rating === n ? 'var(--primary-red)' : 'var(--bg-card)',
                    color: rating === n ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
