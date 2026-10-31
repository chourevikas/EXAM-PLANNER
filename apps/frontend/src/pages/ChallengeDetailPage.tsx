import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Copy, Crown, FileQuestion, Lock, Medal, MessageCircle, Timer,
  Trophy, UserPlus, Users, Zap,
} from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { VisibilityBadge, StatusChip, ChallengeTags, challengeTagList } from '../components/challenges/ChallengeBadges';
import {
  getChallenge,
  getLeaderboard,
  inviteUserToChallenge,
  listInvitees,
  ChallengeInvitee,
  ChallengeSummary,
  LeaderboardEntry,
  formatChallengeExpiry,
  isChallengeExpired,
} from '../services/challengeService';
import { useBreakpoint } from '../hooks/useBreakpoint';

const RANK_STYLES: Record<number, { gradient: string; color: string; icon: typeof Crown }> = {
  1: { gradient: 'linear-gradient(135deg, #FFDA6A, #F5A623)', color: '#7A4E00', icon: Crown },
  2: { gradient: 'linear-gradient(135deg, #E7E9EC, #B7BEC7)', color: '#3F4650', icon: Medal },
  3: { gradient: 'linear-gradient(135deg, #E8B98A, #C77B33)', color: '#5C3510', icon: Medal },
};

const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12,
  padding: 'clamp(16px, 3vw, 22px)',
};
const sectionTitle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0,
};
const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', fontSize: 13, minHeight: 42, boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8,
  padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 42, whiteSpace: 'nowrap',
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginTop: 4, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

