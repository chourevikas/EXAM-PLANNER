import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TeacherSidebar } from '../components/teacher/TeacherSidebar';
import { TeacherTopNav } from '../components/teacher/TeacherTopNav';
import { fetchCurrentUser } from '../services/authService';
import { useBreakpoint } from '../hooks/useBreakpoint';

// Lazy-loaded views for code splitting
const TeacherOverviewView = lazy(() =>
  import('../components/teacher/views/TeacherOverviewView').then((m) => ({ default: m.TeacherOverviewView }))
);
const ReviewQueueView = lazy(() =>
  import('../components/teacher/views/ReviewQueueView').then((m) => ({ default: m.ReviewQueueView }))
);
const ReviewTaskDetailView = lazy(() =>
  import('../components/teacher/views/ReviewTaskDetailView').then((m) => ({ default: m.ReviewTaskDetailView }))
);
const PointsView = lazy(() =>
  import('../components/teacher/views/PointsView').then((m) => ({ default: m.PointsView }))
);
const RewardsView = lazy(() =>
  import('../components/teacher/views/RewardsView').then((m) => ({ default: m.RewardsView }))
);

function TeacherViewSkeleton() {
  return (
    <div
      style={{
        padding: 32,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 0,
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--text-muted)' }}>
        <div
          style={{
            width: 28,
            height: 28,
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--primary-red)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Loading view...</span>
      </div>
    </div>
  );
}

export function TeacherPage() {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isTabletOrBelow: isMobile } = useBreakpoint();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    document.title = 'Teacher Dashboard - ExamPlanner';
    fetchCurrentUser()
      .then((data) => setUser(data))
      .catch((err) => console.error('Failed to fetch user data:', err));
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const handleNavigate = (view: string) => {
    setActiveView(view);
    if (view !== 'review-detail') {
      setSelectedQuestionId(null);
    }
    if (isMobile) setMobileOpen(false);
  };

  const handleOpenQuestion = (questionId: number) => {
    setSelectedQuestionId(questionId);
    setActiveView('review-detail');
  };

  const handleDecided = () => {
    setSelectedQuestionId(null);
    setActiveView('review');
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <TeacherOverviewView user={user} onNavigate={handleNavigate} />;
      case 'review':
        return <ReviewQueueView onOpenQuestion={handleOpenQuestion} />;
      case 'review-detail':
        return selectedQuestionId ? (
          <ReviewTaskDetailView
            questionId={selectedQuestionId}
            onBack={() => handleNavigate('review')}
            onDecided={handleDecided}
          />
        ) : (
          <ReviewQueueView onOpenQuestion={handleOpenQuestion} />
        );
      case 'points':
        return <PointsView />;
      case 'rewards':
        return <RewardsView />;
      default:
        return <TeacherOverviewView user={user} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        fontFamily: 'Inter, sans-serif',
        color: 'var(--text-main)',
        overflowX: 'hidden',
      }}
    >
      <TeacherTopNav
        user={user}
        activeView={activeView === 'review-detail' ? 'review' : activeView}
        onNavigate={handleNavigate}
        onToggleSidebar={handleToggleSidebar}
      />

      <div style={{ display: 'flex', flex: 1, marginTop: '60px' }}>
        <TeacherSidebar
          activeView={activeView === 'review-detail' ? 'review' : activeView}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onToggleSidebar={handleToggleSidebar}
        />

        <div
          style={{
            flex: 1,
            marginLeft: isMobile ? 0 : (sidebarCollapsed ? '68px' : '240px'),
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            width: '100%',
          }}
        >
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--background)',
              padding: isMobile ? '16px 20px' : '24px 32px',
              boxSizing: 'border-box',
            }}
          >
            <Suspense fallback={<TeacherViewSkeleton />}>
              {renderView()}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
