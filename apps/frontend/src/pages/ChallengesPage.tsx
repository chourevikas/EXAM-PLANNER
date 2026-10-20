import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Plus, Trophy, Copy, Check, Crown, Flame, UserPlus, ArrowRight, BarChart3, FileQuestion, Timer, Users } from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { CreateChallengeModal } from '../components/challenges/CreateChallengeModal';
import { VisibilityBadge, StatusChip, ChallengeTags, challengeTagList } from '../components/challenges/ChallengeBadges';
import { listMyChallenges, ChallengeSummary, isChallengeExpired } from '../services/challengeService';
import { useBreakpoint } from '../hooks/useBreakpoint';

const FREE_CHALLENGE_LIMIT = 5;

type Tab = 'all' | 'created' | 'invited' | 'joined';
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'created', label: 'Created by me' },
  { id: 'invited', label: 'Invited' },
  { id: 'joined', label: 'Joined from a link' },
];

function isPremiumUser(): boolean {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.subscription_tier === 'PREMIUM';
  } catch {
    return false;
  }
}

function getCurrentUserId(): number | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw)?.id ?? null;
  } catch {
    return null;
  }
}

function relationOf(c: ChallengeSummary, me: number | null): Exclude<Tab, 'all'> {
  if (c.relation === 'INVITED') return 'invited';
  if (c.relation === 'JOINED' || c.relation === 'VIEWING') return 'joined';
  if (c.relation === 'CREATED' || c.creator_id === me) return 'created';
  return 'joined';
}

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8,
  padding: '9px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 40,
};

