import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Check, UserPlus, Trophy, ArrowRight, Globe, Users, Clock, Crown, Medal, Zap } from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  getChallenge,
  getLeaderboard,
  inviteUserToChallenge,
  ChallengeSummary,
  LeaderboardEntry,
  formatChallengeExpiry,
  isChallengeExpired,
} from '../services/challengeService';

const RANK_STYLES: Record<number, { gradient: string; color: string; icon: typeof Crown }> = {
  1: { gradient: 'linear-gradient(135deg, #FFDA6A, #F5A623)', color: '#7A4E00', icon: Crown },
  2: { gradient: 'linear-gradient(135deg, #E7E9EC, #B7BEC7)', color: '#3F4650', icon: Medal },
  3: { gradient: 'linear-gradient(135deg, #E8B98A, #C77B33)', color: '#5C3510', icon: Medal },
};

function getCurrentUserId(): number | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw)?.id ?? null;
  } catch {
    return null;
  }
}

export function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ChallengeSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    Promise.all([getChallenge(id), getLeaderboard(id)])
      .then(([c, lb]) => {
        if (mounted) {
          setChallenge(c);
          setLeaderboard(lb);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const shareUrl = challenge ? `${window.location.origin}/challenge/${challenge.share_token}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteStatus(null);
    try {
      await inviteUserToChallenge(challenge.id, inviteEmail.trim());
      setInviteStatus('Invite sent!');
      setInviteEmail('');
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : 'Could not send invite.');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <StudentLayout pageTitle="Challenge">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      </StudentLayout>
    );
  }

  if (!challenge) {
    return (
      <StudentLayout pageTitle="Challenge">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Challenge not found.</div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout pageTitle={challenge.title}>
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{challenge.title}</h1>
            <span
              style={{
                fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                backgroundColor: challenge.visibility === 'PUBLIC' ? 'var(--accent-bg)' : 'rgba(120,120,120,0.12)',
                color: challenge.visibility === 'PUBLIC' ? 'var(--accent-primary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {challenge.visibility === 'PUBLIC' ? <Globe size={11} /> : <Users size={11} />}
              {challenge.visibility === 'PUBLIC' ? 'Public' : 'Invite Only'}
            </span>
          </div>
          {challenge.description && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{challenge.description}</p>}
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-muted)', marginTop: 8, flexWrap: 'wrap' }}>
            <span>{challenge.question_count} Questions</span>
            <span>{challenge.time_limit_minutes} min</span>
            <span>Created by {challenge.creator_name || 'you'}</span>
            {challenge.exam_name && <span>{challenge.exam_name}</span>}
            {(challenge.subject_names && challenge.subject_names.length > 0 ? challenge.subject_names : challenge.subject_name ? [challenge.subject_name] : []).map((n) => (
              <span key={n}>{n}</span>
            ))}
            {challenge.years && challenge.years.length > 0 && <span>{challenge.years.join(', ')}</span>}
            {challenge.expires_at && (
              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: isChallengeExpired(challenge.expires_at) ? '#d32f2f' : 'var(--text-muted)',
                  fontWeight: isChallengeExpired(challenge.expires_at) ? 600 : 400,
                }}
              >
                <Clock size={13} /> {formatChallengeExpiry(challenge.expires_at)}
              </span>
            )}
          </div>
        </div>

        {challenge.has_attempted ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
              textAlign: 'center', padding: '14px', borderRadius: 10,
              backgroundColor: 'rgba(245, 166, 35, 0.14)', color: '#7A4E00', fontWeight: 700, fontSize: 14,
            }}
          >
            <Trophy size={16} />
            You've completed this challenge
            {typeof challenge.my_best_score === 'number' ? ` — you scored ${challenge.my_best_score} pts.` : '.'}
            <span style={{ fontWeight: 500 }}>Each challenge can be attempted only once.</span>
          </div>
        ) : isChallengeExpired(challenge.expires_at) ? (
          <div
            style={{
              textAlign: 'center', padding: '14px', borderRadius: 10,
              backgroundColor: 'rgba(211,47,47,0.08)', color: '#d32f2f', fontWeight: 600, fontSize: 14,
            }}
          >
            This challenge has closed and is no longer accepting new attempts.
          </div>
        ) : (
          <button
            onClick={() => navigate(`/challenges/attempt/${challenge.id}`)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            {challenge.has_in_progress ? 'Resume Challenge' : 'Start Challenge'} <ArrowRight size={16} />
          </button>
        )}

        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>Share this challenge</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={shareUrl}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)', fontSize: 13,
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '10px 14px', backgroundColor: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--text-main)',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {challenge.creator_id === getCurrentUserId() && (
            <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <input
                type="email"
                required
                placeholder="Invite by email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', fontSize: 13,
                }}
              />
              <button
                type="submit"
                disabled={inviting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8,
                  padding: '10px 14px', backgroundColor: 'var(--accent-primary)', color: '#fff',
                  cursor: inviting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                <UserPlus size={14} /> Invite
              </button>
            </form>
          )}
          {inviteStatus && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{inviteStatus}</div>}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              <Trophy size={16} color="var(--accent-primary)" /> Leaderboard
            </div>
            {leaderboard.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                {leaderboard.length} competing
              </span>
            )}
          </div>

          {leaderboard.length === 0 ? (
            <div
              style={{
                border: '1px dashed var(--border-color)', borderRadius: 10, padding: '24px 16px',
                textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
              }}
            >
              No attempts yet. Be the first to set the pace!
            </div>
          ) : (
            (() => {
              const maxScore = leaderboard[0]?.total_score || 1;
              const myIndex = leaderboard.findIndex((e) => e.is_current_user);

              return (
                <>
                  {myIndex !== -1 && (
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                        backgroundColor: myIndex === 0 ? 'rgba(245, 166, 35, 0.14)' : 'var(--accent-bg)',
                        border: '1px solid var(--accent-primary)', marginBottom: 12, fontSize: 13,
                      }}
                    >
                      <Zap size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                      {myIndex === 0 ? (
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>You're in the lead! Defend that top spot.</span>
                      ) : (
                        <span style={{ color: 'var(--text-main)' }}>
                          You're ranked <strong>#{myIndex + 1}</strong> of {leaderboard.length} &middot;{' '}
                          <strong>{leaderboard[0].total_score - leaderboard[myIndex].total_score} pts</strong> behind the leader.
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leaderboard.map((entry, idx) => {
                      const rank = idx + 1;
                      const rankStyle = RANK_STYLES[rank];
                      const RankIcon = rankStyle?.icon;
                      const barPct = Math.max(6, Math.round((entry.total_score / maxScore) * 100));

                      return (
                        <div
                          key={entry.user_id}
                          style={{
                            position: 'relative', overflow: 'hidden', borderRadius: 10,
                            border: entry.is_current_user ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)', padding: '10px 14px',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barPct}%`,
                              backgroundColor: rankStyle ? 'rgba(245, 166, 35, 0.08)' : 'rgba(120,120,120,0.05)',
                              transition: 'width 400ms ease-out',
                            }}
                          />
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 800, fontSize: 12,
                                  background: rankStyle ? rankStyle.gradient : 'rgba(120,120,120,0.12)',
                                  color: rankStyle ? rankStyle.color : 'var(--text-muted)',
                                }}
                              >
                                {RankIcon ? <RankIcon size={14} /> : rank}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.user_name}
                                  </span>
                                  {entry.is_current_user && (
                                    <span
                                      style={{
                                        fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 20,
                                        backgroundColor: 'var(--accent-primary)', color: '#fff', flexShrink: 0,
                                      }}
                                    >
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  {entry.total_correct} correct &middot; {Math.round(entry.time_spent_seconds)}s
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 16, color: rankStyle ? rankStyle.color : 'var(--text-main)' }}>
                                {entry.total_score}
                              </div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>PTS</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
