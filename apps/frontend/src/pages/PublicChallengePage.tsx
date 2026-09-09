import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Swords, ArrowRight, LogIn, Clock } from 'lucide-react';
import { PublicLayout } from '../components/common/PublicLayout';
import { getPublicChallengePreview, ChallengePublicPreview, formatChallengeExpiry } from '../services/challengeService';

export function PublicChallengePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<ChallengePublicPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPublicChallengePreview(token)
      .then(setPreview)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const isLoggedIn = !!localStorage.getItem('access_token');

  const handleStart = () => {
    if (!token) return;
    if (isLoggedIn) {
      navigate(`/challenges/attempt/${token}`);
    } else {
      navigate(`/signin?redirect=${encodeURIComponent(`/challenge/${token}`)}`);
    }
  };

  return (
    <PublicLayout>
      <section
        className="landing-section-padding"
        style={{ background: 'var(--bg-body)', paddingTop: 'clamp(96px, 11vw, 128px)', textAlign: 'center' }}
      >
        <div className="landing-container" style={{ maxWidth: 560, margin: '0 auto' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading challenge…</p>
          ) : notFound || !preview ? (
            <>
              <h1 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                Challenge Not Found
              </h1>
              <p style={{ color: 'var(--text-muted)' }}>This challenge link is invalid or no longer available.</p>
            </>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 16, padding: 40,
              }}
            >
              <Swords size={36} color="var(--accent-primary)" style={{ marginBottom: 16 }} />
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>{preview.title}</h1>
              {preview.description && (
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{preview.description}</p>
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
                {preview.creator_name ? `${preview.creator_name} challenged you — ` : ''}
                {preview.question_count} questions &middot; {preview.time_limit_minutes} minutes
              </p>
              {preview.expires_at && (
                <p
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: 13, fontWeight: 600, marginBottom: 24,
                    color: preview.is_expired ? '#d32f2f' : 'var(--text-muted)',
                  }}
                >
                  <Clock size={13} /> {formatChallengeExpiry(preview.expires_at)}
                </p>
              )}
              {preview.is_expired ? (
                <div
                  style={{
                    padding: '14px', borderRadius: 10, backgroundColor: 'rgba(211,47,47,0.08)',
                    color: '#d32f2f', fontWeight: 600, fontSize: 14,
                  }}
                >
                  This challenge has closed and is no longer accepting new attempts.
                </div>
              ) : (
                <button
                  onClick={handleStart}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '14px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  }}
                >
                  {isLoggedIn ? (
                    <>Start Challenge <ArrowRight size={16} /></>
                  ) : (
                    <>Sign In to Take This Challenge <LogIn size={16} /></>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