export function ChallengesPage() {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    let mounted = true;
    listMyChallenges()
      .then((data) => {
        if (mounted) setChallenges(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentUserId = getCurrentUserId();
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: challenges.length, created: 0, invited: 0, joined: 0 };
    challenges.forEach((ch) => { c[relationOf(ch, currentUserId)] += 1; });
    return c;
  }, [challenges, currentUserId]);
  const shown = tab === 'all' ? challenges : challenges.filter((c) => relationOf(c, currentUserId) === tab);

  // The free-plan cap doesn't apply to Premium students.
  const premium = isPremiumUser();
  const createdCount = counts.created;
  const nearOrOverLimit = !premium && createdCount >= FREE_CHALLENGE_LIMIT;

  const handleCopyLink = (e: React.MouseEvent, token: string, id: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/challenge/${token}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <StudentLayout pageTitle="Challenges">
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <section
          style={{
            marginBottom: 20, padding: isMobile ? 20 : 28, borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default, var(--border-color))',
            backgroundImage: 'linear-gradient(135deg, rgba(227,27,35,0.07) 0%, rgba(242,182,35,0.07) 100%)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Swords size={isMobile ? 22 : 26} color="var(--accent-primary)" /> Challenges
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, maxWidth: 560, lineHeight: 1.5 }}>
              Pick questions, set a timer and compete with friends. Share a link anyone can open, or invite people by email.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'stretch' : 'flex-end', gap: 6, width: isMobile ? '100%' : undefined }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{ ...btn, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '12px 20px', fontSize: 14 }}
            >
              <Plus size={16} /> Create Challenge
            </button>
            {!loading && !premium && (
              <span style={{ fontSize: 12, fontWeight: 600, color: nearOrOverLimit ? 'var(--accent-primary)' : 'var(--text-muted)', textAlign: isMobile ? 'center' : 'right' }}>
                {Math.min(createdCount, FREE_CHALLENGE_LIMIT)}/{FREE_CHALLENGE_LIMIT} free challenges used
              </span>
            )}
          </div>
        </section>

        {nearOrOverLimit && (
          <div
            onClick={() => navigate('/billing')}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent-primary)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13,
            }}
          >
            <Crown size={18} color="var(--accent-primary)" />
            <span style={{ color: 'var(--text-main)' }}>
              You've used all {FREE_CHALLENGE_LIMIT} free challenges. <strong>Upgrade to Pro</strong> to create unlimited challenges.
            </span>
          </div>
        )}

        {!loading && challenges.length > 0 && (
          <div role="tablist" aria-label="Filter challenges" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {TABS.filter((t) => t.id === 'all' || t.id === 'created' || counts[t.id] > 0).map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  style={{
                    ...btn, padding: '8px 14px',
                    border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    backgroundColor: on ? 'var(--accent-bg)' : 'var(--bg-card)',
                    color: on ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  {t.label} <span style={{ fontWeight: 600, opacity: 0.8 }}>({counts[t.id]})</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading challenges…</div>
        ) : shown.length === 0 ? (
          <div style={{ border: '1px dashed var(--border-color)', borderRadius: 12, padding: isMobile ? 28 : 48, textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)' }}>
            <Swords size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
            <p style={{ margin: '0 0 16px' }}>
              {tab === 'all' ? "You haven't created or joined any challenges yet." : 'Nothing here yet.'}
            </p>
            {tab !== 'invited' && tab !== 'joined' && (
              <button onClick={() => setShowCreate(true)} style={{ ...btn, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none' }}>
                <Plus size={15} /> Create your first challenge
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 260 : 320}px, 1fr))`, gap: 16 }}>
            {shown.map((c) => {
              const mine = relationOf(c, currentUserId) === 'created';
              const closed = isChallengeExpired(c.expires_at);
              const canTake = !c.has_attempted && !closed;
              return (
                <article
                  key={c.id}
                  data-testid="challenge-card"
                  onClick={() => navigate(`/challenges/${c.id}`)}
                  className="hover-lift"
                  style={{
                    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12,
                    padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12,
                    borderTop: `3px solid ${closed ? '#CBD5E1' : 'var(--accent-primary)'}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <VisibilityBadge visibility={c.visibility} />
                    <StatusChip expiresAt={c.expires_at} />
                    {c.attempt_count >= 5 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#C2410C', fontWeight: 700, fontSize: 11.5 }}>
                        <Flame size={12} /> Trending
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text-main)', margin: 0, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{c.title}</h3>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                      {mine ? 'Created by you' : `From ${c.creator_name || 'a friend'}`}
                    </div>
                  </div>
                  {c.description && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</p>
                  )}
                  <ChallengeTags tags={challengeTagList(c)} />
                  <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileQuestion size={13} /> {c.question_count} questions</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={13} /> {c.time_limit_minutes} min</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {c.attempt_count} taken</span>
                  </div>
                  {c.has_attempted && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#7A4E00', backgroundColor: 'rgba(245, 166, 35, 0.14)', padding: '6px 10px', borderRadius: 8, alignSelf: 'flex-start' }}>
                      <Trophy size={13} /> You scored {c.my_best_score ?? 0} pts
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(canTake ? `/challenges/attempt/${c.id}` : `/challenges/${c.id}`)}
                      style={{
                        ...btn, flex: 1,
                        backgroundColor: canTake ? 'var(--accent-primary)' : 'transparent',
                        color: canTake ? '#fff' : 'var(--text-main)',
                        border: canTake ? 'none' : '1px solid var(--border-color)',
                      }}
                    >
                      {canTake ? (<>{c.has_in_progress ? 'Resume' : 'Take challenge'} <ArrowRight size={14} /></>) : (<><BarChart3 size={14} /> Leaderboard</>)}
                    </button>
                    {mine && !closed && c.visibility === 'PUBLIC' && (
                      <button
                        onClick={(e) => handleCopyLink(e, c.share_token, c.id)}
                        aria-label="Copy link"
                        style={{ ...btn, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)' }}
                      >
                        {copiedId === c.id ? <Check size={14} /> : <Copy size={14} />} {copiedId === c.id ? 'Copied' : 'Copy link'}
                      </button>
                    )}
                    {mine && !closed && c.visibility === 'INVITE_ONLY' && (
                      <button
                        onClick={() => navigate(`/challenges/${c.id}#invite`)}
                        style={{ ...btn, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)' }}
                      >
                        <UserPlus size={14} /> Invite
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {showCreate && <CreateChallengeModal onClose={() => setShowCreate(false)} />}
    </StudentLayout>
  );
}
