import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, RotateCcw, CheckCircle2, XCircle, MinusCircle, PartyPopper, LogIn, UserPlus, X, Home } from 'lucide-react';
import { AuthModal, AuthMode } from '../auth/AuthModal';

interface GuestScoreModalProps {
  isOpen: boolean;
  scoreData: {
    score: number;
    totalMarksPossible: number;
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    accuracy: number;
    totalQuestions: number;
    topicName: string;
    subtopicName: string;
    targetExam: string;
    targetYear: string;
    attemptId?: string;
  };
  onClose: () => void;
  onRetake: () => void;
  isGuest?: boolean;
}

export function GuestScoreModal({ isOpen, scoreData, onClose, onRetake, isGuest = true }: GuestScoreModalProps) {
  const navigate = useNavigate();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  const isLoggedIn = Boolean(token && user);

  if (!isOpen || !scoreData) return null;

  const handleOpenAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handlePrimaryAction = () => {
    if (!isLoggedIn) {
      handleOpenAuth('signup');
      return;
    }
    onClose();
    const targetId = scoreData.attemptId || sessionStorage.getItem('latest_synced_attempt_id');
    if (targetId) {
      navigate(`/analytics?attemptId=${encodeURIComponent(targetId)}`);
    } else {
      navigate('/analytics');
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    onClose();
    const syncedId = scoreData.attemptId || sessionStorage.getItem('latest_synced_attempt_id');
    if (syncedId) {
      navigate(`/analytics?attemptId=${encodeURIComponent(syncedId)}`);
    } else {
      navigate('/analytics');
    }
  };

  const handleGoHome = () => {
    onClose();
    navigate('/');
  };

  const activeAttemptId = scoreData?.attemptId || (typeof window !== 'undefined' ? sessionStorage.getItem('latest_synced_attempt_id') : null);
  const targetRedirectUrl = activeAttemptId
    ? `/analytics?attemptId=${encodeURIComponent(activeAttemptId)}`
    : '/analytics';

  return (
    <>
      <AuthModal
        isOpen={authModalOpen}
        mode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSwitchMode={setAuthMode}
        onSuccess={handleAuthSuccess}
        redirectUrl={targetRedirectUrl}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: authModalOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 460,
            maxHeight: '90vh',
            backgroundColor: '#FFFFFF',
            borderRadius: 0, // Extra rounded bubbly corners
            padding: '32px 28px',
            border: '2px solid #E2E8F0',
            boxShadow: '0 25px 50px -12px rgba(227, 27, 35, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
            textAlign: 'center',
            fontFamily: "'IBM Plex Sans', -apple-system, system-ui, sans-serif",
            boxSizing: 'border-box',
            position: 'relative',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Close & Go Home Button */}
          <button
            type="button"
            onClick={handleGoHome}
            aria-label="Close and go to homepage"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              zIndex: 2,
              width: 32,
              height: 32,
              borderRadius: 0,
              border: '1.5px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.color = '#172033';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.color = '#64748B';
            }}
          >
            <X size={16} strokeWidth={2.2} />
          </button>

          {/* Playful Floating Bubbly Accents */}
          <div
            style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              borderRadius: 0,
              background: 'radial-gradient(circle, rgba(227, 27, 35, 0.15) 0%, rgba(255, 255, 255, 0) 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -30,
              left: -30,
              width: 120,
              height: 120,
              borderRadius: 0,
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(255, 255, 255, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Bubbly Animated Icon Badge */}
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 0,
              background: 'linear-gradient(135deg, #E31B23 0%, #E31B23 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
              boxShadow: '0 10px 20px rgba(227, 27, 35, 0.35)',
              transform: 'scale(1)',
              transition: 'transform 0.2s ease',
            }}
          >
            <PartyPopper size={30} strokeWidth={2.2} />
          </div>

          {/* Exam Title Tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 0, // Bubbly pill shape
              backgroundColor: '#F8FAFC',
              border: '1.5px solid #BFDBFE',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#E31B23', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {scoreData.targetExam}
            </span>
            <span style={{ color: '#93C5FD' }}>•</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#A4161A' }}>
              {isGuest ? 'Guest Test' : 'Practice Test'}
            </span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#172033', margin: '0 0 18px 0', letterSpacing: '-0.02em' }}>
            {scoreData.topicName}
            {scoreData.subtopicName ? <span style={{ fontWeight: 600, color: '#64748B' }}> · {scoreData.subtopicName}</span> : ''}
          </h2>

          {/* Bubbly Hero Score Bubble */}
          <div
            style={{
              background: 'linear-gradient(135deg, #F0F6FF 0%, #E0EDFF 100%)',
              borderRadius: 0, // High border-radius for bubbly aesthetic
              padding: '22px 20px',
              marginBottom: 20,
              border: '2px solid #BFDBFE',
              boxShadow: '0 8px 20px rgba(227, 27, 35, 0.08)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#E31B23', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Your Score
            </div>

            <div style={{ fontSize: 46, fontWeight: 900, color: '#172033', lineHeight: 1, letterSpacing: '-0.04em' }}>
              {scoreData.score}{' '}
              <span style={{ fontSize: 22, color: '#64748B', fontWeight: 700 }}>/ {scoreData.totalMarksPossible}</span>
            </div>

            {/* Dynamic Accuracy Pill */}
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 0, backgroundColor: '#ECFDF5', border: '1.5px solid #6EE7B7' }}>
              <Sparkles size={14} style={{ color: '#3A8B53' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#3A8B53' }}>
                {scoreData.accuracy}% Accuracy
              </span>
            </div>
          </div>

          {/* Bubbly Performance Metrics Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}
          >
            {/* Correct Stat Card */}
            <div
              style={{
                backgroundColor: '#ECFDF5',
                padding: '12px 8px',
                borderRadius: 0,
                border: '2px solid #A7F3D0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <CheckCircle2 size={16} style={{ color: '#3A8B53', marginBottom: 2 }} />
              <div style={{ fontSize: 11, color: '#047857', fontWeight: 800, textTransform: 'uppercase' }}>
                Correct
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#047857', marginTop: 2 }}>
                {scoreData.correctCount}
              </div>
            </div>

            {/* Incorrect Stat Card */}
            <div
              style={{
                backgroundColor: '#FEF2F2',
                padding: '12px 8px',
                borderRadius: 0,
                border: '2px solid #FECACA',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <XCircle size={16} style={{ color: '#DC2626', marginBottom: 2 }} />
              <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 800, textTransform: 'uppercase' }}>
                Wrong
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#B91C1C', marginTop: 2 }}>
                {scoreData.incorrectCount}
              </div>
            </div>

            {/* Skipped Stat Card */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                padding: '12px 8px',
                borderRadius: 0,
                border: '2px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <MinusCircle size={16} style={{ color: '#64748B', marginBottom: 2 }} />
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                Skipped
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#334155', marginTop: 2 }}>
                {scoreData.unattemptedCount}
              </div>
            </div>
          </div>

          {/* Feature Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
              borderRadius: 0,
              padding: '14px 16px',
              marginBottom: 20,
              border: '2px solid #C7D2FE',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#3730A3', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} style={{ color: '#4F46E5' }} />
              {isLoggedIn ? 'Practice Evaluated & Ready!' : 'Unlock 12-Matrix Psychometric & AI Analysis'}
            </div>
            <div style={{ fontSize: 11.5, color: '#4338CA', lineHeight: 1.45, fontWeight: 600 }}>
              {isLoggedIn
                ? 'Your responses and dwell metrics have been processed. View your comprehensive cognitive breakdown and personalized study recommendations.'
                : 'Sign in or create a free account to unlock your 12-matrix cognitive report, FSRS retention curve, guess detection, and AI study plan.'}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Primary Button */}
              <button
                type="button"
                onClick={handlePrimaryAction}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#E31B23',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 6px 16px rgba(227, 27, 35, 0.35)',
                  transition: 'transform 0.18s ease, background-color 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#C1121F';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#E31B23';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span>{isLoggedIn ? 'View Full Diagnostic Report' : 'Sign In / Sign Up to Analyze'}</span>
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>

              {/* Secondary Retake Button */}
              <button
                type="button"
                onClick={onRetake}
                style={{
                  height: 48,
                  padding: '0 18px',
                  borderRadius: 0,
                  border: '2px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <RotateCcw size={15} strokeWidth={2.2} />
                <span>Retake</span>
              </button>
            </div>

            {/* In-Page Question & Solution Review Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: 0,
                border: '1px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
                color: '#1E293B',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F1F5F9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
            >
              <span>Review Questions & Solutions on This Page</span>
            </button>

            {!isLoggedIn && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>Already registered?</span>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#E31B23',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Log In
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoHome}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '2px 0',
                marginTop: 2,
              }}
            >
              <Home size={13} strokeWidth={2.2} />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
