import React from 'react';
import { Clock, Globe, Lock } from 'lucide-react';
import { formatChallengeExpiry, isChallengeExpired } from '../../services/challengeService';

const pill: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
  display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0,
};

/** "Anyone with the link" vs "Invite only", with a tooltip saying what that means. */
export function VisibilityBadge({ visibility }: { visibility: 'PUBLIC' | 'INVITE_ONLY' }) {
  const isPublic = visibility === 'PUBLIC';
  return (
    <span
      title={isPublic ? 'Anyone with the link can sign in and take it' : 'Only people the creator invited can take it'}
      style={{
        ...pill,
        backgroundColor: isPublic ? 'var(--accent-bg)' : '#F1F5F9',
        color: isPublic ? 'var(--accent-primary)' : '#475569',
        border: `1px solid ${isPublic ? 'var(--accent-border, rgba(227,27,35,0.25))' : '#E2E8F0'}`,
      }}
    >
      {isPublic ? <Globe size={11} /> : <Lock size={11} />}
      {isPublic ? 'Anyone with link' : 'Invite only'}
    </span>
  );
}

/** Open (with time left), Closed, or open with no deadline. */
export function StatusChip({ expiresAt }: { expiresAt?: string | null }) {
  const closed = isChallengeExpired(expiresAt);
  const label = expiresAt ? formatChallengeExpiry(expiresAt) : 'No deadline';
  return (
    <span
      style={{
        ...pill,
        backgroundColor: closed ? '#FEF2F2' : '#ECFDF5',
        color: closed ? '#B91C1C' : '#047857',
        border: `1px solid ${closed ? '#FECACA' : '#A7F3D0'}`,
      }}
    >
      <Clock size={11} />
      {closed ? 'Closed' : label}
    </span>
  );
}

/** Exam, subjects and years as small grey tags. */
export function ChallengeTags({ tags }: { tags: (string | null | undefined)[] }) {
  const shown = tags.filter(Boolean) as string[];
  if (shown.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {shown.map((tag) => (
        <span
          key={tag}
          style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, backgroundColor: 'var(--bg-subtle, #F8FAFC)', color: 'var(--text-secondary, #475569)', border: '1px solid var(--border-color)' }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function challengeTagList(c: {
  exam_name?: string | null;
  subject_names?: string[];
  subject_name?: string | null;
  years?: number[];
  difficulty?: string | null;
}): (string | null | undefined)[] {
  const subjects = c.subject_names && c.subject_names.length ? c.subject_names : [c.subject_name];
  return [
    ...(c.exam_name ? c.exam_name.split(', ') : []),
    ...subjects,
    c.years && c.years.length ? c.years.join(', ') : null,
    c.difficulty ? c.difficulty.charAt(0) + c.difficulty.slice(1).toLowerCase() : null,
  ];
}
