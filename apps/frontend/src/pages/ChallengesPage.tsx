import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Plus, Users, Globe, Trophy, Copy, Check, Crown, Clock, Flame } from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { listMyChallenges, ChallengeSummary, formatChallengeExpiry, isChallengeExpired } from '../services/challengeService';

const FREE_CHALLENGE_LIMIT = 5;

function getCurrentUserId(): number | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

export function ChallengesPage() {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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
  const createdCount = challenges.filter((c) => c.creator_id === currentUserId).length;
  const nearOrOverLimit = createdCount >= FREE_CHALLENGE_LIMIT;

  const handleCopyLink = (e: React.MouseEvent, token: string, id: number) => {
    e.stopPropagation();
    const url = `${window.location.origin}/challenge/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <StudentLayout pageTitle="Challenges">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Swords size={22} color="var(--accent-primary)" /> Challenges
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Create a custom question set and challenge a friend or share it publicly.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!loading && (
            <span style={{ fontSize: 12, fontWeight: 600, color: nearOrOverLimit ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
              {Math.min(createdCount, FREE_CHALLENGE_LIMIT)}/{FREE_CHALLENGE_LIMIT} free challenges used
            </span>
          )}
          <button
            onClick={() => navigate('/challenges/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: 'var(--accent-primary)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '12px 20px',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Create Challenge
          </button>
        </div>
      </div>

      {nearOrOverLimit && (
        <div
          onClick={() => navigate('/pricing')}
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

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading challenges…</div>
      ) : challenges.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--border-color)', borderRadius: 12, padding: 48,
            textAlign: 'center', color: 'var(--text-muted)',
          }}
        >
          <Swords size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
          <p>You haven't created or joined any challenges yet.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}
        >
          {challenges.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/challenges/${c.id}`)}
              className="hover-lift hover-glow"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: 20,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'transform 200ms ease-out, box-shadow 200ms ease-out',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{c.title}</h3>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                    backgroundColor: c.visibility === 'PUBLIC' ? 'var(--accent-bg)' : 'rgba(120,120,120,0.12)',
                    color: c.visibility === 'PUBLIC' ? 'var(--accent-primary)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}
                >
                  {c.visibility === 'PUBLIC' ? <Globe size={11} /> : <Users size={11} />}
                  {c.visibility === 'PUBLIC' ? 'Public' : 'Invite Only'}
                </span>
              </div>
              {c.description && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{c.description}</p>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{c.question_count} Questions</span>
                <span>{c.time_limit_minutes} min</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Trophy size={12} /> {c.attempt_count} attempt{c.attempt_count === 1 ? '' : 's'}
                </span>
                {c.attempt_count >= 5 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#E8590C', fontWeight: 700 }}>
                    <Flame size={12} /> Trending
                  </span>
                )}
                {c.expires_at && (
                  <span
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      color: isChallengeExpired(c.expires_at) ? '#d32f2f' : 'var(--text-muted)',
                    }}
                  >
                    <Clock size={12} /> {formatChallengeExpiry(c.expires_at)}
                  </span>
                )}
              </div>
              {typeof c.my_best_score === 'number' && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                    color: '#7A4E00', backgroundColor: 'rgba(245, 166, 35, 0.14)',
                    padding: '6px 10px', borderRadius: 8, alignSelf: 'flex-start',
                  }}
                >
                  <Trophy size={13} /> Your best: {c.my_best_score} pts
                </div>
              )}
              <button
                onClick={(e) => handleCopyLink(e, c.share_token, c.id)}
                style={{
                  marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-main)', backgroundColor: 'transparent', cursor: 'pointer',
                }}
              >
                {copiedId === c.id ? <Check size={13} /> : <Copy size={13} />}
                {copiedId === c.id ? 'Link Copied' : 'Copy Public Link'}
              </button>
            </div>
          ))}
        </div>
      )}
    </StudentLayout>
  );
}
