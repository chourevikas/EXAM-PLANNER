import React, { useState, useEffect } from 'react';
import { TeacherSidebar } from '../components/teacher/TeacherSidebar';
import { TeacherTopNav } from '../components/teacher/TeacherTopNav';
import { fetchCurrentUser } from '../services/authService';

import { TeacherOverviewView } from '../components/teacher/views/TeacherOverviewView';
import { ReviewQueueView } from '../components/teacher/views/ReviewQueueView';
import { ReviewTaskDetailView } from '../components/teacher/views/ReviewTaskDetailView';
import { PointsView } from '../components/teacher/views/PointsView';
import { RewardsView } from '../components/teacher/views/RewardsView';

export function TeacherPage() {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
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

    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F7F7F5', fontFamily: 'Inter, sans-serif', color: '#172033', overflowX: 'hidden' }}>
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
          <main style={{ flex: 1, overflowY: 'auto', background: '#F7F7F5', padding: isMobile ? '16px 20px' : '24px 32px', boxSizing: 'border-box' }}>
            {renderView()}
          </main>
        </div>
      </div>
    </div>
  );
}
