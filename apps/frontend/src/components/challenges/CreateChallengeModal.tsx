import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Swords, Crown, X } from 'lucide-react';
import {
  createChallenge,
  fetchChallengeOptions,
  ChallengeQuotaError,
  ChallengeDuration,
  ChallengeOptions,
  CHALLENGE_DURATION_OPTIONS,
} from '../../services/challengeService';

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

interface CreateChallengeModalProps {
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-body)',
  color: 'var(--text-main)',
  fontSize: 14,
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-main)',
  marginBottom: 6,
  display: 'block',
};
const twoCol: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 14,
};

export function CreateChallengeModal({ onClose }: CreateChallengeModalProps) {
  const navigate = useNavigate();
  const titleRef = useRef<HTMLInputElement>(null);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [options, setOptions] = useState<ChallengeOptions>({ exams: [], years: [], subject_years: {} });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examTypeId, setExamTypeId] = useState<number | ''>('');
  const [years, setYears] = useState<number[]>([]);
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string>('');
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [duration, setDuration] = useState<ChallengeDuration>('ONE_WEEK');
  const [visibility, setVisibility] = useState<'INVITE_ONLY' | 'PUBLIC'>('INVITE_ONLY');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    fetchChallengeOptions().then((o) => {
      setOptions(o);
      setOptionsLoaded(true);
    });
    titleRef.current?.focus();
  }, []);

  // Close on Escape and stop the page behind the modal from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, submitting]);

  const selectedExam = examTypeId === '' ? null : options.exams.find((e) => e.id === examTypeId) ?? null;

  // Years on offer follow the chosen exam; with no exam chosen, every year that has questions.
  const availableYears = useMemo(
    () => (selectedExam ? selectedExam.years : options.years),
    [selectedExam, options.years]
  );

  // Subjects follow the chosen exam and, once years are picked, only those with questions in those years.
  const availableSubjects = useMemo(() => {
    const map = selectedExam ? selectedExam.subject_years : options.subject_years;
    return Object.entries(map)
      .filter(([, subjectYears]) => years.length === 0 || subjectYears.some((y) => years.includes(y)))
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b));
  }, [selectedExam, options.subject_years, years]);

  // Never keep a selection the current exam/years can't produce.
  useEffect(() => {
    setYears((prev) => (prev.every((y) => availableYears.includes(y)) ? prev : prev.filter((y) => availableYears.includes(y))));
  }, [availableYears]);
  useEffect(() => {
    setSubjectNames((prev) => (prev.every((n) => availableSubjects.includes(n)) ? prev : prev.filter((n) => availableSubjects.includes(n))));
  }, [availableSubjects]);

  const handleExamChange = (value: string) => setExamTypeId(value === '' ? '' : Number(value));

  const toggleYear = (year: number) =>
    setYears((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]));
  const toggleSubject = (name: string) =>
    setSubjectNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please give your challenge a title.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setLimitReached(false);
    try {
      const challenge = await createChallenge({
        title: title.trim(),
        description: description.trim() || undefined,
        question_count: questionCount,
        difficulty: (difficulty || undefined) as any,
        subject_names: subjectNames.length ? subjectNames : undefined,
        exam_type_id: examTypeId === '' ? undefined : examTypeId,
        years: years.length ? years : undefined,
        time_limit_minutes: timeLimitMinutes,
        visibility,
        duration,
      });
      onClose();
      navigate(`/challenges/${challenge.id}`);
    } catch (err) {
      if (err instanceof ChallengeQuotaError) {
        setLimitReached(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create challenge.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create a challenge"
      onClick={() => !submitting && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(8px, 3vw, 16px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 600,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.45)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
            <Swords size={20} color="var(--accent-primary)" /> Create a Challenge
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 20, WebkitOverflowScrolling: 'touch' }}>
          {limitReached ? (
            <div
              style={{
                border: '1px solid var(--accent-primary)',
                backgroundColor: 'var(--accent-bg)',
                borderRadius: 'var(--radius)',
                padding: 24,
                textAlign: 'center',
              }}
            >
              <Crown size={28} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>Free plan limit reached</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
                You've created the maximum of 5 free challenges. Upgrade to Pro for unlimited challenges.
              </p>
              <button
                onClick={() => {
                  onClose();
                  navigate('/billing');
                }}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  padding: '10px 24px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Upgrade to Pro
              </button>
            </div>
          ) : (
            <form id="create-challenge-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="cc-title">Title</label>
                <input
                  id="cc-title"
                  ref={titleRef}
                  style={inputStyle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Modern History Sprint"
                  maxLength={255}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="cc-desc">Description (optional)</label>
                <textarea
                  id="cc-desc"
                  style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this challenge about?"
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="cc-exam">Exam</label>
                <select id="cc-exam" style={inputStyle} value={examTypeId} onChange={(e) => handleExamChange(e.target.value)}>
                  <option value="">Any Exam</option>
                  {options.exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Subjects <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(pick one or more, or leave blank for all)</span>
                </label>
                {availableSubjects.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {!optionsLoaded
                      ? 'Loading subjects…'
                      : years.length > 0
                        ? 'No subjects have questions for the selected year(s). Questions will be drawn from the whole exam.'
                        : selectedExam
                          ? 'No subject breakdown is available for this exam yet. Questions will be drawn from the whole exam.'
                          : 'No subjects available yet.'}
                  </div>
                ) : (
                  <div role="group" aria-label="Subjects" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableSubjects.map((name) => {
                      const on = subjectNames.includes(name);
                      return (
                        <button
                          type="button"
                          key={name}
                          aria-pressed={on}
                          onClick={() => toggleSubject(name)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 20,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            border: on ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            backgroundColor: on ? 'var(--accent-bg)' : 'var(--bg-body)',
                            color: 'var(--text-main)',
                          }}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>
                  Exam Years <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(pick one or more, or leave blank for all)</span>
                </label>
                {availableYears.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No year data available yet.</div>
                ) : (
                  <div role="group" aria-label="Exam years" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableYears.map((y) => {
                      const on = years.includes(y);
                      return (
                        <button
                          type="button"
                          key={y}
                          aria-pressed={on}
                          onClick={() => toggleYear(y)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 20,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            border: on ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            backgroundColor: on ? 'var(--accent-bg)' : 'var(--bg-body)',
                            color: 'var(--text-main)',
                          }}
                        >
                          {y}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={twoCol}>
                <div>
                  <label style={labelStyle} htmlFor="cc-diff">Difficulty</label>
                  <select id="cc-diff" style={inputStyle} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="">Any Difficulty</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="cc-count">Number of Questions</label>
                  <input
                    id="cc-count"
                    type="number"
                    min={1}
                    max={50}
                    style={inputStyle}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                  />
                </div>
              </div>

              <div style={twoCol}>
                <div>
                  <label style={labelStyle} htmlFor="cc-time">Time Per Attempt (minutes)</label>
                  <input
                    id="cc-time"
                    type="number"
                    min={1}
                    max={180}
                    style={inputStyle}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1)))}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="cc-open">Challenge Stays Open For</label>
                  <select id="cc-open" style={inputStyle} value={duration} onChange={(e) => setDuration(e.target.value as ChallengeDuration)}>
                    {CHALLENGE_DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Who can take this challenge?</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['INVITE_ONLY', 'PUBLIC'] as const).map((v) => (
                    <button
                      type="button"
                      key={v}
                      aria-pressed={visibility === v}
                      onClick={() => setVisibility(v)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        border: visibility === v ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        backgroundColor: visibility === v ? 'var(--accent-bg)' : 'var(--bg-body)',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {v === 'INVITE_ONLY' ? 'Invite Only' : 'Public Link'}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
                  Everyone gets a single attempt at a challenge, and it stops accepting attempts once the open period ends.
                </p>
              </div>

              {error && <div role="alert" style={{ color: '#d32f2f', fontSize: 13 }}>{error}</div>}
            </form>
          )}
        </div>

        {!limitReached && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '11px 18px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-challenge-form"
              disabled={submitting}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                padding: '11px 22px',
                fontWeight: 700,
                fontSize: 14,
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Creating…' : 'Create Challenge'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