export function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useBreakpoint();
  const [challenge, setChallenge] = useState<ChallengeSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [invitees, setInvitees] = useState<ChallengeInvitee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const inviteRef = useRef<HTMLDivElement>(null);

  const currentUserId = getCurrentUserId();
  const isCreator = !!challenge && (challenge.relation === 'CREATED' || challenge.creator_id === currentUserId);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    Promise.all([getChallenge(id), getLeaderboard(id).catch(() => [])])
      .then(([c, lb]) => {
        if (!mounted) return;
        setChallenge(c);
        setLeaderboard(lb);
      })
      .catch((err) => mounted && setLoadError(err instanceof Error ? err.message : 'Could not load this challenge.'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [id]);

  // The creator sees who they've invited
  useEffect(() => {
    if (challenge && isCreator) listInvitees(challenge.id).then(setInvitees).catch(() => setInvitees([]));
  }, [challenge, isCreator]);

  // "Invite" on a list card links to #invite
  useEffect(() => {
    if (!loading && location.hash === '#invite') inviteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, location.hash]);

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
    setInviteResult(null);
    try {
      const invitee = await inviteUserToChallenge(challenge.id, inviteEmail.trim());
      setInviteResult({ ok: true, text: `Invited ${invitee.name}. They'll see it under their notifications.` });
      setInviteEmail('');
      setInvitees((prev) => [invitee, ...prev.filter((p) => p.user_id !== invitee.user_id)]);
    } catch (err) {
      setInviteResult({ ok: false, text: err instanceof Error ? err.message : 'Could not send the invite.' });
    } finally {
      setInviting(false);
    }
  };

  const backLink = (
    <button
      type="button"
      onClick={() => navigate('/challenges')}
      style={{ ...btn, alignSelf: 'flex-start', padding: '6px 10px 6px 4px', minHeight: 36, border: 'none', background: 'none', color: 'var(--text-muted)' }}
    >
      <ArrowLeft size={16} /> All challenges
    </button>
  );

  if (loading || !challenge) {
    return (
      <StudentLayout pageTitle="Challenge">
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {backLink}
          <div style={{ ...card, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
            {loading ? 'Loading…' : /access/i.test(loadError || '')
              ? 'This challenge is invite only, and you are not on the invite list.'
              : 'Challenge not found.'}
          </div>
        </div>
      </StudentLayout>
    );
  }

  const closed = isChallengeExpired(challenge.expires_at);
  const isPublic = challenge.visibility === 'PUBLIC';
  const myIndex = leaderboard.findIndex((e) => e.is_current_user);

  return (
    <StudentLayout pageTitle={challenge.title}>
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {backLink}

        {/* Summary */}
        <section style={{ ...card, borderTop: `4px solid ${closed ? '#CBD5E1' : 'var(--accent-primary)'}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <VisibilityBadge visibility={challenge.visibility} />
            <StatusChip expiresAt={challenge.expires_at} />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--text-main)', margin: 0, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{challenge.title}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {isCreator ? 'Created by you' : `Created by ${challenge.creator_name || 'a friend'}`}
            </div>
          </div>
          {challenge.description && <p style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: 14, margin: 0, lineHeight: 1.55 }}>{challenge.description}</p>}
          <ChallengeTags tags={challengeTagList(challenge)} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <Stat icon={<FileQuestion size={13} />} label="Questions" value={String(challenge.question_count)} />
            <Stat icon={<Timer size={13} />} label="Time" value={`${challenge.time_limit_minutes} min`} />
            <Stat icon={<Users size={13} />} label="Taken by" value={String(challenge.attempt_count)} />
            <Stat icon={<Clock size={13} />} label={closed ? 'Status' : 'Closes'} value={closed ? 'Closed' : challenge.expires_at ? (formatChallengeExpiry(challenge.expires_at) || '').replace(/^Closes in /, 'in ') : 'No deadline'} />
          </div>

          {challenge.has_attempted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 14, borderRadius: 10, backgroundColor: 'rgba(245, 166, 35, 0.14)', color: '#7A4E00', fontWeight: 700, fontSize: 14 }}>
              <Trophy size={16} /> You scored {challenge.my_best_score ?? 0} pts
              {myIndex !== -1 && <span>· ranked #{myIndex + 1} of {leaderboard.length}</span>}
              <span style={{ fontWeight: 500 }}>Each challenge can be taken once.</span>
            </div>
          ) : closed ? (
            <div style={{ padding: 14, borderRadius: 10, backgroundColor: '#FEF2F2', color: '#B91C1C', fontWeight: 600, fontSize: 14 }}>
              This challenge has closed and no longer accepts attempts.
            </div>
          ) : (
            <button
              onClick={() => navigate(`/challenges/attempt/${challenge.id}`)}
              style={{ ...btn, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', padding: 14, fontSize: 15, borderRadius: 10 }}
            >
              {challenge.has_in_progress ? 'Resume challenge' : 'Take challenge'} <ArrowRight size={16} />
            </button>
          )}
        </section>

        {/* Share (anyone with the link) or invite (invite only) */}
        {!closed && (isPublic || isCreator) && (
          <section ref={inviteRef} id="invite" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h2 style={sectionTitle}>{isPublic ? <><MessageCircle size={16} color="var(--accent-primary)" /> Share this challenge</> : <><Lock size={16} color="var(--accent-primary)" /> Invite people</>}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                {isPublic
                  ? 'Anyone with this link can sign in, take it once and join the leaderboard.'
                  : 'Only the people you invite can take it. Invite them with the email they use on ExamPlanner; they get a notification.'}
              </p>
            </div>

            {isPublic && (
              <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <input readOnly aria-label="Challenge link" value={shareUrl} onFocus={(e) => e.currentTarget.select()} style={{ ...inputStyle, color: 'var(--text-muted)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleCopy} style={{ ...btn, flex: isMobile ? 1 : undefined, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)' }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Can you beat me? "${challenge.title}" on ExamPlanner: ${challenge.question_count} questions in ${challenge.time_limit_minutes} minutes. ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...btn, flex: isMobile ? 1 : undefined, textDecoration: 'none', backgroundColor: '#25D366', color: '#fff', border: 'none' }}
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                </div>
              </div>
            )}

            {isCreator && (
              <>
                <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                  <input
                    type="email"
                    required
                    aria-label="Invite by email"
                    placeholder={isPublic ? 'Or invite someone by email' : "Friend's ExamPlanner email"}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={inputStyle}
                  />
                  <button type="submit" disabled={inviting} style={{ ...btn, border: 'none', backgroundColor: 'var(--accent-primary)', color: '#fff', opacity: inviting ? 0.7 : 1 }}>
                    <UserPlus size={14} /> {inviting ? 'Inviting…' : 'Invite'}
                  </button>
                </form>
                {inviteResult && (
                  <div role={inviteResult.ok ? 'status' : 'alert'} style={{ fontSize: 13, fontWeight: 600, color: inviteResult.ok ? '#047857' : '#B91C1C' }}>
                    {inviteResult.text}
                  </div>
                )}
                {invitees.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
                      Invited ({invitees.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {invitees.map((p) => (
                        <div key={p.user_id} data-testid="invitee" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 8, backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, color: p.has_attempted ? '#047857' : 'var(--text-muted)' }}>
                            {p.has_attempted ? <><CheckCircle2 size={13} /> {p.score ?? 0} pts</> : 'Not taken yet'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Leaderboard */}
        <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={sectionTitle}><Trophy size={16} color="var(--accent-primary)" /> Leaderboard</h2>
            {leaderboard.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{leaderboard.length} competing</span>}
          </div>

          {leaderboard.length === 0 ? (
            <div style={{ border: '1px dashed var(--border-color)', borderRadius: 10, padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No one has taken it yet. {closed ? '' : 'Be the first to set the pace!'}
            </div>
          ) : (
            <>
              {myIndex !== -1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, backgroundColor: myIndex === 0 ? 'rgba(245, 166, 35, 0.14)' : 'var(--accent-bg)', border: '1px solid var(--accent-primary)', fontSize: 13 }}>
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
                  const maxScore = leaderboard[0]?.total_score || 1;
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
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barPct}%`, backgroundColor: rankStyle ? 'rgba(245, 166, 35, 0.08)' : 'rgba(120,120,120,0.05)', transition: 'width 400ms ease-out' }} />
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, background: rankStyle ? rankStyle.gradient : 'rgba(120,120,120,0.12)', color: rankStyle ? rankStyle.color : 'var(--text-muted)' }}>
                            {RankIcon ? <RankIcon size={14} /> : rank}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.user_name}</span>
                              {entry.is_current_user && (
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 20, backgroundColor: 'var(--accent-primary)', color: '#fff', flexShrink: 0 }}>YOU</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {entry.total_correct} correct &middot; {Math.round(entry.time_spent_seconds)}s
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 16, color: rankStyle ? rankStyle.color : 'var(--text-main)' }}>{entry.total_score}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>PTS</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <Link to="/challenges" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}>
            ← Back to all challenges
          </Link>
        </div>
      </div>
    </StudentLayout>
  );
}
