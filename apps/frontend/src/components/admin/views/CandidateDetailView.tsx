import React, { useState } from 'react';
import {
  ArrowLeft,
  Users,
  Mail,
  Zap,
  BookOpen,
  Crown,
  Award,
  Calendar,
  Clock,
  Globe,
  Phone,
  Edit3,
  CheckCircle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Save,
  X,
  UserCheck,
  UserX
} from 'lucide-react';
import { User, UserStatus } from '../../../types/auth';
import { updateUserDetails, updateUserStatus, fetchUserById } from '../../../services/adminService';

interface CandidateDetailViewProps {
  candidate: User;
  isDetailLoading?: boolean;
  onBack: () => void;
  onUpdateCandidate: (updated: User) => void;
}

export function CandidateDetailView({
  candidate,
  isDetailLoading = false,
  onBack,
  onUpdateCandidate,
}: CandidateDetailViewProps) {
  // Edit Dialog State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [editFullName, setEditFullName] = useState<string>(candidate.full_name || '');
  const [editEmail, setEditEmail] = useState<string>(candidate.email || '');
  const [editStatus, setEditStatus] = useState<UserStatus>(candidate.status || UserStatus.ACTIVE);
  const [editTier, setEditTier] = useState<'FREE' | 'PREMIUM'>(
    (candidate.subscription_tier === 'PREMIUM' || candidate.student_profile?.subscription_tier === 'PREMIUM')
      ? 'PREMIUM'
      : 'FREE'
  );

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Helper for clean display name & initials
  const isDefaultClerkName = !candidate.full_name || candidate.full_name.trim() === '' || candidate.full_name === 'Clerk Sync User';
  const isDefaultClerkEmail = candidate.email?.includes('@clerk.local');

  const displayName = isDefaultClerkName
    ? (!isDefaultClerkEmail && candidate.email ? candidate.email.split('@')[0] : `Candidate #${candidate.id}`)
    : candidate.full_name;

  const displayInitials = (() => {
    if (!isDefaultClerkName) {
      const parts = candidate.full_name.trim().split(' ').filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return candidate.full_name.slice(0, 2).toUpperCase();
    }
    return `C${candidate.id}`;
  })();

  const isPremium =
    candidate.subscription_tier === 'PREMIUM' ||
    candidate.student_profile?.subscription_tier === 'PREMIUM';

  const handleOpenEdit = () => {
    setEditFullName(isDefaultClerkName ? '' : candidate.full_name);
    setEditEmail(candidate.email || '');
    setEditStatus(candidate.status || UserStatus.ACTIVE);
    setEditTier(isPremium ? 'PREMIUM' : 'FREE');
    setIsEditing(true);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedbackMsg(null);

    try {
      // Only send fields that changed: re-sending an unchanged placeholder email
      // (e.g. user_x@clerk.local) would fail email validation on the server.
      const nextName = editFullName.trim();
      const nextEmail = editEmail.trim();
      const payload: Parameters<typeof updateUserDetails>[1] = {
        status: editStatus,
        subscription_tier: editTier,
      };
      if (nextName && nextName !== candidate.full_name) payload.full_name = nextName;
      if (nextEmail && nextEmail !== candidate.email) payload.email = nextEmail;
      const updated = await updateUserDetails(candidate.id, payload);

      onUpdateCandidate(updated);
      setFeedbackMsg({ type: 'success', text: 'Candidate details updated successfully.' });
      setIsEditing(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to update candidate:', err);
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update candidate details.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus: 'ACTIVE' | 'SUSPENDED' = candidate.status === UserStatus.ACTIVE ? 'SUSPENDED' : 'ACTIVE';
    setTogglingStatus(true);
    setFeedbackMsg(null);
    try {
      const updated = await updateUserStatus(candidate.id, nextStatus);
      onUpdateCandidate(updated);
      setFeedbackMsg({
        type: 'success',
        text: `Candidate status updated to ${nextStatus === 'ACTIVE' ? 'Active' : 'Suspended'}.`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      setFeedbackMsg({ type: 'error', text: err.message || 'Could not update status.' });
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const freshUser = await fetchUserById(candidate.id);
      if (freshUser) {
        onUpdateCandidate(freshUser);
        setFeedbackMsg({ type: 'success', text: 'Candidate profile refreshed.' });
        setTimeout(() => setFeedbackMsg(null), 2500);
      }
    } catch (err: any) {
      console.warn('Could not refresh user:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Remaining subscription time, shown as days with an approximate month count.
  const formatRemaining = (days?: number | null) => {
    if (days === null || days === undefined) return null;
    if (days <= 0) return 'Expired';
    if (days < 60) return `${days} day${days === 1 ? '' : 's'} left`;
    return `${days} days left (~${Math.round(days / 30)} months)`;
  };
  const remainingDays = candidate.subscription_days_remaining;
  const remainingLabel = formatRemaining(remainingDays);
  const remainingIsLow = remainingDays !== null && remainingDays !== undefined && remainingDays <= 7;

  const formatDate = (iso?: string | null) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
      {/* Top Header & Breadcrumbs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--deep-navy)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Candidates</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>Candidate Directory</span>
            <span>/</span>
            <span style={{ fontWeight: 700, color: 'var(--deep-navy)' }}>{displayName}</span>
          </div>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing || isDetailLoading}
            title="Refresh candidate data"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: refreshing || isDetailLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={refreshing || isDetailLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: candidate.status === 'ACTIVE' ? '1px solid #fecaca' : '1px solid #a7f3d0',
              backgroundColor: candidate.status === 'ACTIVE' ? '#fef2f2' : '#ecfdf5',
              color: candidate.status === 'ACTIVE' ? '#dc2626' : '#15803d',
              fontSize: 12,
              fontWeight: 600,
              cursor: togglingStatus ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {candidate.status === 'ACTIVE' ? <UserX size={14} /> : <UserCheck size={14} />}
            <span>{candidate.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}</span>
          </button>

          <button
            onClick={handleOpenEdit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary-red), var(--accent-darker, #b91c1c))',
              color: 'var(--bg-card)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <Edit3 size={14} />
            <span>Edit Candidate</span>
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedbackMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: feedbackMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedbackMsg.type === 'success' ? '#15803d' : '#dc2626',
            border: `1px solid ${feedbackMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          }}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Hero Profile Overview Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* Avatar */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                background: 'linear-gradient(135deg, var(--primary-red) 0%, #4f46e5 50%, #7c3aed 100%)',
                color: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 800,
                boxShadow: '0 6px 18px rgba(79, 70, 229, 0.25)',
                border: '2px solid #ffffff',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {candidate.profile_image && candidate.profile_image.startsWith('http') ? (
                <img
                  src={candidate.profile_image}
                  alt={displayName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                displayInitials
              )}
            </div>

            {/* Identity Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: 'var(--deep-navy)',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {displayName}
                </h1>
                {candidate.is_verified && (
                  <CheckCircle size={18} color="var(--status-success)" title="Verified Candidate" />
                )}
                {isDefaultClerkName && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: 'var(--status-warning-bg)',
                      color: 'var(--status-warning)',
                      border: '1px solid #fde68a',
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    Clerk Synced Account
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <Mail size={14} color="var(--primary-red)" />
                <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.email}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <Phone size={14} color="var(--primary-red)" />
                <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.phone || 'Mobile number not provided'}</span>
              </div>

              {/* Status & Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 6,
                    backgroundColor: candidate.role === 'SUPER_ADMIN' ? '#f3e8ff' : candidate.role === 'ADMIN' ? 'var(--bg-subtle)' : '#ecfdf5',
                    color: candidate.role === 'SUPER_ADMIN' ? '#7c3aed' : candidate.role === 'ADMIN' ? 'var(--primary-red)' : 'var(--status-success)',
                    border: `1px solid ${candidate.role === 'SUPER_ADMIN' ? '#ddd6fe' : candidate.role === 'ADMIN' ? 'var(--accent-border)' : '#a7f3d0'}`,
                  }}
                >
                  {candidate.role}
                </span>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 6,
                    backgroundColor: candidate.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                    color: candidate.status === 'ACTIVE' ? 'var(--status-success)' : '#dc2626',
                    border: `1px solid ${candidate.status === 'ACTIVE' ? '#a7f3d0' : '#fecaca'}`,
                  }}
                >
                  {candidate.status === 'ACTIVE' ? 'Active Candidate' : 'Suspended'}
                </span>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 6,
                    backgroundColor: isPremium ? '#fffbe8' : 'var(--bg-subtle)',
                    color: isPremium ? 'var(--status-warning)' : 'var(--text-muted)',
                    border: `1px solid ${isPremium ? '#fde68a' : 'var(--border-color)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {isPremium && <Crown size={12} color="#d97706" />}
                  {isPremium ? 'PREMIUM PRO' : 'FREE TIER'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Metrics & Engagement Grid */}
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 12,
          }}
        >
          Learning Metrics & Engagement
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
          {/* Current Streak */}
          <div
            style={{
              padding: 18,
              borderRadius: 10,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                color: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #fed7aa',
                flexShrink: 0,
              }}
            >
              <Zap size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Current Streak</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ea580c', marginTop: 2 }}>
                {candidate.current_streak || candidate.student_profile?.current_streak || 0} Days
              </div>
            </div>
          </div>

          {/* Questions Solved */}
          <div
            style={{
              padding: 18,
              borderRadius: 10,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                color: 'var(--status-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #a7f3d0',
                flexShrink: 0,
              }}
            >
              <BookOpen size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Questions Solved</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-success)', marginTop: 2 }}>
                {candidate.free_questions_attempted || candidate.student_profile?.free_questions_attempted || 0} Solved
              </div>
            </div>
          </div>

          {/* Rank Level */}
          <div
            style={{
              padding: 18,
              borderRadius: 10,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fffbe8 0%, #fef3c7 100%)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #fde68a',
                flexShrink: 0,
              }}
            >
              <Crown size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Rank Level</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706', marginTop: 2 }}>
                Level {candidate.level || candidate.student_profile?.level || 1}
              </div>
            </div>
          </div>

          {/* Total XP */}
          <div
            style={{
              padding: 18,
              borderRadius: 10,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #ddd6fe',
                flexShrink: 0,
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Total XP</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>
                {candidate.total_xp || candidate.student_profile?.total_xp || 0} XP
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Tier & Account Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Subscription Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: isPremium ? '1px solid #fde68a' : '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: isPremium ? '#fffbe8' : 'var(--bg-subtle)',
                  color: isPremium ? '#d97706' : 'var(--text-muted)',
                  border: `1px solid ${isPremium ? '#fde68a' : 'var(--border-color)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Crown size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--deep-navy)' }}>Subscription Tier</h4>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Candidate plan & limits</p>
              </div>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 6,
                backgroundColor: isPremium ? '#fffbe8' : 'var(--bg-subtle)',
                color: isPremium ? 'var(--status-warning)' : 'var(--primary-red)',
                border: `1px solid ${isPremium ? '#fde68a' : 'var(--accent-border)'}`,
              }}
            >
              Active Plan
            </span>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 8,
              backgroundColor: isPremium ? '#fffef5' : 'var(--bg-subtle)',
              border: `1px dashed ${isPremium ? '#fde68a' : 'var(--border-color)'}`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)' }}>
              {isPremium ? 'PREMIUM Pro Tier' : 'FREE Standard Tier'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              {isPremium
                ? 'Unlimited practice questions, smart revision planner, detailed analytics & full mock test simulations.'
                : 'Standard candidate tier with daily free questions limit and essential performance tracking.'}
            </div>
          </div>

          {remainingLabel && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
                backgroundColor: remainingIsLow ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${remainingIsLow ? '#fecaca' : '#bbf7d0'}`,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} />
                Subscription time remaining
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: remainingIsLow ? '#dc2626' : '#15803d' }}>
                {remainingLabel}
                {candidate.subscription_ends_at && remainingDays ? ` · ends ${formatDate(candidate.subscription_ends_at)}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Account System Details Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--primary-red)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--deep-navy)' }}>Account System Details</h4>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Platform metadata & timestamps</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-subtle)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Clock size={12} />
                <span>Timezone</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)', fontFamily: 'var(--font-mono)' }}>
                {candidate.timezone || 'Asia/Kolkata'}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-subtle)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Calendar size={12} />
                <span>Registration Date</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)', fontFamily: 'var(--font-mono)' }}>
                {formatDate(candidate.created_at)}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-subtle)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <RefreshCw size={12} />
                <span>Last Activity</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)', fontFamily: 'var(--font-mono)' }}>
                {formatDate(candidate.updated_at)}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-subtle)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Globe size={12} />
                <span>Preferred Lang</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)' }}>
                {candidate.preferred_language === 'hi' ? 'Hindi (hi)' : 'English (en)'}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-subtle)', border: '1px solid #e2e8f0', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Phone size={12} />
                <span>Mobile No.</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)', fontFamily: 'var(--font-mono)' }}>
                {candidate.phone || 'Not provided'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Candidate Modal / Drawer */}
      {isEditing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !saving && setIsEditing(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              backgroundColor: 'var(--bg-card)',
              borderRadius: 12,
              boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.3)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="var(--primary-red)" />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--deep-navy)' }}>
                  Edit Candidate Information
                </span>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveDetails} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Candidate Full Name
                  </label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Enter real candidate name..."
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--primary-red)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
                    Replaces placeholder names (e.g. Clerk Sync User) with real candidate name.
                  </span>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Candidate Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="candidate@example.com"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'var(--font-mono)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--primary-red)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        marginBottom: 6,
                      }}
                    >
                      Account Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                      style={{
                        width: '100%',
                        padding: '9px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 13,
                        backgroundColor: 'var(--bg-card)',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value={UserStatus.ACTIVE}>Active</option>
                      <option value={UserStatus.SUSPENDED}>Suspended</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        marginBottom: 6,
                      }}
                    >
                      Subscription Plan
                    </label>
                    <select
                      value={editTier}
                      onChange={(e) => setEditTier(e.target.value as 'FREE' | 'PREMIUM')}
                      style={{
                        width: '100%',
                        padding: '9px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 13,
                        backgroundColor: 'var(--bg-card)',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="FREE">Free Tier</option>
                      <option value="PREMIUM">Premium Pro</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--primary-red), var(--accent-darker, #b91c1c))',
                    color: 'var(--bg-card)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.25)',
                  }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
