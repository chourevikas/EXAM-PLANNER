import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Flag, Crown, Medal, Trophy, ArrowRight } from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  startChallengeAttempt,
  saveChallengeResponse,
  submitChallengeAttempt,
  getLeaderboard,
  StartChallengeAttemptResponse,
  SubmitChallengeAttemptResponse,
  LeaderboardEntry,
} from '../services/challengeService';

const RANK_STYLES: Record<number, { gradient: string; color: string; icon: typeof Crown }> = {
  1: { gradient: 'linear-gradient(135deg, #FFDA6A, #F5A623)', color: '#7A4E00', icon: Crown },
  2: { gradient: 'linear-gradient(135deg, #E7E9EC, #B7BEC7)', color: '#3F4650', icon: Medal },
  3: { gradient: 'linear-gradient(135deg, #E8B98A, #C77B33)', color: '#5C3510', icon: Medal },
};

export function ChallengeAttemptPage() {
  const { idOrToken } = useParams<{ idOrToken: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<StartChallengeAttemptResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<number, number | null>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitChallengeAttemptResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const questionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!idOrToken) return;
    startChallengeAttempt(idOrToken)
      .then((data) => {
        setSession(data);
        setSecondsLeft(data.time_limit_minutes * 60);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not start challenge.'))
      .finally(() => setLoading(false));
  }, [idOrToken]);

  useEffect(() => {
    if (secondsLeft === null || result) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  const currentQuestion = session?.questions[currentIndex];

  const handleSelect = async (optionId: number) => {
    if (!session || !currentQuestion) return;
    setSelections((prev) => ({ ...prev, [currentQuestion.question_id]: optionId }));
    const timeSpent = (Date.now() - questionStartRef.current) / 1000;
    try {
      await saveChallengeResponse(session.attempt_id, currentQuestion.question_id, optionId, timeSpent);
    } catch {
      // Best-effort save; final tally is recomputed server-side on submit.
    }
  };

  const goTo = (index: number) => {
    if (!session) return;
    const clamped = Math.max(0, Math.min(session.questions.length - 1, index));
    setCurrentIndex(clamped);
    questionStartRef.current = Date.now();
  };

  const handleSubmit = async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitChallengeAttempt(session.attempt_id);
      setResult(res);
      getLeaderboard(session.challenge_id).then(setLeaderboard).catch(() => setLeaderboard([]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit challenge.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <StudentLayout pageTitle="Challenge">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading challenge…</div>
      </StudentLayout>
    );
  }

  if (error && !session) {
    return (
      <StudentLayout pageTitle="Challenge">
        <div style={{ padding: 40, textAlign: 'center', color: '#d32f2f' }}>{error}</div>
      </StudentLayout>
    );
  }

  if (result) {
    const myRank = leaderboard ? leaderboard.findIndex((e) => e.is_current_user) + 1 : 0;
    const totalCompetitors = leaderboard?.length ?? 0;
    const rankStyle = myRank ? RANK_STYLES[myRank] : undefined;
    const MedalIcon = rankStyle?.icon ?? Trophy;

    return (
      <StudentLayout pageTitle="Challenge Result">
        <div
          style={{
            maxWidth: 480, margin: '40px auto', textAlign: 'center',
            border: '1px solid var(--border-color)', borderRadius: 16, padding: 40,
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: rankStyle ? rankStyle.gradient : 'var(--accent-bg)',
            }}
          >
            <MedalIcon size={34} color={rankStyle ? rankStyle.color : 'var(--accent-primary)'} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>Challenge Complete!</h1>
          <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 8 }}>{result.total_score}</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            {result.total_correct} correct &middot; {result.total_incorrect} incorrect &middot; {result.total_unattempted} skipped
          </p>

          {myRank > 0 && (
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20,
                backgroundColor: myRank === 1 ? 'rgba(245, 166, 35, 0.14)' : 'var(--accent-bg)',
                border: '1px solid var(--accent-primary)', fontSize: 13, fontWeight: 700,
                color: 'var(--text-main)', marginBottom: 24,
              }}
            >
              {myRank === 1
                ? "You're #1! 🏆"
                : `Ranked #${myRank} of ${totalCompetitors}`}
            </div>
          )}

          {leaderboard && leaderboard.length > 1 && (
            <div style={{ textAlign: 'left', marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 8 }}>
                TOP COMPETITORS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leaderboard.slice(0, 3).map((entry, idx) => {
                  const style = RANK_STYLES[idx + 1];
                  const Icon = style?.icon;
                  return (
                    <div
                      key={entry.user_id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        padding: '8px 12px', borderRadius: 8,
                        border: entry.is_current_user ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-body)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800,
                            background: style ? style.gradient : 'rgba(120,120,120,0.12)',
                            color: style ? style.color : 'var(--text-muted)',
                          }}
                        >
                          {Icon ? <Icon size={11} /> : idx + 1}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.user_name}{entry.is_current_user ? ' (You)' : ''}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', flexShrink: 0 }}>{entry.total_score} pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => navigate(session ? `/challenges/${session.challenge_id}` : '/challenges')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            View Full Leaderboard <ArrowRight size={16} />
          </button>
        </div>
      </StudentLayout>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <StudentLayout pageTitle="Challenge">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No questions available.</div>
      </StudentLayout>
    );
  }

  const selectedOption = selections[currentQuestion.question_id] ?? null;
  const answeredCount = Object.values(selections).filter((v) => v !== null && v !== undefined).length;

  return (
    <StudentLayout pageTitle="Challenge">
      <div style={{ maxWidth: 680 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Question {currentIndex + 1} of {session.questions.length} &middot; {answeredCount} answered
          </span>
          {secondsLeft !== null && (
            <span
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
                color: secondsLeft < 60 ? '#d32f2f' : 'var(--text-main)',
              }}
            >
              <Clock size={14} /> {formatTime(secondsLeft)}
            </span>
          )}
        </div>

        <div
          style={{
            border: '1px solid var(--border-color)', borderRadius: 12, padding: 24,
            backgroundColor: 'var(--bg-card)', marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 16, color: 'var(--text-main)', lineHeight: 1.6, marginBottom: 20 }}>{currentQuestion.text}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOption === opt.option_id;
              return (
                <button
                  key={opt.option_id}
                  onClick={() => handleSelect(opt.option_id)}
                  style={{
                    textAlign: 'left', padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'var(--accent-bg)' : 'var(--bg-body)',
                    color: 'var(--text-main)', fontSize: 14, display: 'flex', gap: 10,
                  }}
                >
                  <strong>{opt.option_label}.</strong> {opt.text}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color)',
              borderRadius: 8, padding: '10px 16px', backgroundColor: 'transparent', cursor: 'pointer',
              color: 'var(--text-main)', fontSize: 13, fontWeight: 600, opacity: currentIndex === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {currentIndex === session.questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8,
                padding: '10px 20px', backgroundColor: 'var(--accent-primary)', color: '#fff',
                cursor: submitting ? 'default' : 'pointer', fontSize: 13, fontWeight: 700,
              }}
            >
              <Flag size={14} /> {submitting ? 'Submitting…' : 'Submit Challenge'}
            </button>
          ) : (
            <button
              onClick={() => goTo(currentIndex + 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8,
                padding: '10px 20px', backgroundColor: 'var(--accent-primary)', color: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
