import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminTopNav } from '../components/admin/AdminTopNav';
import { fetchCurrentUser } from '../services/authService';

/* View Components */
import { AdminOverviewView } from '../components/admin/AdminOverviewView';
import { QuestionBankManager } from '../components/admin/QuestionBankManager';
import { UploadReviewView } from '../components/admin/UploadReviewView';
import { AIQueueView } from '../components/admin/views/AIQueueView';
import { QuestionReviewView } from '../components/admin/views/QuestionReviewView';
import { MockTestsView } from '../components/admin/views/MockTestsView';
import { UsersView } from '../components/admin/views/UsersView';
import { AnalyticsView } from '../components/admin/views/AnalyticsView';
import { ExamPipelineStatusView } from '../components/admin/views/ExamPipelineStatusView';
import { TeacherRewardsView } from '../components/admin/views/TeacherRewardsView';
import { CurrentAffairsManager } from '../components/admin/views/CurrentAffairsManager';

export function AdminPage() {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedExamForReview, setSelectedExamForReview] = useState<any>(null);
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
    document.title = "Admin Dashboard - ExamPlanner";
    fetchCurrentUser().then(data => {
      setUser(data);
    }).catch(err => {
      console.error("Failed to fetch user data:", err);
    });

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

  const handleNavigate = (view: string, extraData?: any) => {
    setActiveView(view);
    if (extraData !== undefined) {
      setSelectedExamForReview(extraData);
    } else if (view !== 'review') {
      setSelectedExamForReview(null);
    }
    if (isMobile) setMobileOpen(false);
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <AdminOverviewView onNavigate={handleNavigate} />;
      case 'pipeline-status':
        return <ExamPipelineStatusView onNavigate={handleNavigate} />;
      case 'ai-queue':
      case 'upload':
        return <UploadReviewView onNavigate={handleNavigate} />;
      case 'questions':
        return <QuestionBankManager />;
      case 'review':
        return <QuestionReviewView initialExam={selectedExamForReview} onNavigate={handleNavigate} />;
      case 'mock-tests':
        return <MockTestsView />;
      case 'users':
        return <UsersView />;
      case 'teacher-rewards':
        return <TeacherRewardsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'current-affairs':
        return <CurrentAffairsManager />;
      default:
        return <AdminOverviewView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F7F7F5', fontFamily: 'Inter, sans-serif', color: '#172033', overflowX: 'hidden' }}>
      
      {/* Full-width Top Header (fixed at top: 0) */}
      <AdminTopNav 
        user={user}
        activeView={activeView}
        onNavigate={handleNavigate}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Main Container below Top Header */}
      <div style={{ display: 'flex', flex: 1, marginTop: '60px' }}>
        
        {/* Sidebar Navigation (fixed top: 60px) */}
        <AdminSidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Main Content Area */}
        <div 
          style={{ 
            flex: 1, 
            marginLeft: isMobile ? 0 : (sidebarCollapsed ? '68px' : '240px'), 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0,
            transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            width: '100%'
          }}
        >
          {/* Page Content Viewport */}
          <main style={{ 
            flex: 1, 
            overflowY: 'auto', 
            background: '#F7F7F5', 
            padding: isMobile ? '16px 20px' : '24px 32px', 
            boxSizing: 'border-box' 
          }}>
            {renderView()}
          </main>
        </div>

      </div>
    </div>
  );

}

