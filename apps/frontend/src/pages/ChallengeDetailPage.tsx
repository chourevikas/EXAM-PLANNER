import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Check, UserPlus, Trophy, ArrowRight, Globe, Users, Clock } from 'lucide-react';
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
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
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

        {isChallengeExpired(challenge.expires_at) ? (
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
            Start Challenge <ArrowRight size={16} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
            <Trophy size={16} color="var(--accent-primary)" /> Leaderboard
          </div>
          {leaderboard.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No attempts yet. Be the first!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaderboard.map((entry, idx) => (
                <div
                  key={entry.user_id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8,
                    backgroundColor: entry.is_current_user ? 'var(--accent-bg)' : 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)', width: 20 }}>#{idx + 1}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {entry.user_name}{entry.is_current_user ? ' (You)' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {entry.total_score} pts &middot; {entry.total_correct} correct
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
