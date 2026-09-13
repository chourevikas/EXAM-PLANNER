import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Crown } from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  createChallenge,
  fetchSubjectNames,
  ChallengeQuotaError,
  ChallengeDuration,
  CHALLENGE_DURATION_OPTIONS,
} from '../services/challengeService';

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export function CreateChallengePage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [duration, setDuration] = useState<ChallengeDuration>('ONE_WEEK');
  const [visibility, setVisibility] = useState<'INVITE_ONLY' | 'PUBLIC'>('INVITE_ONLY');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    fetchSubjectNames().then(setSubjects);
  }, []);

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
        subject_name: subjectName || undefined,
        time_limit_minutes: timeLimitMinutes,
        visibility,
        duration,
      });
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-body)',
    color: 'var(--text-main)',
    fontSize: 14,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: 6,
    display: 'block',
  };

  return (
    <StudentLayout pageTitle="Create Challenge">
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Swords size={20} color="var(--accent-primary)" /> Create a Challenge
        </h1>

        {limitReached ? (
          <div
            style={{
              border: '1px solid var(--accent-primary)', backgroundColor: 'var(--accent-bg)',
              borderRadius: 12, padding: 24, textAlign: 'center',
            }}
          >
            <Crown size={28} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>Free plan limit reached</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              You've created the maximum of 5 free challenges. Upgrade to Pro for unlimited challenges.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              style={{
                backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex', flexDirection: 'column', gap: 18,
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: 24,
            }}
          >
            <div>
              <label style={labelStyle}>Title</label>
              <input
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Modern History Sprint"
                maxLength={255}
              />
            </div>
            <div>
              <label style={labelStyle}>Description (optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this challenge about?"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Subject</label>
                <select style={inputStyle} value={subjectName} onChange={(e) => setSubjectName(e.target.value)}>
                  <option value="">Any Subject</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Difficulty</label>
                <select style={inputStyle} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="">Any Difficulty</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Number of Questions</label>
                <input
                  type="number" min={1} max={50} style={inputStyle}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                />
              </div>
              <div>
                <label style={labelStyle}>Time Per Attempt (minutes)</label>
                <input
                  type="number" min={1} max={180} style={inputStyle}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1)))}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Challenge Stays Open For</label>
              <select style={inputStyle} value={duration} onChange={(e) => setDuration(e.target.value as ChallengeDuration)}>
                {CHALLENGE_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                After this window, the challenge stops accepting new attempts.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Who can take this challenge?</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['INVITE_ONLY', 'PUBLIC'] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setVisibility(v)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: visibility === v ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      backgroundColor: visibility === v ? 'var(--accent-bg)' : 'var(--bg-body)',
                      color: 'var(--text-main)', fontWeight: 600, fontSize: 13,
                    }}
                  >
                    {v === 'INVITE_ONLY' ? 'Invite Only' : 'Public Link'}
                  </button>
                ))}
              </div>
            </div>

            {error && <div style={{ color: '#d32f2f', fontSize: 13 }}>{error}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '14px', fontWeight: 700, fontSize: 15,
                cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Creating…' : 'Create Challenge'}
            </button>
          </form>
        )}
      </div>
    </StudentLayout>
  );
}
